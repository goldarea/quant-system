from __future__ import annotations

import json
from collections.abc import Callable
from hashlib import sha256
from pathlib import Path
from time import time
from typing import Any


def _sort_for_json(value: Any) -> Any:
    if isinstance(value, list):
        return [_sort_for_json(item) for item in value]
    if isinstance(value, dict):
        return {key: _sort_for_json(value[key]) for key in sorted(value)}
    return value


def stable_cache_key(value: Any) -> str:
    serialized = json.dumps(_sort_for_json(value), separators=(",", ":"), ensure_ascii=False)
    return sha256(serialized.encode("utf-8")).hexdigest()


class JsonCache:
    def __init__(self, directory: str | Path = ".cache/backend", now: Callable[[], float] = time) -> None:
        self.directory = Path(directory)
        self.now = now

    def path_for(self, key: Any) -> Path:
        filename = key if isinstance(key, str) and len(key) == 64 and all(char in "0123456789abcdef" for char in key) else stable_cache_key(key)
        return self.directory / f"{filename}.json"

    def get(self, key: Any, ttl_seconds: int) -> Any | None:
        try:
            entry = json.loads(self.path_for(key).read_text(encoding="utf-8"))
            created_at = entry.get("createdAt")
            if not isinstance(created_at, int | float):
                return None
            if self.now() - created_at > ttl_seconds:
                return None
            return entry.get("value")
        except (OSError, json.JSONDecodeError, TypeError):
            return None

    def set(self, key: Any, value: Any) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path_for(key).write_text(
            json.dumps({"createdAt": self.now(), "value": value}, separators=(",", ":"), ensure_ascii=False),
            encoding="utf-8",
        )
