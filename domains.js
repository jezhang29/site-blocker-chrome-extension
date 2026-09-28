// Turns user input such as "https://www.YouTube.com/watch?v=1" into "youtube.com".
// Returns null when the input has no usable hostname.
export function normalizeDomain(input) {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  let host;
  try {
    host = new URL(text.includes("://") ? text : `https://${text}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  // A domain needs at least one dot ("localhost" is the one common exception).
  if (!host.includes(".") && host !== "localhost") return null;
  return host;
}

// A blocked domain also blocks its subdomains: "reddit.com" blocks "old.reddit.com",
// but not "notreddit.com".
export function isBlocked(url, blockedDomains) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // Only websites; chrome://, file:// and similar pages also have hostnames.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return blockedDomains.some((d) => host === d || host.endsWith(`.${d}`));
}
