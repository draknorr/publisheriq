"""Database package exports with lazy imports to avoid settings side effects at import time."""

from importlib import import_module
from typing import Any

__all__ = ["SupabaseClient", "PICSDatabase"]


def __getattr__(name: str) -> Any:
    if name == "SupabaseClient":
        return import_module(".client", __name__).SupabaseClient
    if name == "PICSDatabase":
        return import_module(".operations", __name__).PICSDatabase
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
