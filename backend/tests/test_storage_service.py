from types import SimpleNamespace

import pytest
from storage3.exceptions import StorageApiError

from app.services import storage_service


def test_local_storage_upload_url_and_remove(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(
        storage_service,
        "get_settings",
        lambda: SimpleNamespace(
            storage_type="local",
            local_storage_dir=str(tmp_path),
            backend_origin="http://localhost:8000",
        ),
    )

    storage_service.ensure_bucket_exists()
    storage_service.upload_file(
        path="profiles/twin_123/passport_photo/photo.png",
        content=b"image-bytes",
        content_type="image/png",
    )

    stored_path = tmp_path / "profiles" / "twin_123" / "passport_photo" / "photo.png"
    assert stored_path.read_bytes() == b"image-bytes"
    assert storage_service.get_storage_bucket_name() == "local"
    assert (
        storage_service.create_signed_url("profiles/twin_123/passport_photo/photo.png")
        == "http://localhost:8000/api/v1/profiles/assets/profiles/twin_123/passport_photo/photo.png"
    )
    assert storage_service.resolve_local_asset_path(
        "profiles/twin_123/passport_photo/photo.png"
    ) == stored_path.resolve()

    storage_service.remove_files(["profiles/twin_123/passport_photo/photo.png"])

    assert not stored_path.exists()


def test_local_storage_rejects_path_traversal(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(
        storage_service,
        "get_settings",
        lambda: SimpleNamespace(
            storage_type="local",
            local_storage_dir=str(tmp_path),
            backend_origin="http://localhost:8000",
        ),
    )

    with pytest.raises(ValueError, match="escapes"):
        storage_service.upload_file(
            path="../outside.txt",
            content=b"bad",
            content_type="text/plain",
        )


def test_supabase_signed_url_returns_empty_string_for_missing_object(monkeypatch) -> None:
    class FakeBucket:
        def create_signed_url(self, path: str, expires_in: int) -> dict[str, str]:
            raise StorageApiError("Object not found", "not_found", 404)

    class FakeStorage:
        def from_(self, bucket: str) -> FakeBucket:
            assert bucket == "digi_twin"
            return FakeBucket()

    class FakeClient:
        storage = FakeStorage()

    monkeypatch.setattr(
        storage_service,
        "get_settings",
        lambda: SimpleNamespace(
            storage_type="supabase",
            supabase_url="https://example.supabase.co",
            supabase_key="service-role-key",
            supabase_bucket="digi_twin",
        ),
    )
    monkeypatch.setattr(storage_service, "get_supabase_client", lambda: FakeClient())

    assert storage_service.create_signed_url("profiles/twin_123/passport_photo/missing.png") == ""
