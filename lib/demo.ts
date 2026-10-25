// The shared demo account for hiring teams (docs/decisions/0026). Its email isn't secret
// (the database allow-lists it by email); its password is, and lives only in the server's
// environment.
export const DEMO_EMAIL = "demo@dialed-kitchen.vercel.app";

export function isDemoEmail(email: string | null | undefined): boolean {
  return email?.toLowerCase() === DEMO_EMAIL;
}
