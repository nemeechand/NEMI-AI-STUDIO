from __future__ import annotations

from app.knowledge.code_parser import is_parseable, language_for_path, parse_source


def test_language_for_path_recognizes_common_extensions() -> None:
    assert language_for_path("app/main.py") == "python"
    assert language_for_path("src/App.tsx") == "typescript"
    assert language_for_path("src/index.js") == "javascript"
    assert language_for_path("README.md") == "markdown"
    assert language_for_path("weird.xyz") is None


def test_is_parseable_only_for_code_languages() -> None:
    assert is_parseable("python") is True
    assert is_parseable("javascript") is True
    assert is_parseable("markdown") is False
    assert is_parseable(None) is False


def test_parse_python_extracts_functions_classes_and_imports() -> None:
    source = """
import os
from app.db.connection import get_connection

class FooRepository:
    def get(self, id):
        return id

async def run_cycle(settings):
    pass
"""
    parsed = parse_source(source, "python")

    assert {f.name for f in parsed.functions} == {"get", "run_cycle"}
    assert {c.name for c in parsed.classes} == {"FooRepository"}
    assert "os" in parsed.imports
    assert "app.db.connection" in parsed.imports


def test_parse_javascript_extracts_functions_classes_and_imports() -> None:
    source = """
import React from 'react';
import { useProject } from '../project/useProject';

export function useWorkflows() {
  return null;
}

const useAgents = (projectId) => {
  return null;
};

export class WorkflowsProvider {
  render() {}
}
"""
    parsed = parse_source(source, "javascript")

    assert {f.name for f in parsed.functions} == {"useWorkflows", "useAgents"}
    assert {c.name for c in parsed.classes} == {"WorkflowsProvider"}
    assert "react" in parsed.imports
    assert "../project/useProject" in parsed.imports


def test_parse_source_never_raises_on_garbage_input() -> None:
    parsed = parse_source("\x00\x01 not really code {{{ ]]", "python")
    assert parsed.functions == []
    assert parsed.classes == []
