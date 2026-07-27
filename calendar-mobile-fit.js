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
      }

      .calendar-compact-board .calendar-toolbar > *,
      .calendar-compact-board .calendar-toolbar-controls,
      .calendar-compact-board .calendar-nav,
      .calendar-compact-board .calendar-view-switcher {
        min-width: 0 !important;
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

      .calendar-compact-board .calendar-month-cell,
      .calendar-compact-board .calendar-event.small {
        touch-action: manipulation !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
