# Sprint 15.6: kept in sync with frontend/package.json's "version" field
# (electron-builder stamps the same string into the installer/portable
# artifact names) — a production-stabilization audit found this had
# drifted, along with a hand-maintained duplicate in AboutTab.tsx (now
# reads the real value via window.nemi.backend.getAppInfo() instead).
__version__ = "0.1.0-alpha.1"
