"""Profile upload and public profile routes."""

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from ...dependencies import require_authenticated_user
from ...services.auth_service import AuthenticatedUser
from ...schemas.profile import (
    EditableProfileResponse,
    ProfileCreateResponse,
    PublicProfileResponse,
)
from ...services.profile_service import (
    frontend_public_link,
    get_current_editable_profile_for_user,
    get_editable_profile_for_user,
    get_public_profile,
    prepare_profile_submission,
    process_profile_submission,
    validate_upload_payload,
)
from ...services.storage_service import resolve_local_asset_path

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.post("", response_model=ProfileCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    background_tasks: BackgroundTasks,
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
    first_name: str = Form(..., alias="firstName"),
    second_name: str = Form(..., alias="secondName"),
    email: str | None = Form(default=None),
    contact_email: str | None = Form(default=None, alias="contactEmail"),
    contact_phone: str | None = Form(default=None, alias="contactPhone"),
    linkedin_url: str | None = Form(default=None, alias="linkedinUrl"),
    github_url: str | None = Form(default=None, alias="githubUrl"),
    other_url: str | None = Form(default=None, alias="otherUrl"),
    persona: str = Form(...),
    cv_file: UploadFile | None = File(default=None, alias="cvFile"),
    passport_file: UploadFile | None = File(default=None, alias="passportFile"),
) -> ProfileCreateResponse:
    """Accept a profile upload and schedule background processing."""

    try:
        payload = validate_upload_payload(
            cv_bytes=await cv_file.read() if cv_file else b"",
            cv_content_type=(cv_file.content_type or "") if cv_file else None,
            cv_filename=(cv_file.filename or "cv.pdf") if cv_file else None,
            email=email or current_user.email,
            contact_email=contact_email,
            contact_phone=contact_phone,
            first_name=first_name,
            github_url=github_url,
            linkedin_url=linkedin_url,
            other_url=other_url,
            passport_bytes=await passport_file.read() if passport_file else b"",
            passport_content_type=(passport_file.content_type or "") if passport_file else None,
            passport_filename=(passport_file.filename or "passport-image") if passport_file else None,
            persona=persona,
            second_name=second_name,
            user=current_user,
        )
        prepared = prepare_profile_submission(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to prepare the profile submission.",
        ) from exc

    if prepared.requires_processing:
        background_tasks.add_task(
            process_profile_submission,
            candidate_profile_id=prepared.candidate_profile_id,
            cv_asset_id=prepared.cv_asset_id,
            cv_bytes=payload.cv_bytes,
            passport_asset_id=prepared.passport_asset_id,
            passport_bytes=payload.passport_bytes,
        )

    return ProfileCreateResponse(
        is_update=prepared.is_update,
        public_link=frontend_public_link(
            first_name=payload.first_name,
            second_name=payload.second_name,
            public_profile_id=prepared.public_profile_id,
        ),
        public_profile_id=prepared.public_profile_id,
    )


@router.get("/public/{public_profile_id}", response_model=PublicProfileResponse)
def read_public_profile(public_profile_id: str) -> PublicProfileResponse:
    """Return the public profile associated with a unique share link."""

    profile = get_public_profile(public_profile_id)

    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")

    return PublicProfileResponse(**profile)


@router.get("/assets/{asset_path:path}")
def read_local_profile_asset(asset_path: str) -> FileResponse:
    """Serve profile assets from the local storage backend."""

    try:
        file_path = resolve_local_asset_path(asset_path)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    return FileResponse(file_path)


@router.get("/edit/me", response_model=EditableProfileResponse)
def read_current_editable_profile(
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> EditableProfileResponse:
    """Return the current user's editable profile if one exists."""

    profile = get_current_editable_profile_for_user(user_id=current_user.id)

    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")

    return EditableProfileResponse(**profile)


@router.get("/edit/{public_profile_id}", response_model=EditableProfileResponse)
def read_editable_profile(
    public_profile_id: str,
    current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> EditableProfileResponse:
    """Return profile fields for the upload update flow."""

    profile = get_editable_profile_for_user(public_profile_id, user_id=current_user.id)

    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")

    return EditableProfileResponse(**profile)
