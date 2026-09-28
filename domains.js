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

// A domain also covers its subdomains: "reddit.com" covers "old.reddit.com",
// but not "notreddit.com".
function covers(domain, host) {
  return host === domain || host.endsWith(`.${domain}`);
}

// An allowed domain wins over a blocked one: with "youtube.com" blocked and
// "music.youtube.com" allowed, only music.youtube.com stays open.
export function isBlocked(url, blockedDomains, allowedDomains) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // Only websites; chrome://, file:// and similar pages also have hostnames.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return (
    blockedDomains.some((d) => covers(d, host)) && !allowedDomains.some((d) => covers(d, host))
  );
}
