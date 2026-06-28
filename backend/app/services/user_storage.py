from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from ..core.config import get_settings
from ..schemas import SavedItem, UserWorkspace


def _user_dir(user_id: str) -> Path:
    path = get_settings().data_dir / "users" / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _workspace_path(user_id: str) -> Path:
    return _user_dir(user_id) / "workspace.json"


def get_workspace(user_id: str) -> UserWorkspace:
    path = _workspace_path(user_id)
    if not path.exists():
        return UserWorkspace(user_id=user_id)
    try:
        return UserWorkspace.model_validate(json.loads(path.read_text(encoding="utf-8")))
    except Exception:
        return UserWorkspace(user_id=user_id)


def save_workspace(workspace: UserWorkspace) -> UserWorkspace:
    path = _workspace_path(workspace.user_id)
    path.write_text(json.dumps(workspace.model_dump(mode="json"), indent=2, default=str), encoding="utf-8")
    return workspace


def upsert_user_profile(user_id: str, name: str | None, email: str | None, image: str | None) -> UserWorkspace:
    workspace = get_workspace(user_id)
    workspace.name = name or workspace.name
    workspace.email = email or workspace.email
    workspace.image = image or workspace.image
    return save_workspace(workspace)


def add_recent_search(user_id: str, ticker: str) -> UserWorkspace:
    workspace = get_workspace(user_id)
    ticker = ticker.upper().strip()
    workspace.recent_searches = [ticker, *[item for item in workspace.recent_searches if item != ticker]][:12]
    return save_workspace(workspace)


def toggle_favorite(user_id: str, ticker: str) -> UserWorkspace:
    workspace = get_workspace(user_id)
    ticker = ticker.upper().strip()
    if ticker in workspace.favorites:
        workspace.favorites = [item for item in workspace.favorites if item != ticker]
    else:
        workspace.favorites = [ticker, *workspace.favorites][:50]
    return save_workspace(workspace)


def save_item(user_id: str, item_type: str, title: str, payload: dict) -> SavedItem:
    workspace = get_workspace(user_id)
    now = datetime.now(timezone.utc)
    item = SavedItem(
        item_id=str(uuid4()),
        item_type=item_type,  # type: ignore[arg-type]
        title=title,
        payload=payload,
        created_at=now,
        updated_at=now,
    )
    workspace.saved_items = [item, *workspace.saved_items][:100]
    save_workspace(workspace)
    return item


def list_saved_items(user_id: str, item_type: str | None = None) -> list[SavedItem]:
    workspace = get_workspace(user_id)
    if item_type is None:
        return workspace.saved_items
    return [item for item in workspace.saved_items if item.item_type == item_type]
