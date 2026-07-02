"""Admin dashboard reporting services."""

from __future__ import annotations

from decimal import Decimal

from ..config import get_settings
from ..db import get_connection
from .payment_service import PLAN_LABEL, ensure_payment_schema
from .profile_service import ensure_schema, frontend_public_link


def _decimal_to_float(value: object) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


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
                "planLabel": PLAN_LABEL if row["status"] == "active" else "Free plan",
                "freePublicChatsUsed": int(row["free_public_chat_count"] or 0),
                "freePublicChatsLimit": free_public_chat_limit,
                "accessStartsAt": row["access_starts_at"],
                "accessExpiresAt": row["access_expires_at"],
                "updatedAt": row["updated_at"],
            }
            for row in subscription_rows
        ],
    }
