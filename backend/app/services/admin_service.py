"""Admin dashboard reporting services."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from ..config import get_settings
from ..db import get_connection
from .payment_service import PLAN_LABEL, ensure_payment_schema
from .profile_service import ensure_schema, frontend_public_link

MANUAL_ACCESS_DURATIONS: dict[str, timedelta] = {
    "2_days": timedelta(days=2),
    "1_week": timedelta(days=7),
    "1_month": timedelta(days=30),
}


def _decimal_to_float(value: object) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _resolve_manual_access_expires_at(
    *,
    current_expires_at: datetime | None,
    duration: str,
    custom_expires_at: datetime | None,
    now: datetime,
) -> datetime:
    """Return the new expiry without shortening an existing future entitlement."""

    now = _utc(now)
    current_expires_at = _utc(current_expires_at) if current_expires_at else None
    base = max(now, current_expires_at) if current_expires_at else now

    if duration == "custom":
        if custom_expires_at is None:
            raise ValueError("Custom access requires an end date.")

        custom_expires_at = _utc(custom_expires_at)
        if custom_expires_at <= now:
            raise ValueError("Custom access end date must be in the future.")

        return max(base, custom_expires_at)

    delta = MANUAL_ACCESS_DURATIONS.get(duration)
    if delta is None:
        raise ValueError("Unsupported manual access duration.")

    return base + delta


def grant_manual_access(
    *,
    user_id: str,
    duration: str,
    granted_by_email: str,
    custom_expires_at: datetime | None = None,
) -> dict[str, object]:
    """Grant or extend access for a profile owner without creating a payment."""

    ensure_schema()
    ensure_payment_schema()
    admin_email = granted_by_email.strip().lower()
    if not admin_email:
        raise ValueError("Admin email is required.")

    now = datetime.now(UTC)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select
                  au.id as owner_user_id,
                  au.email,
                  cp.id as candidate_profile_id,
                  cp.public_profile_id
                from auth_users au
                join candidate_profiles cp
                  on cp.user_id = au.id
                where au.id = %s
                limit 1
                for update
                """,
                (user_id,),
            )
            candidate = cursor.fetchone()

            if not candidate:
                raise LookupError("User profile not found.")

            cursor.execute(
                """
                select *
                from billing_access
                where owner_user_id = %s
                  and candidate_profile_id = %s
                limit 1
                for update
                """,
                (str(candidate["owner_user_id"]), str(candidate["candidate_profile_id"])),
            )
            billing_row = cursor.fetchone()

            if billing_row is None:
                cursor.execute(
                    """
                    insert into billing_access (
                      id,
                      owner_user_id,
                      candidate_profile_id,
                      status,
                      free_public_chat_count,
                      created_at,
                      updated_at
                    )
                    values (%s, %s, %s, 'inactive', 0, %s, %s)
                    returning *
                    """,
                    (
                        str(uuid4()),
                        str(candidate["owner_user_id"]),
                        str(candidate["candidate_profile_id"]),
                        now,
                        now,
                    ),
                )
                billing_row = cursor.fetchone()

            if billing_row is None:
                raise RuntimeError("Unable to create billing access.")

            access_expires_at = _resolve_manual_access_expires_at(
                current_expires_at=billing_row.get("access_expires_at")
                if isinstance(billing_row.get("access_expires_at"), datetime)
                else None,
                duration=duration,
                custom_expires_at=custom_expires_at,
                now=now,
            )
            access_starts_at = billing_row.get("access_starts_at")
            if not isinstance(access_starts_at, datetime):
                access_starts_at = now

            cursor.execute(
                """
                update billing_access
                set status = 'active',
                    access_starts_at = %s,
                    access_expires_at = %s,
                    manual_access_granted_by_email = %s,
                    manual_access_granted_at = %s,
                    updated_at = %s
                where id = %s
                returning *
                """,
                (
                    access_starts_at,
                    access_expires_at,
                    admin_email,
                    now,
                    now,
                    billing_row["id"],
                ),
            )
            updated_row = cursor.fetchone()

        connection.commit()

    if updated_row is None:
        raise RuntimeError("Unable to grant manual access.")

    return {
        "userId": str(candidate["owner_user_id"]),
        "email": str(candidate["email"]),
        "publicProfileId": candidate["public_profile_id"],
        "status": str(updated_row["status"]),
        "accessStartsAt": updated_row["access_starts_at"],
        "accessExpiresAt": updated_row["access_expires_at"],
        "manualAccessGrantedByEmail": updated_row["manual_access_granted_by_email"],
        "manualAccessGrantedAt": updated_row["manual_access_granted_at"],
    }


def get_admin_dashboard_data() -> dict[str, object]:
    """Return summary, user, and usage data for the admin dashboard."""

    ensure_schema()
    ensure_payment_schema()
    free_public_chat_limit = get_settings().free_public_chat_limit
    if free_public_chat_limit <= 0:
        free_public_chat_limit = 2

    with get_connection(autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select
                  count(distinct au.id) as total_users,
                  count(distinct cp.id) as total_twins,
                  coalesce(count(cue.id), 0) as total_requests,
                  coalesce(sum(cue.total_tokens), 0) as total_tokens,
                  coalesce(sum(cue.total_cost), 0) as total_cost
                from auth_users au
                left join candidate_profiles cp
                  on cp.user_id = au.id
                left join chat_usage_events cue
                  on cue.candidate_profile_id = cp.id
                """
            )
            summary_row = cursor.fetchone()

            cursor.execute(
                """
                select
                  au.id as user_id,
                  au.first_name,
                  au.last_name,
                  au.email,
                  au.auth_provider,
                  au.created_at,
                  cp.public_profile_id,
                  cp.persona,
                  cp.upload_status,
                  cp.cv_processing_status,
                  cp.first_name as candidate_first_name,
                  cp.second_name as candidate_second_name,
                  coalesce(count(cue.id), 0) as total_requests,
                  coalesce(sum(cue.total_tokens), 0) as total_tokens,
                  coalesce(sum(cue.total_cost), 0) as total_cost,
                  max(cue.created_at) as last_activity_at
                from auth_users au
                left join candidate_profiles cp
                  on cp.user_id = au.id
                left join chat_usage_events cue
                  on cue.candidate_profile_id = cp.id
                group by
                  au.id,
                  au.first_name,
                  au.last_name,
                  au.email,
                  au.auth_provider,
                  au.created_at,
                  cp.public_profile_id,
                  cp.persona,
                  cp.upload_status,
                  cp.cv_processing_status,
                  cp.first_name,
                  cp.second_name
                order by au.created_at desc
                """
            )
            user_rows = cursor.fetchall()

            cursor.execute(
                """
                select
                  au.id as user_id,
                  au.email,
                  cp.public_profile_id,
                  cp.first_name,
                  cp.second_name,
                  coalesce(count(cue.id), 0) as requests_sent,
                  coalesce(sum(cue.prompt_tokens), 0) as prompt_tokens,
                  coalesce(sum(cue.completion_tokens), 0) as completion_tokens,
                  coalesce(sum(cue.total_tokens), 0) as total_tokens,
                  coalesce(sum(cue.total_cost), 0) as total_cost,
                  max(cue.created_at) as last_request_at
                from candidate_profiles cp
                join auth_users au
                  on au.id = cp.user_id
                left join chat_usage_events cue
                  on cue.candidate_profile_id = cp.id
                group by
                  au.id,
                  au.email,
                  cp.public_profile_id,
                  cp.first_name,
                  cp.second_name
                order by last_request_at desc nulls last, total_tokens desc, au.email asc
                """
            )
            usage_rows = cursor.fetchall()

            cursor.execute(
                """
                select
                  au.id as user_id,
                  au.email,
                  cp.public_profile_id,
                  cp.first_name,
                  cp.second_name,
                  ba.status,
                  ba.free_public_chat_count,
                  ba.access_starts_at,
                  ba.access_expires_at,
                  ba.manual_access_granted_by_email,
                  ba.manual_access_granted_at,
                  ba.updated_at
                from auth_users au
                left join candidate_profiles cp
                  on cp.user_id = au.id
                left join billing_access ba
                  on ba.owner_user_id = au.id
                 and cp.id = ba.candidate_profile_id
                order by au.created_at desc
                """
            )
            subscription_rows = cursor.fetchall()

    return {
        "summary": {
            "totalUsers": int(summary_row["total_users"]) if summary_row else 0,
            "totalTwins": int(summary_row["total_twins"]) if summary_row else 0,
            "totalRequests": int(summary_row["total_requests"]) if summary_row else 0,
            "totalTokens": int(summary_row["total_tokens"]) if summary_row else 0,
            "totalCost": _decimal_to_float(summary_row["total_cost"]) if summary_row else 0.0,
        },
        "users": [
            {
                "userId": str(row["user_id"]),
                "firstName": str(row["first_name"]),
                "lastName": str(row["last_name"]),
                "email": str(row["email"]),
                "authProvider": str(row["auth_provider"]),
                "publicProfileId": row["public_profile_id"],
                "publicTwinUrl": (
                    frontend_public_link(
                        first_name=str(row["candidate_first_name"]),
                        second_name=str(row["candidate_second_name"]),
                        public_profile_id=str(row["public_profile_id"]),
                    )
                    if row["public_profile_id"]
                    else None
                ),
                "persona": row["persona"],
                "uploadStatus": row["upload_status"],
                "cvProcessingStatus": row["cv_processing_status"],
                "totalRequests": int(row["total_requests"]),
                "totalTokens": int(row["total_tokens"]),
                "totalCost": _decimal_to_float(row["total_cost"]),
                "createdAt": row["created_at"],
                "lastActivityAt": row["last_activity_at"],
            }
            for row in user_rows
        ],
        "usage": [
            {
                "userId": str(row["user_id"]),
                "email": str(row["email"]),
                "publicProfileId": str(row["public_profile_id"]),
                "publicTwinUrl": frontend_public_link(
                    first_name=str(row["first_name"]),
                    second_name=str(row["second_name"]),
                    public_profile_id=str(row["public_profile_id"]),
                ),
                "requestsSent": int(row["requests_sent"]),
                "promptTokens": int(row["prompt_tokens"]),
                "completionTokens": int(row["completion_tokens"]),
                "totalTokens": int(row["total_tokens"]),
                "totalCost": _decimal_to_float(row["total_cost"]),
                "lastRequestAt": row["last_request_at"],
            }
            for row in usage_rows
        ],
        "subscriptions": [
            {
                "userId": str(row["user_id"]),
                "email": str(row["email"]),
                "publicProfileId": row["public_profile_id"],
                "publicTwinUrl": (
                    frontend_public_link(
                        first_name=str(row["first_name"]),
                        second_name=str(row["second_name"]),
                        public_profile_id=str(row["public_profile_id"]),
                    )
                    if row["public_profile_id"]
                    else None
                ),
                "status": str(row["status"]) if row["status"] else "inactive",
                "planLabel": (
                    "Manual access"
                    if row["manual_access_granted_by_email"]
                    else PLAN_LABEL
                    if row["status"] == "active"
                    else "Free plan"
                ),
                "freePublicChatsUsed": int(row["free_public_chat_count"] or 0),
                "freePublicChatsLimit": free_public_chat_limit,
                "accessStartsAt": row["access_starts_at"],
                "accessExpiresAt": row["access_expires_at"],
                "manualAccessGrantedByEmail": row["manual_access_granted_by_email"],
                "manualAccessGrantedAt": row["manual_access_granted_at"],
                "updatedAt": row["updated_at"],
            }
            for row in subscription_rows
        ],
    }
