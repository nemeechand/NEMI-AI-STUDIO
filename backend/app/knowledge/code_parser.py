from __future__ import annotations

import re
from dataclasses import dataclass, field

# Sprint 14: a deliberately lightweight, regex-based structural scan — NOT a
# full multi-language AST parser (tree-sitter or per-language compiler
# front-ends would be their own sprint). It recognizes common top-level
# declaration shapes in Python and JavaScript/TypeScript well enough to
# populate the knowledge graph's function/class nodes and import edges, and
# is honest about its limits: it can miss dynamically-generated declarations,
# decorators-only class bodies, or unusual formatting, and it does not
# understand scope (a function defined inside another function is still
# reported as top-level). This is documented in docs/ARCHITECTURE.md.

LANGUAGE_BY_EXTENSION: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".json": "json",
    ".md": "markdown",
    ".css": "css",
    ".html": "html",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".toml": "toml",
    ".sql": "sql",
}

# Only these languages get function/class/import extraction — everything
# else in LANGUAGE_BY_EXTENSION still gets a `file` graph node, just no
# children.
_PARSEABLE_LANGUAGES = {"python", "javascript", "typescript"}

_PY_DEF_RE = re.compile(r"^[ \t]*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", re.MULTILINE)
_PY_CLASS_RE = re.compile(r"^[ \t]*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]", re.MULTILINE)
_PY_IMPORT_RE = re.compile(
    r"^\s*(?:from\s+([.\w]+)\s+import\s+|import\s+([.\w]+))", re.MULTILINE
)

_JS_FUNCTION_RE = re.compile(
    r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)\s*\(",
    re.MULTILINE,
)
_JS_ARROW_RE = re.compile(
    r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>",
    re.MULTILINE,
)
_JS_CLASS_RE = re.compile(
    r"^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)", re.MULTILINE
)
_JS_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:[\w${},*\s]+\s+from\s+)?['"]([^'"]+)['"])"""
    r"""|(?:require\(\s*['"]([^'"]+)['"]\s*\))""",
)


@dataclass
class ParsedSymbol:
    name: str
    kind: str  # "function" | "class"


@dataclass
class ParsedFile:
    functions: list[ParsedSymbol] = field(default_factory=list)
    classes: list[ParsedSymbol] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)


def language_for_path(relative_path: str) -> str | None:
    for ext, language in LANGUAGE_BY_EXTENSION.items():
        if relative_path.lower().endswith(ext):
            return language
    return None


def is_parseable(language: str | None) -> bool:
    return language in _PARSEABLE_LANGUAGES


def parse_source(content: str, language: str) -> ParsedFile:
    """Best-effort structural scan — see module docstring for its honest
    limits. Never raises: malformed/unusual source just yields fewer (or
    zero) matches rather than an error, since indexing must survive
    arbitrary real-world files."""
    if language == "python":
        return _parse_python(content)
    if language in ("javascript", "typescript"):
        return _parse_js(content)
    return ParsedFile()


def _parse_python(content: str) -> ParsedFile:
    functions = [
        ParsedSymbol(name=m.group(1), kind="function") for m in _PY_DEF_RE.finditer(content)
    ]
    classes = [
        ParsedSymbol(name=m.group(1), kind="class") for m in _PY_CLASS_RE.finditer(content)
    ]
    imports = []
    for match in _PY_IMPORT_RE.finditer(content):
        module = match.group(1) or match.group(2)
        if module:
            imports.append(module)
    return ParsedFile(functions=functions, classes=classes, imports=imports)


def _parse_js(content: str) -> ParsedFile:
    functions = [
        ParsedSymbol(name=m.group(1), kind="function") for m in _JS_FUNCTION_RE.finditer(content)
    ]
    functions += [
        ParsedSymbol(name=m.group(1), kind="function") for m in _JS_ARROW_RE.finditer(content)
    ]
    classes = [ParsedSymbol(name=m.group(1), kind="class") for m in _JS_CLASS_RE.finditer(content)]
    imports = []
    for match in _JS_IMPORT_RE.finditer(content):
        module = match.group(1) or match.group(2)
        if module:
            imports.append(module)
    return ParsedFile(functions=functions, classes=classes, imports=imports)
