import { isBlocked } from "./domains.js";

// The popup owns the saved settings; this worker only reads them. It reads on each
// navigation because Chrome can stop the worker at any time and drop in-memory state.
async function closeIfBlocked(details) {
  if (details.frameId !== 0) return; // top-level page only, not iframes
  const { enabled = true, blocked = [] } = await chrome.storage.sync.get(["enabled", "blocked"]);
  if (!enabled || !isBlocked(details.url, blocked)) return;
  try {
    await chrome.tabs.remove(details.tabId);
  } catch (err) {
    // The tab can close between the event and the remove call.
    console.warn("Site Blocker: could not close tab", details.tabId, err);
  }
}

// Full page loads.
chrome.webNavigation.onCommitted.addListener(closeIfBlocked);
// Single-page-app navigations (history.pushState / replaceState), as on YouTube and Reddit.
chrome.webNavigation.onHistoryStateUpdated.addListener(closeIfBlocked);
