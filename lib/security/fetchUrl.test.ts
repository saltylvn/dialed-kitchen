import { describe, expect, it } from "vitest";
import { checkFetchUrl } from "./fetchUrl";

describe("checkFetchUrl", () => {
  it("accepts ordinary recipe links and drops the #fragment", () => {
    expect(checkFetchUrl(" https://www.example.com/recipes/tacos#comments ").toString()).toBe(
      "https://www.example.com/recipes/tacos",
    );
    expect(checkFetchUrl("https://example.com:443/a").toString()).toBe("https://example.com/a");
  });

  it.each([
    ["not a link", /web address/],
    ["http://example.com/recipe", /secure link/],
    ["ftp://example.com/recipe", /secure link/],
    ["file:///etc/passwd", /secure link/],
    ["https://user:pass@example.com/", /password/],
    ["https://example.com:8443/", /unusual port/],
    ["https://localhost/", /public internet/],
    ["https://app.localhost/", /public internet/],
    ["https://printer.local/", /public internet/],
    ["https://metadata.google.internal/", /public internet/],
    ["https://intranet/", /public internet/],
    [`https://example.com/${"a".repeat(2000)}`, /too long/],
  ])("refuses %s", (link, message) => {
    expect(() => checkFetchUrl(link)).toThrow(message);
  });
});
