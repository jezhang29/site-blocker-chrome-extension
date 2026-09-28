import { normalizeDomain, isBlocked } from "./domains.js";
import { FOCUS_MS, isFocusing, isBlockingActive } from "./focus.js";

const enabledBox = document.getElementById("enabled");
const focusButton = document.getElementById("focus");
const blockCurrentButton = document.getElementById("block-current");
const message = document.getElementById("message");

// "blocked" and "allowed" are the storage keys; each has the same form and list UI.
const KEYS = ["blocked", "allowed"];
const ui = Object.fromEntries(
  KEYS.map((key) => [
    key,
    {
      form: document.getElementById(`${key}-form`),
      list: document.getElementById(`${key}-list`),
      empty: document.getElementById(`${key}-empty`),
    },
  ])
);

async function load() {
  const {
    enabled = true,
    focusEndsAt = 0,
    blocked = [],
    allowed = [],
  } = await chrome.storage.sync.get(["enabled", "focusEndsAt", ...KEYS]);
  return { enabled, focusEndsAt, blocked, allowed };
}

// The popup is the only writer of these settings; this copy drives the switch and button.
const settings = { enabled: true, focusEndsAt: 0 };

const focusing = () => isFocusing(settings.focusEndsAt, Date.now());

async function saveSettings(changes) {
  await chrome.storage.sync.set(changes);
  Object.assign(settings, changes);
  renderStatus();
}

function clock(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

// Returns true (and says so) when a focus session forbids the action.
function refuseIfFocusing() {
  if (!focusing()) return false;
  showMessage(`Locked until ${clock(settings.focusEndsAt)}.`);
  return true;
}

function renderStatus() {
  enabledBox.checked = settings.enabled;
  enabledBox.disabled = focusing();
  focusButton.textContent = focusing()
    ? `Focusing until ${clock(settings.focusEndsAt)}`
    : "Focus 30 min";
  focusButton.disabled = focusing();
}

function render(key, domains) {
  const { list, empty } = ui[key];
  list.replaceChildren(
    ...domains.map((domain) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = domain;
      const remove = document.createElement("button");
      remove.textContent = "Remove";
      remove.addEventListener("click", () => removeDomain(key, domain));
      li.append(name, remove);
      return li;
    })
  );
  empty.hidden = domains.length > 0;
}

// Returns the new domain, or null if the input was not valid.
async function addDomain(key, input) {
  // A new allowed site would unblock it.
  if (key === "allowed" && refuseIfFocusing()) return null;
  const domain = normalizeDomain(input);
  if (!domain) {
    showMessage(`"${input}" is not a valid domain.`);
    return null;
  }
  const { [key]: domains } = await load();
  if (!domains.includes(domain)) {
    domains.push(domain);
    domains.sort();
    await chrome.storage.sync.set({ [key]: domains });
  }
  showMessage("");
  render(key, domains);
  return domain;
}

async function removeDomain(key, domain) {
  if (key === "blocked" && refuseIfFocusing()) return;
  const { [key]: domains } = await load();
  const next = domains.filter((d) => d !== domain);
  await chrome.storage.sync.set({ [key]: next });
  render(key, next);
}

for (const key of KEYS) {
  const { form } = ui[key];
  const input = form.querySelector("input");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (await addDomain(key, input.value)) input.value = "";
  });
}

blockCurrentButton.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith("http")) {
    showMessage("The current tab is not a website.");
    return;
  }
  if (!(await addDomain("blocked", tab.url))) return;
  const { blocked, allowed } = await load();
  if (!isBlocked(tab.url, blocked, allowed)) {
    showMessage("This site is on the allowed list, so it stays open.");
    return;
  }
  // The tab is already open, so no navigation event will close it. Close it here.
  if (isBlockingActive(settings.enabled, settings.focusEndsAt, Date.now())) {
    await chrome.tabs.remove(tab.id);
  }
});

// The switch is disabled while focusing, so it cannot turn blocking off then.
enabledBox.addEventListener("change", () => saveSettings({ enabled: enabledBox.checked }));

// The background worker handles the notification, the break and the reblock.
focusButton.addEventListener("click", async () => {
  showMessage("");
  await saveSettings({ enabled: true, focusEndsAt: Date.now() + FOCUS_MS });
});

const state = await load();
settings.enabled = state.enabled;
settings.focusEndsAt = state.focusEndsAt;
renderStatus();
// Keeps the switch and button right when a session ends while the popup is open.
setInterval(renderStatus, 1000);
for (const key of KEYS) render(key, state[key]);
