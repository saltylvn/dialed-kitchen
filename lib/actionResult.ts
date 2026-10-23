// What every server action returns: data on success, or a message that's safe to show.
// Database and library errors are logged on the server and never sent to the browser as-is.
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const GENERIC_ERROR = "Something went wrong. Please try again.";

// Turns an error into a message for the user. Only messages on the allow-list (our own
// friendly messages, raised by database functions) are passed through.
export function userMessage(error: { message?: string } | null, allowed: readonly string[]) {
  const message = error?.message ?? "";
  return allowed.find((m) => message.includes(m)) ?? GENERIC_ERROR;
}
