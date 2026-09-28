import { normalizeDomain, isBlocked } from "./domains.js";

const PAUSE_MS = 5 * 60 * 1000;
const LOCK_MS = 30 * 60 * 1000;

const status = document.getElementById("status");
const pauseButton = document.getElementById("pause");
const lockButton = document.getElementById("lock");
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
    pausedUntil = 0,
    lockedUntil = 0,
    blocked = [],
    allowed = [],
  } = await chrome.storage.sync.get(["pausedUntil", "lockedUntil", ...KEYS]);
  return { pausedUntil, lockedUntil, blocked, allowed };
}

// The popup is the only writer of these times; this copy drives the status line.
const times = { pausedUntil: 0, lockedUntil: 0 };

const isPaused = () => Date.now() < times.pausedUntil;
const isLocked = () => Date.now() < times.lockedUntil;

async function setTimes(changes) {
  await chrome.storage.sync.set(changes);
  Object.assign(times, changes);
  renderStatus();
}

function clock(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

// Returns true (and says so) when the lock forbids the action.
function refuseIfLocked() {
  if (!isLocked()) return false;
  showMessage(`Locked until ${clock(times.lockedUntil)}.`);
  return true;
}

function renderStatus() {
  const paused = isPaused();
  status.textContent = paused ? `Paused until ${clock(times.pausedUntil)}` : "Blocking on";
  pauseButton.textContent = paused ? "Resume now" : "Pause 5 min";
  lockButton.textContent = isLocked()
    ? `Locked until ${clock(times.lockedUntil)}`
    : "Lock for 30 min";
  lockButton.disabled = isLocked();
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
  if (key === "allowed" && refuseIfLocked()) return null;
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
  if (key === "blocked" && refuseIfLocked()) return;
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
  if (!isPaused()) await chrome.tabs.remove(tab.id);
});

// The background worker reblocks and closes blocked tabs when the pause ends.
pauseButton.addEventListener("click", async () => {
  if (isPaused()) {
    await setTimes({ pausedUntil: 0 });
  } else if (!refuseIfLocked()) {
    await setTimes({ pausedUntil: Date.now() + PAUSE_MS });
  }
});

// Locking also ends a pause, so blocking is on for the whole lock.
lockButton.addEventListener("click", async () => {
  showMessage("");
  await setTimes({ lockedUntil: Date.now() + LOCK_MS, pausedUntil: 0 });
});

const state = await load();
times.pausedUntil = state.pausedUntil;
times.lockedUntil = state.lockedUntil;
renderStatus();
// Keeps the status and buttons right when a pause or lock ends while the popup is open.
setInterval(renderStatus, 1000);
for (const key of KEYS) render(key, state[key]);
