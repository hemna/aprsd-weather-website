# WXNOW Dark Mode Visual Refresh - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dark mode (default) with light mode toggle and mobile responsiveness to the WXNOW weather website.

**Architecture:** CSS-only refresh using CSS custom properties for theming. Theme toggle stored in localStorage. Mobile responsiveness via CSS media queries. No changes to backend or JavaScript logic.

**Tech Stack:** CSS3 custom properties, vanilla JavaScript for theme toggle, existing Bootstrap 5 framework.

---

## File Structure

### New Files
| File | Responsibility |
|------|----------------|
| `app/web/static/css/theme.css` | CSS custom properties and theme definitions (dark/light) |
| `app/web/static/js/theme-toggle.js` | Theme switching logic and localStorage persistence |

### Modified Files
| File | Changes |
|------|---------|
| `app/web/templates/index.html` | Add theme CSS link, toggle button, dark map tile layer |
| `app/web/templates/about.html` | Add theme CSS link, toggle button, unify styling |
| `app/web/static/css/index.css` | Refactor to use CSS variables |
| `app/web/static/css/sidebar-dark.css` | Override sidebar colors for dark mode |

---

## Chunk 1: Theme Foundation

### Task 1: Create Theme CSS File

**Files:**
- Create: `app/web/static/css/theme.css`

- [ ] **Step 1: Create theme.css with CSS custom properties**

```css
/* app/web/static/css/theme.css */
/* WXNOW Dark Mode Theme - Midnight Style */

:root {
  /* Light theme (fallback) */
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-tertiary: #ffffff;
  --bg-elevated: #ffffff;
  --border-color: #d0d7de;
  --text-primary: #1f2328;
  --text-secondary: #656d76;
  --text-muted: #8c959f;
  --accent-blue: #0969da;
  --accent-green: #1a7f37;
  --accent-red: #cf222e;
  --accent-yellow: #9a6700;
  --link-color: #0969da;
  --sidebar-bg: #f6f8fa;
  --card-bg: #ffffff;
  --popup-bg: #ffffff;
  --shadow: 0 1px 3px rgba(0,0,0,0.12);
}

[data-theme="dark"] {
  /* Dark theme - Midnight/GitHub style */
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --bg-elevated: #30363d;
  --border-color: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;
  --accent-blue: #58a6ff;
  --accent-green: #238636;
  --accent-red: #f85149;
  --accent-yellow: #d29922;
  --link-color: #58a6ff;
  --sidebar-bg: #161b22;
  --card-bg: #21262d;
  --popup-bg: #21262d;
  --shadow: 0 1px 3px rgba(0,0,0,0.4);
}

/* Base styles using variables */
body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.2s ease, color 0.2s ease;
}

a {
  color: var(--link-color);
}

a:hover {
  color: var(--accent-blue);
}

/* Theme toggle button */
.theme-toggle {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s ease;
}

.theme-toggle:hover {
  background: var(--bg-elevated);
}

.theme-toggle .icon-sun,
.theme-toggle .icon-moon {
  width: 18px;
  height: 18px;
}

/* Hide icons based on theme */
[data-theme="dark"] .theme-toggle .icon-moon {
  display: none;
}

[data-theme="light"] .theme-toggle .icon-sun,
:root:not([data-theme]) .theme-toggle .icon-sun {
  display: none;
}

/* Cards and elevated surfaces */
.card, .panel, .ui.segment {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

/* Status badges */
.badge-connected {
  background: var(--accent-green);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.badge-server {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

/* Scrollbar styling for dark mode */
[data-theme="dark"] ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

[data-theme="dark"] ::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

[data-theme="dark"] ::-webkit-scrollbar-thumb {
  background: var(--bg-elevated);
  border-radius: 4px;
}

[data-theme="dark"] ::-webkit-scrollbar-thumb:hover {
  background: var(--border-color);
}

/* Mobile responsive base */
@media (max-width: 768px) {
  .theme-toggle {
    padding: 8px 12px;
  }
}
```

- [ ] **Step 2: Commit theme.css**

```bash
git add app/web/static/css/theme.css
git commit -m "feat: add theme.css with dark/light mode CSS variables"
```

---

### Task 2: Create Theme Toggle JavaScript

**Files:**
- Create: `app/web/static/js/theme-toggle.js`

- [ ] **Step 1: Create theme-toggle.js**

```javascript
/* app/web/static/js/theme-toggle.js */
/* Theme toggle functionality for WXNOW */

(function() {
  'use strict';

  // Get saved theme or default to dark
  function getPreferredTheme() {
    const saved = localStorage.getItem('wxnow-theme');
    if (saved) {
      return saved;
    }
    // Default to dark mode
    return 'dark';
  }

  // Apply theme to document
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wxnow-theme', theme);
    
    // Update toggle button icon visibility (handled by CSS)
    const toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', 
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      );
    }
  }

  // Toggle between themes
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  // Initialize on DOM ready
  function init() {
    // Set initial theme immediately (before page renders)
    setTheme(getPreferredTheme());
    
    // Attach click handler to toggle button
    document.addEventListener('click', function(e) {
      if (e.target.closest('.theme-toggle')) {
        toggleTheme();
      }
    });
  }

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also set theme immediately to prevent flash
  setTheme(getPreferredTheme());

  // Expose for manual use if needed
  window.wxnowTheme = {
    toggle: toggleTheme,
    set: setTheme,
    get: getPreferredTheme
  };
})();
```

- [ ] **Step 2: Commit theme-toggle.js**

```bash
git add app/web/static/js/theme-toggle.js
git commit -m "feat: add theme toggle JavaScript with localStorage persistence"
```

---

## Chunk 2: Sidebar Dark Styling

### Task 3: Create Sidebar Dark Mode Overrides

**Files:**
- Create: `app/web/static/css/sidebar-dark.css`

- [ ] **Step 1: Create sidebar-dark.css for leaflet sidebar overrides**

```css
/* app/web/static/css/sidebar-dark.css */
/* Dark mode overrides for Leaflet sidebar */

/* Sidebar container */
[data-theme="dark"] .leaflet-sidebar {
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
}

[data-theme="dark"] .leaflet-sidebar-content {
  background: var(--sidebar-bg);
}

[data-theme="dark"] .leaflet-sidebar-pane {
  background: var(--sidebar-bg);
  color: var(--text-primary);
}

/* Sidebar header */
[data-theme="dark"] .leaflet-sidebar-header {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

[data-theme="dark"] .leaflet-sidebar-header h1 {
  color: var(--text-primary);
  font-size: 1.1rem;
}

[data-theme="dark"] .leaflet-sidebar-close {
  color: var(--text-secondary);
}

[data-theme="dark"] .leaflet-sidebar-close:hover {
  color: var(--text-primary);
}

/* Sidebar tabs */
[data-theme="dark"] .leaflet-sidebar-tabs {
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border-color);
}

[data-theme="dark"] .leaflet-sidebar-tabs > ul > li > a {
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

[data-theme="dark"] .leaflet-sidebar-tabs > ul > li > a:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

[data-theme="dark"] .leaflet-sidebar-tabs > ul > li.active > a {
  color: var(--accent-blue);
  background: var(--sidebar-bg);
}

/* Request list items */
[data-theme="dark"] .list-group-item {
  background: var(--card-bg);
  border-color: var(--border-color);
  color: var(--text-primary);
}

[data-theme="dark"] .list-group-item:hover {
  background: var(--bg-elevated);
}

[data-theme="dark"] .list-group-item a {
  color: var(--link-color);
}

/* Badges area */
[data-theme="dark"] #badges {
  color: var(--text-primary);
}

[data-theme="dark"] #badges a {
  color: var(--link-color);
}

[data-theme="dark"] #badges .h6 {
  color: var(--text-secondary);
}

/* Version and status text */
[data-theme="dark"] #aprs_connection {
  color: var(--accent-blue) !important;
}

[data-theme="dark"] #uptime {
  color: var(--text-secondary);
}

/* Connected callsign */
[data-theme="dark"] .leaflet-sidebar-pane span[style*="green"] {
  color: var(--accent-green) !important;
}

[data-theme="dark"] .leaflet-sidebar-pane span[style*="blue"] {
  color: var(--accent-blue) !important;
}
```

- [ ] **Step 2: Commit sidebar-dark.css**

```bash
git add app/web/static/css/sidebar-dark.css
git commit -m "feat: add dark mode styling for leaflet sidebar"
```

---

### Task 4: Create Map Dark Mode Styles

**Files:**
- Create: `app/web/static/css/map-dark.css`

- [ ] **Step 1: Create map-dark.css for map popup and control styling**

```css
/* app/web/static/css/map-dark.css */
/* Dark mode styles for map popups and controls */

/* Leaflet popup dark styling */
[data-theme="dark"] .leaflet-popup-content-wrapper {
  background: var(--popup-bg);
  color: var(--text-primary);
  border-radius: 8px;
  box-shadow: var(--shadow);
}

[data-theme="dark"] .leaflet-popup-content {
  color: var(--text-primary);
}

[data-theme="dark"] .leaflet-popup-content a {
  color: var(--link-color);
}

[data-theme="dark"] .leaflet-popup-tip {
  background: var(--popup-bg);
}

/* Leaflet control buttons */
[data-theme="dark"] .leaflet-control-zoom a,
[data-theme="dark"] .leaflet-control-fullscreen a,
[data-theme="dark"] .leaflet-control-layers-toggle {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

[data-theme="dark"] .leaflet-control-zoom a:hover,
[data-theme="dark"] .leaflet-control-fullscreen a:hover {
  background: var(--bg-elevated);
}

/* Layer control dropdown */
[data-theme="dark"] .leaflet-control-layers {
  background: var(--card-bg);
  border-color: var(--border-color);
  color: var(--text-primary);
}

[data-theme="dark"] .leaflet-control-layers-expanded {
  background: var(--card-bg);
}

[data-theme="dark"] .leaflet-control-layers label {
  color: var(--text-primary);
}

/* MiniMap control */
[data-theme="dark"] .leaflet-control-minimap {
  border-color: var(--border-color);
}

/* Attribution */
[data-theme="dark"] .leaflet-control-attribution {
  background: rgba(13, 17, 23, 0.8);
  color: var(--text-muted);
}

[data-theme="dark"] .leaflet-control-attribution a {
  color: var(--link-color);
}

/* Rainviewer control */
[data-theme="dark"] .leaflet-control-rainviewer {
  background: var(--card-bg);
  border-color: var(--border-color);
  color: var(--text-primary);
}

[data-theme="dark"] .leaflet-control-rainviewer button {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

[data-theme="dark"] .leaflet-control-rainviewer button:hover {
  background: var(--bg-elevated);
}

/* Marker cluster styling */
[data-theme="dark"] .marker-cluster-small,
[data-theme="dark"] .marker-cluster-medium,
[data-theme="dark"] .marker-cluster-large {
  background-color: rgba(88, 166, 255, 0.6);
}

[data-theme="dark"] .marker-cluster-small div,
[data-theme="dark"] .marker-cluster-medium div,
[data-theme="dark"] .marker-cluster-large div {
  background-color: rgba(88, 166, 255, 0.8);
  color: var(--text-primary);
}
```

- [ ] **Step 2: Commit map-dark.css**

```bash
git add app/web/static/css/map-dark.css
git commit -m "feat: add dark mode styling for map popups and controls"
```

---

## Chunk 3: Mobile Responsive Styles

### Task 5: Create Mobile Responsive CSS

**Files:**
- Create: `app/web/static/css/responsive.css`

- [ ] **Step 1: Create responsive.css for mobile layouts**

```css
/* app/web/static/css/responsive.css */
/* Mobile responsive styles for WXNOW */

/* Base mobile-first styles */
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#map {
  height: 100%;
  width: 100%;
}

/* Sidebar responsive behavior */
@media (max-width: 768px) {
  /* Make sidebar full width on mobile when open */
  .leaflet-sidebar {
    width: 100% !important;
    max-width: 100% !important;
  }
  
  .leaflet-sidebar.collapsed {
    width: 40px !important;
  }
  
  .leaflet-sidebar-content {
    width: 100% !important;
  }
  
  .leaflet-sidebar-pane {
    padding: 10px !important;
  }
  
  /* Adjust header text size */
  .leaflet-sidebar-header h1 {
    font-size: 1rem !important;
  }
  
  /* Make requests list more touch-friendly */
  #requests_list .list-group-item {
    padding: 12px 15px;
    min-height: 44px; /* Touch target minimum */
  }
  
  /* Adjust badges layout */
  #badges {
    text-align: center;
  }
  
  #badges img {
    margin: 5px;
  }
}

/* Tablet adjustments */
@media (min-width: 769px) and (max-width: 992px) {
  .leaflet-sidebar {
    width: 300px !important;
  }
}

/* Theme toggle positioning */
.theme-toggle-container {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
}

@media (max-width: 768px) {
  .theme-toggle-container {
    top: 5px;
    right: 5px;
  }
  
  .theme-toggle {
    padding: 8px;
    font-size: 14px;
  }
}

/* Popup responsive */
@media (max-width: 768px) {
  .leaflet-popup-content-wrapper {
    max-width: 280px !important;
  }
  
  .leaflet-popup-content {
    font-size: 13px;
    max-width: 260px !important;
  }
}

/* Touch-friendly controls */
@media (max-width: 768px) {
  .leaflet-control-zoom a,
  .leaflet-control-fullscreen a {
    width: 36px !important;
    height: 36px !important;
    line-height: 36px !important;
    font-size: 18px !important;
  }
  
  .leaflet-control-layers-toggle {
    width: 40px !important;
    height: 40px !important;
  }
}

/* Hide minimap on mobile */
@media (max-width: 768px) {
  .leaflet-control-minimap {
    display: none !important;
  }
}

/* Rainviewer control mobile */
@media (max-width: 768px) {
  .leaflet-control-rainviewer {
    max-width: 200px;
    font-size: 12px;
  }
}
```

- [ ] **Step 2: Commit responsive.css**

```bash
git add app/web/static/css/responsive.css
git commit -m "feat: add mobile responsive CSS styles"
```

---

## Chunk 4: Template Integration

### Task 6: Update index.html Template

**Files:**
- Modify: `app/web/templates/index.html`

- [ ] **Step 1: Add CSS links and theme toggle to index.html**

Add after the existing CSS links (around line 61), before `</head>`:

```html
    <!-- Theme CSS -->
    <link rel="stylesheet" href="/static/css/theme.css">
    <link rel="stylesheet" href="/static/css/sidebar-dark.css">
    <link rel="stylesheet" href="/static/css/map-dark.css">
    <link rel="stylesheet" href="/static/css/responsive.css">
    
    <!-- Theme toggle script (load early to prevent flash) -->
    <script src="/static/js/theme-toggle.js"></script>
```

- [ ] **Step 2: Add theme toggle button in sidebar**

Replace the sidebar header section (around line 110-113) with:

```html
                <h1 class="leaflet-sidebar-header">
                    WXNOW Weather Service
                    <button class="theme-toggle" aria-label="Toggle theme" style="float: right; margin-right: 30px;">
                        <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="5"></circle>
                            <line x1="12" y1="1" x2="12" y2="3"></line>
                            <line x1="12" y1="21" x2="12" y2="23"></line>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                            <line x1="1" y1="12" x2="3" y2="12"></line>
                            <line x1="21" y1="12" x2="23" y2="12"></line>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                        </svg>
                        <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                        </svg>
                    </button>
                    <span class="leaflet-sidebar-close"><i class="fa fa-caret-left"></i></span>
                </h1>
```

- [ ] **Step 3: Add dark map tile layer option**

In the JavaScript section (around line 168), add CartoDB dark tiles to baseLayers:

```javascript
        // Dark map tile layer
        const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        });

        var baseLayers = {
            "Dark (CartoDB)": cartoDark,
            "OpenStreetMap": osm,
            "Mapbox Streets": streets,
            "Mapbox Satellite": satellite,
            "Mapbox Terrain": terrain
        };
```

And change the default layer to cartoDark in the map initialization:

```javascript
        var map = L.map('map', {
           center: [37.344, -78.84933],
           zoom: 5,
           layers: [cartoDark]  // Changed from osm to cartoDark
        });
```

- [ ] **Step 4: Commit index.html changes**

```bash
git add app/web/templates/index.html
git commit -m "feat: integrate dark theme into index.html with toggle and dark map tiles"
```

---

### Task 7: Update about.html Template

**Files:**
- Modify: `app/web/templates/about.html`

- [ ] **Step 1: Add theme CSS and fix DOCTYPE**

Replace the opening of about.html to add proper DOCTYPE and theme support:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>WXNOW - About</title>
    
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
    <link rel="stylesheet"
          href="https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css">
    <script src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js"></script>

    <link rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/semantic-ui@2.4.2/dist/semantic.min.css">
    <script src="https://cdn.jsdelivr.net/npm/semantic-ui@2.4.2/dist/semantic.min.js"></script>
    <script src="/static/js/jquery.tablesorter.combined.js"></script>

    <link rel="stylesheet" href="/static/css/index.css">
    <link rel="stylesheet" href="/static/css/prism.css">
    
    <!-- Theme CSS -->
    <link rel="stylesheet" href="/static/css/theme.css">
    <link rel="stylesheet" href="/static/css/about-dark.css">
    <link rel="stylesheet" href="/static/css/responsive.css">
    <script src="/static/js/theme-toggle.js"></script>
    
    <script src="/static/js/main.js"></script>
    <script src="/static/js/prism.js"></script>
```

- [ ] **Step 2: Create about-dark.css for Semantic UI overrides**

```css
/* app/web/static/css/about-dark.css */
/* Dark mode overrides for about page (Semantic UI) */

[data-theme="dark"] body {
  background: var(--bg-primary);
}

[data-theme="dark"] .ui.segment {
  background: var(--card-bg);
  border-color: var(--border-color);
  color: var(--text-primary);
}

[data-theme="dark"] .ui.header,
[data-theme="dark"] h1, 
[data-theme="dark"] h2, 
[data-theme="dark"] h3, 
[data-theme="dark"] h4 {
  color: var(--text-primary);
}

[data-theme="dark"] .ui.dividing.header {
  border-color: var(--border-color);
}

[data-theme="dark"] .ui.list .item {
  color: var(--text-primary);
}

[data-theme="dark"] .ui.tabular.menu {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

[data-theme="dark"] .ui.tabular.menu .item {
  color: var(--text-secondary);
  border-color: var(--border-color);
}

[data-theme="dark"] .ui.tabular.menu .active.item {
  background: var(--card-bg);
  color: var(--text-primary);
  border-color: var(--border-color);
}

[data-theme="dark"] .ui.bottom.attached.segment {
  background: var(--card-bg);
  border-color: var(--border-color);
}

[data-theme="dark"] .ui.text.container {
  color: var(--text-primary);
}

[data-theme="dark"] #header {
  background: var(--bg-secondary);
  padding-bottom: 20px;
}

[data-theme="dark"] #badges {
  background: var(--bg-primary);
}

/* Table styling for seen list */
[data-theme="dark"] table {
  background: var(--card-bg);
  color: var(--text-primary);
}

[data-theme="dark"] th {
  background: var(--bg-tertiary) !important;
  color: var(--text-primary) !important;
}

[data-theme="dark"] td {
  border-color: var(--border-color) !important;
}

[data-theme="dark"] tr:hover td {
  background: var(--bg-elevated) !important;
}

/* Code blocks */
[data-theme="dark"] pre,
[data-theme="dark"] code {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

- [ ] **Step 3: Add theme toggle to about.html body**

Add after the opening `<body>` tag:

```html
<body>
<div style="position: fixed; top: 10px; right: 10px; z-index: 1000;">
    <button class="theme-toggle" aria-label="Toggle theme">
        <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
    </button>
</div>
```

- [ ] **Step 4: Commit about page changes**

```bash
git add app/web/static/css/about-dark.css app/web/templates/about.html
git commit -m "feat: add dark theme support to about page"
```

---

## Chunk 5: Testing and Finalization

### Task 8: Manual Testing Checklist

- [ ] **Step 1: Test dark mode on index page**

Verify:
- Page loads with dark theme by default
- Sidebar has dark background
- Map uses CartoDB dark tiles
- Theme toggle button is visible
- Clicking toggle switches to light mode
- Preference persists after page reload

- [ ] **Step 2: Test dark mode on about page**

Verify:
- Page loads with same theme as index
- All text is readable
- Tabs work correctly
- Theme toggle works

- [ ] **Step 3: Test mobile responsiveness**

Verify in Chrome DevTools device mode:
- iPhone SE (375px): Sidebar collapses, touch targets are large enough
- iPad (768px): Sidebar narrower but visible
- Desktop (1200px+): Full layout

- [ ] **Step 4: Test theme persistence**

Verify:
- Set theme on index page, navigate to about page - theme matches
- Refresh page - theme persists
- Clear localStorage - defaults to dark

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete dark mode refresh implementation"
```

---

## Summary

**Total New Files:** 5
- `app/web/static/css/theme.css`
- `app/web/static/css/sidebar-dark.css`
- `app/web/static/css/map-dark.css`
- `app/web/static/css/responsive.css`
- `app/web/static/css/about-dark.css`
- `app/web/static/js/theme-toggle.js`

**Modified Files:** 2
- `app/web/templates/index.html`
- `app/web/templates/about.html`

**Commits:** 8 incremental commits
