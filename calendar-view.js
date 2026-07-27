(function () {
  // Keep the restored Calendar v3 renderer intact, then layer the mobile
  // viewport, day popup, event creation controls, and the Agent Assistant
  // drawer on top. document.write keeps all scripts synchronous so
  // switchView() still runs after CAL exists.
  document.write('<script src="calendar-view-base.js?v=agent-intelligence-20260727"><\/script>');
  document.write('<script src="calendar-mobile-fit.js?v=agent-intelligence-20260727"><\/script>');
  document.write('<script src="calendar-mobile-day-popup.js?v=agent-intelligence-20260727"><\/script>');
  document.write('<script src="calendar-mobile-event-add.js?v=agent-intelligence-20260727"><\/script>');
  document.write('<script src="calendar-agent-assistant.js?v=agent-intelligence-20260727"><\/script>');
})();
