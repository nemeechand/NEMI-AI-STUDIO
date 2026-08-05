from __future__ import annotations

import logging
import sys


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
    )


def main() -> int:
    configure_logging()
    logger = logging.getLogger("nemi.backend")
    logger.info("NEMI AI STUDIO Backend — Foundation Bootstrap")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
