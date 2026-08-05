from __future__ import annotations

from app.server import run_server


def main() -> int:
    """Process entry point. Blocks, running the backend HTTP server until
    the process receives an interrupt/termination signal (e.g. from
    Electron's main process stopping the child on app quit)."""
    try:
        run_server()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
