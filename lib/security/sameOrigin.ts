// Cross-site request forgery (CSRF) guard for POST route handlers: accept a request only
// when the browser says it came from a page on this same site. (Server actions get this
// check from Next.js automatically; plain route handlers don't.)
//
// Browsers always send the Origin header on POST requests and pages can't fake it, so a
// missing or different Origin means the request came from somewhere else.
export function isSameOrigin(originHeader: string | null, requestUrl: string): boolean {
  if (!originHeader) return false;
  try {
    return new URL(originHeader).origin === new URL(requestUrl).origin;
  } catch {
    return false; // malformed Origin, e.g. "null" from a sandboxed page
  }
}
