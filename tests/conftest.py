"""Pytest configuration and fixtures."""

import sys
from pathlib import Path

import pytest

# Add the project root to the path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


@pytest.fixture
def project_root_path():
    """Return the project root path."""
    return project_root


@pytest.fixture
def static_css_path(project_root_path):
    """Return the static CSS directory path."""
    return project_root_path / "app" / "web" / "static" / "css"


@pytest.fixture
def static_js_path(project_root_path):
    """Return the static JS directory path."""
    return project_root_path / "app" / "web" / "static" / "js"


@pytest.fixture
def templates_path(project_root_path):
    """Return the templates directory path."""
    return project_root_path / "app" / "web" / "templates"
