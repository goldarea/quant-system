import pytest

from app.cache import JsonCache, stable_cache_key


def test_stable_cache_key_sorts_object_keys():
    assert stable_cache_key({"b": 1, "a": [2, {"d": 4, "c": 3}]}) == stable_cache_key({"a": [2, {"c": 3, "d": 4}], "b": 1})


def test_json_cache_respects_ttl(tmp_path):
    now = 1000
    cache = JsonCache(tmp_path, now=lambda: now)

    cache.set({"symbol": "AAPL"}, {"bars": [1]})

    assert cache.get({"symbol": "AAPL"}, ttl_seconds=60) == {"bars": [1]}

    expired = JsonCache(tmp_path, now=lambda: 1061)
    assert expired.get({"symbol": "AAPL"}, ttl_seconds=60) is None


def test_json_cache_treats_corrupt_file_as_miss(tmp_path):
    cache = JsonCache(tmp_path)
    path = cache.path_for({"symbol": "AAPL"})
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("not-json", encoding="utf-8")

    assert cache.get({"symbol": "AAPL"}, ttl_seconds=60) is None
