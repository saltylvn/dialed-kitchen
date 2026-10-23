// Checks a link before the server fetches it (docs/decisions/0015). Throws with a message
// that's safe to show. The address check happens later, when connecting (lib/server/safeFetch).

export class LinkRefused extends Error {}

const BLOCKED_NAMES = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/i;

export function checkFetchUrl(link: string): URL {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    throw new LinkRefused("That doesn't look like a web address");
  }
  if (url.protocol !== "https:") throw new LinkRefused("Use a secure link (https://)");
  if (url.username || url.password)
    throw new LinkRefused("Links with a password in them aren't allowed");
  if (url.port && url.port !== "443") throw new LinkRefused("That link uses an unusual port");
  if (BLOCKED_NAMES.test(url.hostname) || !url.hostname.includes(".")) {
    throw new LinkRefused("That address isn't on the public internet");
  }
  if (link.length > 2000) throw new LinkRefused("That link is too long");
  url.hash = ""; // never sent to the site anyway
  return url;
}
