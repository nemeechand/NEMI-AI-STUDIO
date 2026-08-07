# PyInstaller spec for the NEMI AI STUDIO backend (Sprint 8).
#
# Onedir build, not onefile — Electron spawns this fresh on every app
# launch (frontend/electron/backend-process.ts::startBackend()), so
# onefile's self-extraction-per-run would add latency to every startup.
#
# Build (from backend/): python -m PyInstaller nemi-backend.spec
# Output: backend/dist-pyinstaller/nemi-backend/

a = Analysis(
    ['app/main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        # uvicorn selects its event loop / HTTP / websocket implementation
        # dynamically at runtime ("auto" detection) — PyInstaller's static
        # analysis cannot see these without being told explicitly.
        'uvicorn.loops.auto',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan.on',
        'uvicorn.logging',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='nemi-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    # Keep as a console app: backend-process.ts pipes stdout/stderr from
    # the spawned child into Electron's console and the Logger Panel
    # (Sprint 6) — a windowed (console=False) build breaks that piping.
    console=True,
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='nemi-backend',
)
