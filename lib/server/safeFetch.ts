import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { isPublicAddress } from "../security/publicAddress";
import { checkFetchUrl } from "../security/fetchUrl";

// Fetches a web page from a link someone pasted, safely (docs/decisions/0015):
//  • https on the normal port only; no passwords in the link (lib/security/fetchUrl)
//  • every address the name resolves to must be public, checked at connect time inside
//    the DNS lookup itself, so a site can't pass the check and then switch to a private
//    address (DNS rebinding)
//  • redirects followed by hand (at most 3), each hop checked the same way
//  • 10 seconds and 3 MB at most; HTML pages only

const MAX_REDIRECTS = 3;
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "DialedKitchenRecipeImporter/1.0 (+https://dialed-kitchen.vercel.app)";

export class FetchRefused extends Error {} // the link or page isn't allowed or usable

// Resolves the name, and fails unless every address is public. Used by the connection
// itself, so the address checked is the address connected to.
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as LookupAddress[];
    if (list.length === 0 || !list.every((a) => isPublicAddress(a.address))) {
      return callback(new FetchRefused("That address isn't on the public internet"), "", 0);
    }
    if (options.all) return (callback as (e: null, a: LookupAddress[]) => void)(null, list);
    const first = list[0]!;
    callback(null, first.address, first.family);
  });
};

function getOnce(
  url: URL,
  signal: AbortSignal,
): Promise<{ status: number; location: string | null; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        lookup: publicOnlyLookup,
        signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
          "accept-encoding": "identity", // no compressed responses to unpack
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location ?? null, body: "" });
        }
        const type = res.headers["content-type"] ?? "";
        if (status === 200 && !/text\/html|application\/xhtml\+xml/i.test(type)) {
          res.destroy();
          return reject(new FetchRefused("That link isn't a web page"));
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new FetchRefused("That page is too large"));
          } else {
            chunks.push(chunk);
          }
        });
        res.on("end", () =>
          resolve({ status, location: null, body: Buffer.concat(chunks).toString("utf8") }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

export async function fetchPublicPage(link: string): Promise<{ url: URL; html: string }> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = checkFetchUrl(link);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // A literal IP address skips DNS (and so the lookup check): check it directly.
    if (
      isIP(url.hostname.replace(/^\[|\]$/g, "")) &&
      !isPublicAddress(url.hostname.replace(/^\[|\]$/g, ""))
    ) {
      throw new FetchRefused("That address isn't on the public internet");
    }
    const { status, location, body } = await getOnce(url, signal);
    if (status >= 300 && status < 400) {
      if (!location) throw new FetchRefused("That page redirects nowhere");
      url = checkFetchUrl(new URL(location, url).toString()); // every hop is checked again
      continue;
    }
    // Some big recipe sites block every request that isn't a person's own browser (bot
    // protection). We respect that rather than trying to get around it.
    if (status === 401 || status === 403 || status === 429) {
      throw new FetchRefused(
        "That site doesn't let apps read its recipes. Take a screenshot of the recipe and import it from a photo instead.",
      );
    }
    if (status === 404 || status === 410)
      throw new FetchRefused("That page wasn't found. Check the link.");
    if (status !== 200) throw new FetchRefused(`That site answered with an error (${status})`);
    return { url, html: body };
  }
  throw new FetchRefused("That link redirects too many times");
}
