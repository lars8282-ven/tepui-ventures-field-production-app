import { db } from "./instant";

const ALLOWED_EMAIL_DOMAIN = "@tepuiv.com";

export function isValidEmailDomain(email: string): boolean {
  return email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN.toLowerCase());
}

/**
 * Send a magic code to the email address
 */
export async function sendMagicCode(email: string) {
  if (!isValidEmailDomain(email)) {
    throw new Error(`Email must be from ${ALLOWED_EMAIL_DOMAIN} domain`);
  }
  return await db.auth.sendMagicCode({ email });
}

/**
 * Sign in with the magic code sent to the email
 */
export async function signInWithMagicCode(email: string, code: string) {
  if (!isValidEmailDomain(email)) {
    throw new Error(`Email must be from ${ALLOWED_EMAIL_DOMAIN} domain`);
  }
  return await db.auth.signInWithMagicCode({ email, code });
}

/**
 * Sign out the current user
 */
export async function signOut() {
  return await db.auth.signOut();
}

/**
 * Get the auth object for direct access
 */
export function getAuth() {
  return db.auth;
}
