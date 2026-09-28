// A focus session locks blocking on for FOCUS_MS, then turns it off for BREAK_MS,
// then turns it back on. focusEndsAt is when the lock ends; 0 means no session yet.
export const FOCUS_MS = 30 * 60 * 1000;
export const BREAK_MS = 5 * 60 * 1000;

export function isFocusing(focusEndsAt, now) {
  return now < focusEndsAt;
}

export function isOnBreak(focusEndsAt, now) {
  return focusEndsAt <= now && now < focusEndsAt + BREAK_MS;
}

export function isBlockingActive(enabled, focusEndsAt, now) {
  return enabled && !isOnBreak(focusEndsAt, now);
}
