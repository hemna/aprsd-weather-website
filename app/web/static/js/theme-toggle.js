/* app/web/static/js/theme-toggle.js */
/* Theme toggle functionality for WXNOW */

(function() {
  'use strict';

  // Get saved theme or default to dark
  function getPreferredTheme() {
    var saved = localStorage.getItem('wxnow-theme');
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
    var toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', 
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      );
    }
  }

  // Toggle between themes
  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
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
