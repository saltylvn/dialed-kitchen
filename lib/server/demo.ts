import "server-only";
import { DEMO_EMAIL } from "@/lib/demo";

// The demo's password, read only on the server. No password set means no demo: the
// "Try the demo" button is hidden.
export function demoPassword(): string | null {
  const password = process.env.DEMO_PASSWORD?.trim();
  return password && password.length >= 16 ? password : null;
}

export const demoEmail = DEMO_EMAIL;
