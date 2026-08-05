from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler

from app.core.config import Settings

_ROOT_LOGGER_NAME = "nemi"
_MAX_BYTES = 1_000_000
_BACKUP_COUNT = 3


def configure_logging(settings: Settings) -> None:
    """Configure the shared 'nemi' logger tree: console + rotating file.

    Idempotent — safe to call multiple times (e.g. across tests) without
    duplicating handlers.
    """
    root = logging.getLogger(_ROOT_LOGGER_NAME)
    root.setLevel(settings.log_level)
    root.handlers.clear()

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root.addHandler(console_handler)

    settings.log_file_path.parent.mkdir(parents=True, exist_ok=True)
    file_handler = RotatingFileHandler(
        settings.log_file_path,
        maxBytes=_MAX_BYTES,
        backupCount=_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    root.propagate = False


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"{_ROOT_LOGGER_NAME}.{name}")
