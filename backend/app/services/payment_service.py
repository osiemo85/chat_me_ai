"""Billing and Paystack integration helpers."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import hmac
from json import JSONDecodeError, dumps, loads
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request as UrlRequest
from urllib.request import urlopen
from uuid import uuid4

from psycopg import Connection
from psycopg.types.json import Jsonb

from ..config import get_settings
from ..db import get_connection
from .auth_service import ensure_auth_schema
from .profile_service import ensure_schema

PAYSTACK_VERIFY_URL = "https://api.paystack.co/transaction/verify"
PLAN_LABEL = "KES 5 yearly"
PLAN_CURRENCY = "KES"
PLAN_AMOUNT_DISPLAY = "KES 5"

PAYMENT_SCHEMA_SQL = """
create table if not exists billing_access (
  id uuid primary key,
  owner_user_id uuid not null references auth_users(id) on delete cascade,
  candidate_profile_id uuid not null references candidate_profiles(id) on delete cascade,
  status varchar(20) not null default 'inactive',
  free_public_chat_count integer not null default 0,
  access_starts_at timestamptz,
  access_expires_at timestamptz,
  paystack_customer_code varchar(120),
  paystack_subscription_code varchar(120),
  paystack_email_token varchar(255),
  last_payment_reference varchar(255),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists billing_access_owner_user_id_unique
  on billing_access (owner_user_id);

create unique index if not exists billing_access_candidate_profile_id_unique
  on billing_access (candidate_profile_id);

create table if not exists payment_transactions (
  id uuid primary key,
  owner_user_id uuid not null references auth_users(id) on delete cascade,
  candidate_profile_id uuid not null references candidate_profiles(id) on delete cascade,
  reference varchar(255) not null unique,
  paystack_event_type varchar(120),
  status varchar(30) not null,
  amount integer,
  currency varchar(10),
  customer_code varchar(120),
  subscription_code varchar(120),
  paid_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
"""


def _now() -> datetime:
    return datetime.now(UTC)


def _parse_datetime(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None

    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)

    return parsed.astimezone(UTC)


def _build_callback_url() -> str:
    base_url = get_settings().app_public_base_url.rstrip("/")
    return f"{base_url}/billing/paystack/callback"


def _free_public_chat_limit() -> int:
    configured_limit = get_settings().free_public_chat_limit
    return configured_limit if configured_limit > 0 else 2


def ensure_payment_schema() -> None:
    """Ensure billing and payment tables exist."""

    ensure_auth_schema()
    ensure_schema()

    with get_connection(autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(PAYMENT_SCHEMA_SQL)


def _candidate_for_user(connection: Connection, user_id: str) -> dict[str, object] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select id, user_id, public_profile_id, email
            from candidate_profiles
            where user_id = %s
            limit 1
            """,
            (user_id,),
        )
        return cursor.fetchone()


def _owner_and_candidate_for_email(connection: Connection, email: str) -> dict[str, object] | None:
    normalized_email = email.strip().lower()

    with connection.cursor() as cursor:
        cursor.execute(
            """
            select cp.id as candidate_profile_id, cp.user_id as owner_user_id, cp.email
            from candidate_profiles cp
            where lower(cp.email) = %s
              and cp.user_id is not null
            limit 1
            """,
            (normalized_email,),
        )
        return cursor.fetchone()


def _get_user_email(connection: Connection, user_id: str) -> str | None:
    with connection.cursor() as cursor:
        cursor.execute(
            "select email from auth_users where id = %s limit 1",
            (user_id,),
        )
        row = cursor.fetchone()

    if not row:
        return None

    return str(row["email"]).strip().lower()


def _get_billing_access_row(
    connection: Connection,
    *,
    owner_user_id: str,
    candidate_profile_id: str,
    for_update: bool = False,
) -> dict[str, object] | None:
    suffix = " for update" if for_update else ""
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            select *
            from billing_access
            where owner_user_id = %s
              and candidate_profile_id = %s
            limit 1{suffix}
            """,
            (owner_user_id, candidate_profile_id),
        )
        return cursor.fetchone()


def _create_billing_access(
    connection: Connection,
    *,
    owner_user_id: str,
    candidate_profile_id: str,
) -> dict[str, object]:
    now = _now()
    billing_access_id = str(uuid4())

    with connection.cursor() as cursor:
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
            (billing_access_id, owner_user_id, candidate_profile_id, now, now),
        )
        row = cursor.fetchone()

    if row is None:
        raise RuntimeError("Unable to create billing access.")

    return row


def get_or_create_billing_access_for_user(user_id: str) -> dict[str, object]:
    """Return the billing access row for a profile owner, creating it if needed."""

    ensure_payment_schema()

    with get_connection() as connection:
        candidate = _candidate_for_user(connection, user_id)
        if not candidate:
            raise LookupError("Profile not found.")

        row = _get_billing_access_row(
            connection,
            owner_user_id=user_id,
            candidate_profile_id=str(candidate["id"]),
            for_update=True,
        )
        if row is None:
            row = _create_billing_access(
                connection,
                owner_user_id=user_id,
                candidate_profile_id=str(candidate["id"]),
            )
        connection.commit()

    return row


def _is_active_row(row: dict[str, object] | None) -> bool:
    if not row or str(row.get("status") or "inactive") != "active":
        return False

    expires_at = row.get("access_expires_at")
    if isinstance(expires_at, datetime):
        expires_at = expires_at.astimezone(UTC) if expires_at.tzinfo else expires_at.replace(tzinfo=UTC)
        return expires_at > _now()

    return True


def _status_payload_from_row(row: dict[str, object] | None) -> dict[str, object]:
    active = _is_active_row(row)
    free_count = int(row["free_public_chat_count"]) if row else 0
    free_limit = _free_public_chat_limit()
    return {
        "status": "active" if active else str(row["status"]) if row and row.get("status") else "inactive",
        "freePublicChatsUsed": free_count,
        "freePublicChatsLimit": free_limit,
        "accessStartsAt": row.get("access_starts_at") if row else None,
        "accessExpiresAt": row.get("access_expires_at") if active else row.get("access_expires_at") if row else None,
        "hostedPlanUrl": get_settings().paystack_hosted_plan_url,
        "paymentRequired": not active,
        "planLabel": PLAN_LABEL,
        "currency": PLAN_CURRENCY,
        "amountDisplay": PLAN_AMOUNT_DISPLAY,
    }


def get_billing_status_for_user(user_id: str) -> dict[str, object]:
    """Return billing status for the current owner."""

    ensure_payment_schema()

    with get_connection() as connection:
        candidate = _candidate_for_user(connection, user_id)
        if not candidate:
            return _status_payload_from_row(None)

        row = _get_billing_access_row(
            connection,
            owner_user_id=user_id,
            candidate_profile_id=str(candidate["id"]),
            for_update=True,
        )
        if row is None:
            row = _create_billing_access(
                connection,
                owner_user_id=user_id,
                candidate_profile_id=str(candidate["id"]),
            )
        connection.commit()

    return _status_payload_from_row(row)


def build_hosted_checkout_link(user_id: str) -> dict[str, object]:
    """Return the hosted Paystack plan URL and frontend callback URL."""

    get_or_create_billing_access_for_user(user_id)
    return {
        "hostedUrl": get_settings().paystack_hosted_plan_url,
        "callbackUrl": _build_callback_url(),
    }


def _paystack_secret_key() -> str:
    secret_key = (get_settings().paystack_secret_key or "").strip()
    if not secret_key:
        raise RuntimeError("PAYSTACK_SECRET_KEY is not configured.")
    return secret_key


def _paystack_api_request(url: str) -> dict[str, object]:
    request = UrlRequest(
        url,
        headers={"Authorization": f"Bearer {_paystack_secret_key()}"},
        method="GET",
    )

    try:
        with urlopen(request, timeout=15) as response:
            return loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = "Unable to verify the Paystack transaction."
        try:
            payload = loads(exc.read().decode("utf-8"))
            if isinstance(payload, dict) and isinstance(payload.get("message"), str):
                detail = str(payload["message"])
        except (OSError, JSONDecodeError):
            pass
        raise RuntimeError(detail) from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError("Paystack verification is temporarily unavailable.") from exc


def _resolve_access_window(data: dict[str, object]) -> tuple[datetime, datetime | None]:
    starts_at = (
        _parse_datetime(data.get("paid_at"))
        or _parse_datetime(data.get("created_at"))
        or _now()
    )

    expires_at = (
        _parse_datetime(data.get("next_payment_date"))
        or _parse_datetime(data.get("current_period_end"))
        or _parse_datetime(data.get("period_end"))
    )

    if expires_at is None:
        expires_at = starts_at + timedelta(days=365)

    return starts_at, expires_at


def _reference_from_event(event_type: str, data: dict[str, object]) -> str:
    reference = data.get("reference")
    if isinstance(reference, str) and reference.strip():
        return reference.strip()

    subscription_code = data.get("subscription_code")
    if isinstance(subscription_code, str) and subscription_code.strip():
        return f"{event_type}:{subscription_code.strip()}"

    customer = data.get("customer")
    if isinstance(customer, dict):
        customer_code = customer.get("customer_code")
        if isinstance(customer_code, str) and customer_code.strip():
            return f"{event_type}:{customer_code.strip()}"

    payload_hash = hashlib.sha256(dumps(data, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return f"{event_type}:{payload_hash}"


def _store_transaction(
    connection: Connection,
    *,
    owner_user_id: str,
    candidate_profile_id: str,
    reference: str,
    event_type: str,
    status: str,
    amount: int | None,
    currency: str | None,
    customer_code: str | None,
    subscription_code: str | None,
    paid_at: datetime | None,
    raw_payload: dict[str, object],
) -> None:
    now = _now()
    with connection.cursor() as cursor:
        cursor.execute(
            """
            insert into payment_transactions (
              id,
              owner_user_id,
              candidate_profile_id,
              reference,
              paystack_event_type,
              status,
              amount,
              currency,
              customer_code,
              subscription_code,
              paid_at,
              raw_payload,
              created_at,
              updated_at
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (reference) do update set
              paystack_event_type = excluded.paystack_event_type,
              status = excluded.status,
              amount = excluded.amount,
              currency = excluded.currency,
              customer_code = excluded.customer_code,
              subscription_code = excluded.subscription_code,
              paid_at = excluded.paid_at,
              raw_payload = excluded.raw_payload,
              updated_at = excluded.updated_at
            """,
            (
                str(uuid4()),
                owner_user_id,
                candidate_profile_id,
                reference,
                event_type,
                status,
                amount,
                currency,
                customer_code,
                subscription_code,
                paid_at,
                Jsonb(raw_payload),
                now,
                now,
            ),
        )


def _update_billing_access(
    connection: Connection,
    *,
    owner_user_id: str,
    candidate_profile_id: str,
    status: str,
    access_starts_at: datetime | None,
    access_expires_at: datetime | None,
    paystack_customer_code: str | None,
    paystack_subscription_code: str | None,
    paystack_email_token: str | None,
    last_payment_reference: str | None,
) -> dict[str, object]:
    row = _get_billing_access_row(
        connection,
        owner_user_id=owner_user_id,
        candidate_profile_id=candidate_profile_id,
        for_update=True,
    )
    now = _now()

    if row is None:
        row = _create_billing_access(
            connection,
            owner_user_id=owner_user_id,
            candidate_profile_id=candidate_profile_id,
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            update billing_access
            set status = %s,
                access_starts_at = %s,
                access_expires_at = %s,
                paystack_customer_code = %s,
                paystack_subscription_code = %s,
                paystack_email_token = %s,
                last_payment_reference = %s,
                updated_at = %s
            where id = %s
            returning *
            """,
            (
                status,
                access_starts_at,
                access_expires_at,
                paystack_customer_code,
                paystack_subscription_code,
                paystack_email_token,
                last_payment_reference,
                now,
                row["id"],
            ),
        )
        updated_row = cursor.fetchone()

    if updated_row is None:
        raise RuntimeError("Unable to update billing access.")

    return updated_row


def _candidate_from_paystack_customer(
    connection: Connection,
    data: dict[str, object],
) -> tuple[str, str, str]:
    customer = data.get("customer")
    if not isinstance(customer, dict):
        raise LookupError("Paystack payload is missing customer data.")

    email = customer.get("email")
    if not isinstance(email, str) or not email.strip():
        raise LookupError("Paystack payload is missing a customer email.")

    row = _owner_and_candidate_for_email(connection, email)
    if not row:
        raise LookupError("No owner profile matches the Paystack customer.")

    return (
        str(row["owner_user_id"]),
        str(row["candidate_profile_id"]),
        email.strip().lower(),
    )


def _activate_from_payload(
    connection: Connection,
    *,
    event_type: str,
    data: dict[str, object],
    owner_user_id: str,
    candidate_profile_id: str,
) -> dict[str, object]:
    customer = data.get("customer") if isinstance(data.get("customer"), dict) else {}
    subscription = data.get("subscription") if isinstance(data.get("subscription"), dict) else {}
    starts_at, expires_at = _resolve_access_window(data)
    reference = _reference_from_event(event_type, data)
    status = str(data.get("status") or "success")

    _store_transaction(
        connection,
        owner_user_id=owner_user_id,
        candidate_profile_id=candidate_profile_id,
        reference=reference,
        event_type=event_type,
        status=status,
        amount=int(data["amount"]) if isinstance(data.get("amount"), int) else None,
        currency=str(data["currency"]) if isinstance(data.get("currency"), str) else None,
        customer_code=str(customer["customer_code"]) if isinstance(customer, dict) and isinstance(customer.get("customer_code"), str) else None,
        subscription_code=(
            str(subscription["subscription_code"])
            if isinstance(subscription, dict) and isinstance(subscription.get("subscription_code"), str)
            else str(data["subscription_code"])
            if isinstance(data.get("subscription_code"), str)
            else None
        ),
        paid_at=_parse_datetime(data.get("paid_at")),
        raw_payload={"event": event_type, "data": data},
    )

    return _update_billing_access(
        connection,
        owner_user_id=owner_user_id,
        candidate_profile_id=candidate_profile_id,
        status="active",
        access_starts_at=starts_at,
        access_expires_at=expires_at,
        paystack_customer_code=(
            str(customer["customer_code"])
            if isinstance(customer, dict) and isinstance(customer.get("customer_code"), str)
            else None
        ),
        paystack_subscription_code=(
            str(subscription["subscription_code"])
            if isinstance(subscription, dict) and isinstance(subscription.get("subscription_code"), str)
            else str(data["subscription_code"])
            if isinstance(data.get("subscription_code"), str)
            else None
        ),
        paystack_email_token=(
            str(subscription["email_token"])
            if isinstance(subscription, dict) and isinstance(subscription.get("email_token"), str)
            else str(data["email_token"])
            if isinstance(data.get("email_token"), str)
            else None
        ),
        last_payment_reference=reference,
    )


def _deactivate_from_payload(
    connection: Connection,
    *,
    event_type: str,
    data: dict[str, object],
    owner_user_id: str,
    candidate_profile_id: str,
) -> None:
    customer = data.get("customer") if isinstance(data.get("customer"), dict) else {}
    subscription = data.get("subscription") if isinstance(data.get("subscription"), dict) else {}
    reference = _reference_from_event(event_type, data)

    _store_transaction(
        connection,
        owner_user_id=owner_user_id,
        candidate_profile_id=candidate_profile_id,
        reference=reference,
        event_type=event_type,
        status=str(data.get("status") or "inactive"),
        amount=int(data["amount"]) if isinstance(data.get("amount"), int) else None,
        currency=str(data["currency"]) if isinstance(data.get("currency"), str) else None,
        customer_code=str(customer["customer_code"]) if isinstance(customer, dict) and isinstance(customer.get("customer_code"), str) else None,
        subscription_code=(
            str(subscription["subscription_code"])
            if isinstance(subscription, dict) and isinstance(subscription.get("subscription_code"), str)
            else str(data["subscription_code"])
            if isinstance(data.get("subscription_code"), str)
            else None
        ),
        paid_at=_parse_datetime(data.get("paid_at")),
        raw_payload={"event": event_type, "data": data},
    )

    _update_billing_access(
        connection,
        owner_user_id=owner_user_id,
        candidate_profile_id=candidate_profile_id,
        status="inactive",
        access_starts_at=_parse_datetime(data.get("created_at")),
        access_expires_at=_parse_datetime(data.get("next_payment_date")) or _parse_datetime(data.get("period_end")),
        paystack_customer_code=(
            str(customer["customer_code"])
            if isinstance(customer, dict) and isinstance(customer.get("customer_code"), str)
            else None
        ),
        paystack_subscription_code=(
            str(subscription["subscription_code"])
            if isinstance(subscription, dict) and isinstance(subscription.get("subscription_code"), str)
            else str(data["subscription_code"])
            if isinstance(data.get("subscription_code"), str)
            else None
        ),
        paystack_email_token=(
            str(subscription["email_token"])
            if isinstance(subscription, dict) and isinstance(subscription.get("email_token"), str)
            else str(data["email_token"])
            if isinstance(data.get("email_token"), str)
            else None
        ),
        last_payment_reference=reference,
    )


def verify_paystack_transaction(reference: str, user_id: str) -> dict[str, object]:
    """Verify a Paystack transaction and update local billing entitlement."""

    ensure_payment_schema()
    payload = _paystack_api_request(f"{PAYSTACK_VERIFY_URL}/{quote(reference)}")
    if payload.get("status") is not True:
        raise ValueError("Paystack did not confirm this transaction.")

    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("Paystack returned an invalid verification payload.")

    if str(data.get("status") or "").lower() != "success":
        raise ValueError("Paystack did not confirm a successful payment.")

    with get_connection() as connection:
        customer = data.get("customer")
        if not isinstance(customer, dict):
            raise ValueError("Paystack payload is missing customer data.")

        customer_email = customer.get("email")
        expected_email = _get_user_email(connection, user_id)
        if (
            not isinstance(customer_email, str)
            or not customer_email.strip()
            or not expected_email
            or customer_email.strip().lower() != expected_email
        ):
            raise PermissionError("This payment does not belong to the current user.")

        candidate = _candidate_for_user(connection, user_id)
        if not candidate:
            raise LookupError("Profile not found.")

        billing_row = _activate_from_payload(
            connection,
            event_type="transaction.verify",
            data=data,
            owner_user_id=user_id,
            candidate_profile_id=str(candidate["id"]),
        )
        connection.commit()

    return {
        "status": "active" if _is_active_row(billing_row) else str(billing_row["status"]),
        "accessStartsAt": billing_row.get("access_starts_at"),
        "accessExpiresAt": billing_row.get("access_expires_at"),
        "reference": reference,
    }


def process_paystack_webhook(headers: dict[str, str], body: bytes) -> None:
    """Validate and apply Paystack webhook events idempotently."""

    ensure_payment_schema()

    expected_signature = hmac.new(
        _paystack_secret_key().encode("utf-8"),
        body,
        hashlib.sha512,
    ).hexdigest()
    signature = headers.get("x-paystack-signature", "")

    if not signature or not hmac.compare_digest(signature, expected_signature):
        raise ValueError("Invalid Paystack signature.")

    try:
        payload = loads(body.decode("utf-8"))
    except (UnicodeDecodeError, JSONDecodeError) as exc:
        raise ValueError("Invalid Paystack payload.") from exc

    if not isinstance(payload, dict):
        raise ValueError("Invalid Paystack payload.")

    event_type = payload.get("event")
    data = payload.get("data")
    if not isinstance(event_type, str) or not isinstance(data, dict):
        raise ValueError("Invalid Paystack payload.")

    with get_connection() as connection:
        owner_user_id, candidate_profile_id, _ = _candidate_from_paystack_customer(connection, data)
        if event_type == "charge.success":
            _activate_from_payload(
                connection,
                event_type=event_type,
                data=data,
                owner_user_id=owner_user_id,
                candidate_profile_id=candidate_profile_id,
            )
        elif event_type in {"subscription.create", "subscription.enable"}:
            _activate_from_payload(
                connection,
                event_type=event_type,
                data=data,
                owner_user_id=owner_user_id,
                candidate_profile_id=candidate_profile_id,
            )
        elif event_type in {"subscription.disable", "subscription.not_renew"}:
            _deactivate_from_payload(
                connection,
                event_type=event_type,
                data=data,
                owner_user_id=owner_user_id,
                candidate_profile_id=candidate_profile_id,
            )
        else:
            _store_transaction(
                connection,
                owner_user_id=owner_user_id,
                candidate_profile_id=candidate_profile_id,
                reference=_reference_from_event(event_type, data),
                event_type=event_type,
                status=str(data.get("status") or "received"),
                amount=int(data["amount"]) if isinstance(data.get("amount"), int) else None,
                currency=str(data["currency"]) if isinstance(data.get("currency"), str) else None,
                customer_code=(
                    str(data["customer"]["customer_code"])
                    if isinstance(data.get("customer"), dict)
                    and isinstance(data["customer"].get("customer_code"), str)
                    else None
                ),
                subscription_code=(
                    str(data["subscription_code"])
                    if isinstance(data.get("subscription_code"), str)
                    else None
                ),
                paid_at=_parse_datetime(data.get("paid_at")),
                raw_payload={"event": event_type, "data": data},
            )
        connection.commit()


def is_billing_active_for_public_profile(public_profile_id: str) -> bool:
    """Return whether the public twin currently has active billing."""

    ensure_payment_schema()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select ba.*
                from candidate_profiles cp
                left join billing_access ba
                  on ba.candidate_profile_id = cp.id
                where cp.public_profile_id = %s
                limit 1
                """,
                (public_profile_id,),
            )
            row = cursor.fetchone()

    return _is_active_row(row)


def consume_free_public_chat_if_allowed(public_profile_id: str) -> bool:
    """Consume one free public chat when billing is inactive and quota remains."""

    ensure_payment_schema()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select cp.id as candidate_profile_id, cp.user_id as owner_user_id
                from candidate_profiles cp
                where cp.public_profile_id = %s
                limit 1
                for update
                """,
                (public_profile_id,),
            )
            candidate = cursor.fetchone()

        if not candidate:
            raise LookupError("Profile not found.")

        owner_user_id = candidate.get("owner_user_id")
        if owner_user_id is None:
            raise LookupError("Profile owner not found.")

        row = _get_billing_access_row(
            connection,
            owner_user_id=str(owner_user_id),
            candidate_profile_id=str(candidate["candidate_profile_id"]),
            for_update=True,
        )
        if row is None:
            row = _create_billing_access(
                connection,
                owner_user_id=str(owner_user_id),
                candidate_profile_id=str(candidate["candidate_profile_id"]),
            )

        if _is_active_row(row):
            connection.commit()
            return True

        current_count = int(row["free_public_chat_count"])
        if current_count >= _free_public_chat_limit():
            connection.commit()
            return False

        with connection.cursor() as cursor:
            cursor.execute(
                """
                update billing_access
                set free_public_chat_count = free_public_chat_count + 1,
                    updated_at = %s
                where id = %s
                """,
                (_now(), row["id"]),
            )
        connection.commit()

    return True


def release_consumed_free_public_chat(public_profile_id: str) -> None:
    """Return a consumed free public chat to the twin after a failed response."""

    ensure_payment_schema()

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                update billing_access ba
                set free_public_chat_count = greatest(ba.free_public_chat_count - 1, 0),
                    updated_at = %s
                from candidate_profiles cp
                where cp.public_profile_id = %s
                  and ba.candidate_profile_id = cp.id
                  and ba.status <> 'active'
                """,
                (_now(), public_profile_id),
            )
        connection.commit()