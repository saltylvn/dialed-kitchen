import { describe, expect, it } from "vitest";
import { fetchPublicPage } from "./safeFetch";

// Real-internet checks for the safe fetcher. Not part of CI (outside websites can change or
// be down); run with: NETWORK_TESTS=1 npx vitest run lib/server/safeFetch.network.test.ts
describe.skipIf(!process.env.NETWORK_TESTS)("fetchPublicPage on the real internet", () => {
  it("fetches an ordinary public page", async () => {
    const { url, html } = await fetchPublicPage("https://example.com/");
    expect(url.hostname).toBe("example.com");
    expect(html).toMatch(/<html/i);
  });

  it("refuses names that resolve to this machine (the DNS trick)", async () => {
    // These look like ordinary websites by name but point at 127.0.0.1.
    for (const link of ["https://localtest.me/", "https://127.0.0.1.nip.io/"]) {
      await expect(fetchPublicPage(link), link).rejects.toThrow(/public internet/);
    }
  });

  it("refuses literal private addresses", async () => {
    for (const link of [
      "https://127.0.0.1/",
      "https://[::1]/",
      "https://169.254.169.254/latest/meta-data/",
    ]) {
      await expect(fetchPublicPage(link), link).rejects.toThrow(/public internet/);
    }
  });

  it("checks every redirect hop", async () => {
    // A public site that redirects to a private address must be refused at the hop.
    const link = "https://httpbin.org/redirect-to?url=https%3A%2F%2F127.0.0.1%2F";
    await expect(fetchPublicPage(link)).rejects.toThrow(/public internet/);
  });

  it("refuses things that aren't web pages", async () => {
    await expect(fetchPublicPage("https://httpbin.org/image/png")).rejects.toThrow(
      /isn't a web page/,
    );
  });
});
