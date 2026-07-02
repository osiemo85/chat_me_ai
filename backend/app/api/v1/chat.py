"""Public digital twin chat routes."""

from fastapi import APIRouter, HTTPException, status

from ...schemas.chat import PublicChatRequest, PublicChatResponse
from ...services.chat_service import answer_public_question_with_usage, record_chat_usage_event
from ...services.retrieval_service import get_candidate_context

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/public/{public_profile_id}", response_model=PublicChatResponse)
def chat_with_public_twin(
    public_profile_id: str,
    payload: PublicChatRequest,
) -> PublicChatResponse:
    """Answer a question against the public twin's current CV context."""

    try:
        result, usage = answer_public_question_with_usage(
            public_profile_id,
            payload.message,
            history=payload.history,
        )
        candidate = get_candidate_context(public_profile_id)
        if candidate:
            record_chat_usage_event(
                candidate=candidate,
                usage=usage,
                used_context=bool(result["usedContext"]),
                source_count=len(result["sources"]),
            )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return PublicChatResponse(**result)
