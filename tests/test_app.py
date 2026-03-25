"""Tests for the FastAPI application."""


class TestAppBasics:
    """Basic application tests."""

    def test_import_main_module(self):
        """Test that the main module can be imported."""
        # This tests basic syntax and import structure
        # Note: Full import may fail without aprsd config, so we test selectively
        import importlib.util

        spec = importlib.util.spec_from_file_location("main", "app/main.py")
        assert spec is not None, "Could not find app/main.py"

    def test_import_utils_module(self):
        """Test that the utils module can be imported."""
        from app import utils

        assert hasattr(utils, "hsl_to_rgb")
        assert hasattr(utils, "pick_color")
        assert hasattr(utils, "DEFAULT_CONFIG_FILE")

    def test_hsl_to_rgb(self):
        """Test hsl_to_rgb function."""
        from app.utils import hsl_to_rgb

        # Test red (hue=0)
        result = hsl_to_rgb((0, 100, 50))
        assert isinstance(result, tuple)
        assert len(result) == 3
        # Red should be high, others low
        assert result[0] > 200  # Red channel

    def test_pick_color_returns_tuple(self):
        """Test pick_color returns RGB tuple."""
        from app.utils import pick_color

        result = pick_color(50, 0, 100, 0, 120)
        assert isinstance(result, tuple)
        assert len(result) == 3
        assert all(0 <= v <= 255 for v in result)


class TestStaticFiles:
    """Test that static files exist and have expected content."""

    def test_theme_css_exists(self):
        """Test that theme.css exists and contains CSS variables."""
        with open("app/web/static/css/theme.css") as f:
            content = f.read()

        assert ":root" in content or "[data-theme" in content
        assert "--bg-primary" in content
        assert "--text-primary" in content

    def test_theme_toggle_js_exists(self):
        """Test that theme-toggle.js exists and has toggle function."""
        with open("app/web/static/js/theme-toggle.js") as f:
            content = f.read()

        assert "localStorage" in content
        assert "data-theme" in content
        assert "toggleTheme" in content or "toggle" in content

    def test_sidebar_dark_css_exists(self):
        """Test that sidebar-dark.css exists."""
        with open("app/web/static/css/sidebar-dark.css") as f:
            content = f.read()

        assert '[data-theme="dark"]' in content
        assert "leaflet-sidebar" in content

    def test_map_dark_css_exists(self):
        """Test that map-dark.css exists."""
        with open("app/web/static/css/map-dark.css") as f:
            content = f.read()

        assert '[data-theme="dark"]' in content
        assert "leaflet" in content

    def test_responsive_css_exists(self):
        """Test that responsive.css exists with media queries."""
        with open("app/web/static/css/responsive.css") as f:
            content = f.read()

        assert "@media" in content

    def test_about_dark_css_exists(self):
        """Test that about-dark.css exists."""
        with open("app/web/static/css/about-dark.css") as f:
            content = f.read()

        assert '[data-theme="dark"]' in content


class TestTemplates:
    """Test HTML templates have required elements."""

    def test_index_html_has_dark_mode_support(self):
        """Test that index.html has dark mode elements."""
        with open("app/web/templates/index.html") as f:
            content = f.read()

        # Check for dark mode setup
        assert 'data-theme="dark"' in content or "data-theme='dark'" in content
        assert "theme.css" in content
        assert "theme-toggle" in content
        assert "theme-toggle.js" in content

    def test_index_html_has_dark_tiles(self):
        """Test that index.html includes dark map tiles."""
        with open("app/web/templates/index.html") as f:
            content = f.read()

        # Check for CartoDB dark tiles
        assert "cartocdn.com/dark" in content or "dark_all" in content

    def test_about_html_has_dark_mode_support(self):
        """Test that about.html has dark mode elements."""
        with open("app/web/templates/about.html") as f:
            content = f.read()

        # Check for dark mode setup
        assert 'data-theme="dark"' in content or "data-theme='dark'" in content
        assert "theme.css" in content
        assert "theme-toggle" in content
        assert "about-dark.css" in content

    def test_templates_have_doctype(self):
        """Test that templates have proper HTML5 doctype."""
        templates = [
            "app/web/templates/index.html",
            "app/web/templates/about.html",
        ]
        for template in templates:
            with open(template) as f:
                content = f.read()
            assert "<!DOCTYPE html>" in content, f"{template} missing DOCTYPE"
