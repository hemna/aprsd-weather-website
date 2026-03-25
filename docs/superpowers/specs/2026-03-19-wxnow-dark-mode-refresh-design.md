# WXNOW Dark Mode Visual Refresh - Design Spec

**Date:** 2026-03-19  
**Status:** Draft  
**Scope:** Visual refresh only - CSS changes, no feature changes

## Overview

Refresh the WXNOW weather website with a modern dark mode theme (Midnight/GitHub-style), add a light/dark toggle, and ensure full mobile responsiveness. The existing functionality remains unchanged.

## Requirements

| Requirement | Decision |
|-------------|----------|
| Primary audience | Ham operators using WXNOW service |
| Theme style | Midnight (GitHub-style) - deep blue-grays, muted blue accents |
| Sidebar | Keep current layout and content |
| Mobile support | Full responsive design for phones and tablets |
| Theme toggle | Manual toggle button (dark is default) |

## Color Palette

### Dark Theme (Default)
Based on GitHub's dark theme:

```css
--bg-primary: #0d1117;      /* Main background */
--bg-secondary: #161b22;    /* Sidebar, cards */
--bg-tertiary: #21262d;     /* Elevated elements */
--border-color: #30363d;    /* Borders, dividers */
--text-primary: #e6edf3;    /* Main text */
--text-secondary: #8b949e;  /* Muted text */
--accent-blue: #58a6ff;     /* Links, highlights */
--accent-green: #238636;    /* Success/connected */
--accent-red: #f85149;      /* Errors/warnings */
--accent-yellow: #d29922;   /* Caution */
```

### Light Theme
```css
--bg-primary: #ffffff;
--bg-secondary: #f6f8fa;
--bg-tertiary: #ffffff;
--border-color: #d0d7de;
--text-primary: #1f2328;
--text-secondary: #656d76;
--accent-blue: #0969da;
--accent-green: #1a7f37;
--accent-red: #cf222e;
--accent-yellow: #9a6700;
```

## Components to Style

### 1. Sidebar
- Dark background (`--bg-secondary`)
- Rounded corners on internal cards
- Subtle border on right edge
- Logo/branding area with accent color
- Connection status badge (green when connected)
- Scrollable requests list with hover states

### 2. Map Container
- Full bleed to edges
- Dark tile layer option (Mapbox dark or CartoDB dark)
- Styled popups matching dark theme
- Custom marker styling

### 3. Header/Navbar (if present)
- Semi-transparent dark background
- Theme toggle button (sun/moon icon)
- Clean typography

### 4. Weather Popups
- Dark background card
- Clear data hierarchy
- Temperature, wind, humidity with icons
- Link to aprs.fi styled as button

### 5. About Page
- Convert Semantic UI styling to match dark theme
- Tabs should use dark styling
- Code blocks with syntax highlighting

## Responsive Breakpoints

```css
/* Mobile first approach */
/* Base: 0-576px (phones) */
/* sm: 576px+ (large phones) */
/* md: 768px+ (tablets) */
/* lg: 992px+ (small laptops) */
/* xl: 1200px+ (desktops) */
```

### Mobile Behavior (< 768px)
- Sidebar collapses to hamburger menu or bottom drawer
- Map takes full screen
- Touch-friendly tap targets (44px minimum)
- Popups centered and scrollable

### Tablet Behavior (768px - 992px)
- Narrower sidebar (250px instead of 350px)
- Adjusted font sizes

### Desktop (992px+)
- Current layout with full sidebar

## Theme Toggle

- Position: Top-right of sidebar or in a header bar
- Icons: Sun (for light mode) / Moon (for dark mode)
- Persistence: Save preference to `localStorage`
- Default: Dark mode
- Transition: Smooth 200ms transition on toggle

## Files to Create/Modify

### New Files
1. `app/web/static/css/theme.css` - CSS custom properties and theme definitions
2. `app/web/static/css/responsive.css` - Mobile responsive styles
3. `app/web/static/js/theme-toggle.js` - Theme switching logic

### Modified Files
1. `app/web/templates/index.html` - Add theme CSS links, toggle button, responsive meta tags
2. `app/web/templates/about.html` - Add theme CSS links, toggle button
3. `app/web/static/css/index.css` - Refactor to use CSS variables
4. `app/web/static/css/map.css` - Refactor to use CSS variables

## Implementation Notes

### CSS Variable Strategy
All colors should reference CSS custom properties so theme switching is a single class toggle:

```css
:root {
  /* Light theme (fallback) */
  --bg-primary: #ffffff;
  /* ... */
}

[data-theme="dark"] {
  --bg-primary: #0d1117;
  /* ... */
}

.sidebar {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
```

### Theme Toggle Logic
```javascript
// Check saved preference or system preference
const savedTheme = localStorage.getItem('theme');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const theme = savedTheme || (systemDark ? 'dark' : 'dark'); // Default dark

document.documentElement.setAttribute('data-theme', theme);

// Toggle function
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}
```

### Map Tiles
Add dark map tile option. CartoDB Dark Matter is a good free option:
```javascript
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap contributors © CARTO'
})
```

## Out of Scope

- New features or functionality
- Backend changes
- JavaScript refactoring (beyond theme toggle)
- Chart.js integration (already unused)
- Search or filtering capabilities

## Success Criteria

1. Site loads with dark theme by default
2. Toggle switches between dark and light smoothly
3. Preference persists across page loads
4. All text is readable (sufficient contrast)
5. Site is usable on mobile phones
6. Existing functionality unchanged
7. Map popups match theme

## Testing

- Visual inspection in Chrome, Firefox, Safari
- Mobile testing in Chrome DevTools device mode
- Verify localStorage persistence
- Check contrast ratios meet WCAG AA (4.5:1 for text)
