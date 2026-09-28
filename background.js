import { isBlocked } from "./domains.js";

const REBLOCK_ALARM = "reblock";

// The popup owns the saved settings; this worker only reads them. It reads on each
// event because Chrome can stop the worker at any time and drop in-memory state.
async function readSettings() {
  const {
    pausedUntil = 0,
    blocked = [],
    allowed = [],
  } = await chrome.storage.sync.get(["pausedUntil", "blocked", "allowed"]);
  return { paused: Date.now() < pausedUntil, blocked, allowed };
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
  const { paused, blocked, allowed } = await readSettings();
  if (!paused && isBlocked(details.url, blocked, allowed)) await closeTab(details.tabId);
}

// Tabs opened during a pause get no new navigation event when the pause ends,
// so close them here.
async function closeBlockedTabs() {
  const { paused, blocked, allowed } = await readSettings();
  if (paused) return;
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && isBlocked(tab.url, blocked, allowed)) await closeTab(tab.id);
  }
}

// Full page loads.
chrome.webNavigation.onCommitted.addListener(closeIfBlocked);
// Single-page-app navigations (history.pushState / replaceState), as on YouTube and Reddit.
chrome.webNavigation.onHistoryStateUpdated.addListener(closeIfBlocked);

// A pause that starts schedules the reblock; a pause that ends (resume or lock) reblocks now.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.pausedUntil) return;
  const { newValue = 0 } = changes.pausedUntil;
  if (newValue > Date.now()) chrome.alarms.create(REBLOCK_ALARM, { when: newValue });
  else closeBlockedTabs();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REBLOCK_ALARM) closeBlockedTabs();
});
