import "server-only";
import { neon, NeonDbError } from "@neondatabase/serverless";
import { signupGateDatabaseUrl } from "./env";

// The sign-up rules, asked on behalf of Neon Auth's webhook (docs/decisions/0049). The
// rules themselves live in the database (private.check_signup, private.finish_signup);
// this only carries the question there, connected as the `signup_gate` role, which can run
// those two functions and nothing else.

export type SignupDecision =
  | { allowed: true }
  | { allowed: false; code: "INVITE_REQUIRED" | "ACCOUNT_LIMIT" | "GOOGLE_ONLY" | "REFUSED" };

function gate() {
  const url = signupGateDatabaseUrl();
  if (!url) throw new Error("SIGNUP_GATE_DATABASE_URL is not set");
  return neon(url);
}

// May this email create an account by signing in this way? A refusal by the rules comes
// back as a decision; anything else (database unreachable, misconfigured) throws, and the
// webhook then fails, which Neon Auth treats as "no" (fail closed).
export async function checkSignup(email: string, provider: string): Promise<SignupDecision> {
  try {
    await gate().query("select private.check_signup($1, $2)", [email, provider]);
    return { allowed: true };
  } catch (error) {
    // check_violation: one of the rules said no (raised by private.check_signup).
    if (error instanceof NeonDbError && error.code === "23514") {
      if (/invite required/i.test(error.message))
        return { allowed: false, code: "INVITE_REQUIRED" };
      if (/account limit/i.test(error.message)) return { allowed: false, code: "ACCOUNT_LIMIT" };
      if (/only google/i.test(error.message)) return { allowed: false, code: "GOOGLE_ONLY" };
      return { allowed: false, code: "REFUSED" };
    }
    throw error;
  }
}

// The account now exists: give it a household and use up its invite code. Safe to repeat.
export async function finishSignup(userId: string): Promise<void> {
  await gate().query("select private.finish_signup($1)", [userId]);
}
