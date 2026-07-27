(function () {
  // Keep the restored Calendar v3 renderer intact, then layer the mobile
  // viewport, day popup, and event creation controls on top. document.write
  // keeps all scripts synchronous so switchView() still runs after CAL exists.
  document.write('<script src="calendar-view-base.js?v=mobile-day-popup-20260727"><\/script>');
  document.write('<script src="calendar-mobile-fit.js?v=mobile-fit-20260727"><\/script>');
  document.write('<script src="calendar-mobile-day-popup.js?v=mobile-day-popup-20260727"><\/script>');
  document.write('<script src="calendar-mobile-event-add.js?v=mobile-event-add-20260727"><\/script>');
})();
