// Content Security Policy: the browser's allow-list for what a page may load and run.
// Its main job is to stop injected scripts (cross-site scripting): only scripts carrying
// this request's random nonce, and the scripts those load, are allowed to run.
// See docs/decisions/0006-security-headers-and-strict-csp.md.

type CspOptions = {
  nonce: string;
  isDev: boolean;
};

export function buildCsp({ nonce, isDev }: CspOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic': scripts loaded by a nonced script are trusted too (Next.js chunks).
    // 'unsafe-eval' only in development: React uses eval for better error stacks there.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Dev tooling injects unnonced styles; production allows only nonced <style> tags.
    "style-src": ["'self'", isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"], // next/font serves Google Fonts from our own domain
    "connect-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"], // no one may show this app inside a frame (clickjacking)
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

// A fresh, unguessable nonce for each request: 16 random bytes, base64-encoded.
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
