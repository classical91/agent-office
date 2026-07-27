(function () {
  // Keep the restored Calendar v3 renderer intact, then layer the mobile day
  // popup on top. document.write keeps both scripts synchronous so the page's
  // existing switchView() call still runs after window.CAL is available.
  document.write('<script src="calendar-view-base.js?v=mobile-day-popup-20260727"><\/script>');
  document.write('<script src="calendar-mobile-day-popup.js?v=mobile-day-popup-20260727"><\/script>');
})();
