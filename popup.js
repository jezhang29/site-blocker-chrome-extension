import { normalizeDomain, isBlocked } from "./domains.js";

const enabledBox = document.getElementById("enabled");
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
    blocked = [],
    allowed = [],
  } = await chrome.storage.sync.get(["enabled", ...KEYS]);
  return { enabled, blocked, allowed };
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
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
  if (enabledBox.checked) await chrome.tabs.remove(tab.id);
});

enabledBox.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: enabledBox.checked });
});

const state = await load();
enabledBox.checked = state.enabled;
for (const key of KEYS) render(key, state[key]);
