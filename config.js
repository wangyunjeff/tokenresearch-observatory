/* Public display configuration only. Never put an API key or account secret here. */
window.OBS_CONFIG = Object.freeze({
  // Set to a same-origin public JSON feed (see data/feed.example.json).
  // Empty = show the supplied archive, not a fabricated live monitor.
  feedUrl: "",
  refreshMs: 600000,
  maxDrawings: 200,
  timeZone: "Asia/Shanghai"
});
