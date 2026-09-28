import { normalizeDomain } from "./domains.js";

const enabledBox = document.getElementById("enabled");
const form = document.getElementById("add-form");
const domainInput = document.getElementById("domain");
const blockCurrentButton = document.getElementById("block-current");
const message = document.getElementById("message");
const list = document.getElementById("list");
const empty = document.getElementById("empty");

async function load() {
  const { enabled = true, blocked = [] } = await chrome.storage.sync.get(["enabled", "blocked"]);
  return { enabled, blocked };
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = !text;
}

function render(blocked) {
  list.replaceChildren(
    ...blocked.map((domain) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = domain;
      const remove = document.createElement("button");
      remove.textContent = "Remove";
      remove.addEventListener("click", () => removeDomain(domain));
      li.append(name, remove);
      return li;
    })
  );
  empty.hidden = blocked.length > 0;
}

// Returns the new domain, or null if the input was not valid.
async function addDomain(input) {
  const domain = normalizeDomain(input);
  if (!domain) {
    showMessage(`"${input}" is not a valid domain.`);
    return null;
  }
  const { blocked } = await load();
  if (!blocked.includes(domain)) {
    blocked.push(domain);
    blocked.sort();
    await chrome.storage.sync.set({ blocked });
  }
  showMessage("");
  render(blocked);
  return domain;
}

async function removeDomain(domain) {
  const { blocked } = await load();
  const next = blocked.filter((d) => d !== domain);
  await chrome.storage.sync.set({ blocked: next });
  render(next);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (await addDomain(domainInput.value)) domainInput.value = "";
});

blockCurrentButton.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith("http")) {
    showMessage("The current tab is not a website.");
    return;
  }
  if (!(await addDomain(tab.url))) return;
  // The tab is already open, so no navigation event will close it. Close it here.
  if (enabledBox.checked) await chrome.tabs.remove(tab.id);
});

enabledBox.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: enabledBox.checked });
});

const { enabled, blocked } = await load();
enabledBox.checked = enabled;
render(blocked);
