from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(autouse=True)
def stub_payment_schema_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.main.ensure_auth_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_schema", lambda: None)
    monkeypatch.setattr("app.main.ensure_payment_schema", lambda: None)
