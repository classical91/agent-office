(function () {
  'use strict';

  var viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.name = 'viewport';
    document.head.appendChild(viewport);
  }
  viewport.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');

  if (document.getElementById('calendar-mobile-fit-style')) return;
  var style = document.createElement('style');
  style.id = 'calendar-mobile-fit-style';
  style.textContent = `
    @media (max-width: 640px) {
      html,
      body {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: hidden !important;
        -webkit-text-size-adjust: 100% !important;
        text-size-adjust: 100% !important;
      }

      .layout,
      #view-calendar-v3,
      #calendar-app,
      .calendar-compact-shell,
      .calendar-compact-stage,
      .calendar-compact-board,
      .calendar-month-grid {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }

      #view-calendar-v3,
      #calendar-app,
      .calendar-compact-shell,
      .calendar-compact-stage,
      .calendar-compact-board,
      .calendar-month-grid {
        overflow-x: hidden !important;
      }

      .calendar-compact-board .calendar-toolbar {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        flex-wrap: nowrap !important;
        overflow-x: hidden !important;
        overflow-y: hidden !important;
      }

      .calendar-compact-board .calendar-toolbar > *,
      .calendar-compact-board .calendar-toolbar-controls,
      .calendar-compact-board .calendar-nav,
      .calendar-compact-board .calendar-view-switcher {
        min-width: 0 !important;
        flex-wrap: nowrap !important;
      }

      .calendar-compact-board .calendar-toolbar > div:first-of-type {
        flex: 0 0 auto !important;
      }

      .calendar-compact-board .calendar-toolbar-controls {
        width: auto !important;
        flex: 1 1 auto !important;
        align-self: center !important;
        justify-content: flex-end !important;
        overflow: hidden !important;
      }

      .calendar-compact-board .calendar-nav {
        flex: 0 0 auto !important;
      }

      .calendar-compact-board .calendar-view-switcher {
        display: none !important;
      }

      .calendar-compact-board .calendar-nav-btn {
        padding-left: 8px !important;
        padding-right: 8px !important;
        letter-spacing: 0.08em !important;
      }

      .calendar-compact-board .calendar-month-grid {
        display: grid !important;
        grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
        inline-size: 100% !important;
        max-inline-size: 100% !important;
      }

      .calendar-compact-board .calendar-month-weekday,
      .calendar-compact-board .calendar-month-cell {
        min-width: 0 !important;
        max-width: none !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      .calendar-compact-board .calendar-month-events {
        gap: 4px !important;
        align-items: center !important;
        overflow: visible !important;
      }

      /* Dots carry the day on mobile; tapping the cell opens the full list. */
      .calendar-compact-board .calendar-more {
        display: none !important;
      }

      .calendar-compact-board .calendar-event.small {
        width: 10px !important;
        height: 10px !important;
        min-width: 10px !important;
        min-height: 10px !important;
        max-width: 10px !important;
        max-height: 10px !important;
        padding: 0 !important;
        margin: 1px auto 0 !important;
        overflow: hidden !important;
        border: 2px solid rgba(255, 255, 255, 0.92) !important;
        border-radius: 999px !important;
        background: currentColor !important;
        opacity: 1 !important;
        box-shadow: 0 0 0 2px rgba(2, 6, 23, 0.72), 0 0 8px currentColor !important;
        touch-action: manipulation !important;
      }

      .calendar-compact-board .calendar-event.small.active {
        transform: scale(1.14) !important;
        box-shadow: 0 0 0 2px #ffffff, 0 0 12px currentColor !important;
      }

      .calendar-compact-board .calendar-month-cell {
        touch-action: manipulation !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
