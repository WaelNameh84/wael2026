/**
 * SERVER_START_TIME is captured once when this module is first imported
 * (i.e., at process boot). It is stable for the lifetime of this server
 * instance, so the /api/version endpoint never causes spurious reloads
 * during normal operation, but it WILL change after every server restart
 * (= deploy / code change) — exactly the signal the PWA frontend needs.
 */
export const SERVER_START_TIME = Date.now().toString();
