import { isBlocked } from "./domains.js";
import { BREAK_MS, isBlockingActive } from "./focus.js";

const FOCUS_END_ALARM = "focus-end";
const BREAK_END_ALARM = "break-end";

// The popup owns the saved settings; this worker only reads them. It reads on each
// event because Chrome can stop the worker at any time and drop in-memory state.
async function readSettings() {
  const {
    enabled = true,
    focusEndsAt = 0,
    blocked = [],
    allowed = [],
  } = await chrome.storage.sync.get(["enabled", "focusEndsAt", "blocked", "allowed"]);
  return { active: isBlockingActive(enabled, focusEndsAt, Date.now()), blocked, allowed };
}

async function closeTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
  } catch (err) {
    // The tab can close between the event and the remove call.
    console.warn("Site Blocker: could not close tab", tabId, err);
  }
}

async function closeIfBlocked(details) {
  if (details.frameId !== 0) return; // top-level page only, not iframes
  const { active, blocked, allowed } = await readSettings();
  if (active && isBlocked(details.url, blocked, allowed)) await closeTab(details.tabId);
}

// Tabs opened during a break get no new navigation event when blocking comes back,
// so close them here.
async function closeBlockedTabs() {
  const { active, blocked, allowed } = await readSettings();
  if (!active) return;
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && isBlocked(tab.url, blocked, allowed)) await closeTab(tab.id);
  }
}

// Full page loads.
chrome.webNavigation.onCommitted.addListener(closeIfBlocked);
// Single-page-app navigations (history.pushState / replaceState), as on YouTube and Reddit.
chrome.webNavigation.onHistoryStateUpdated.addListener(closeIfBlocked);

// A new focus session can start during a break, so close blocked tabs now too.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.focusEndsAt) return;
  const focusEndsAt = changes.focusEndsAt.newValue;
  chrome.alarms.create(FOCUS_END_ALARM, { when: focusEndsAt });
  chrome.alarms.create(BREAK_END_ALARM, { when: focusEndsAt + BREAK_MS });
  closeBlockedTabs();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FOCUS_END_ALARM) {
    // Silent and self-dismissing so it does not interrupt work.
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Site Blocker",
      message: "30 minutes is up.",
      silent: true,
    });
  } else if (alarm.name === BREAK_END_ALARM) {
    closeBlockedTabs();
  }
});
