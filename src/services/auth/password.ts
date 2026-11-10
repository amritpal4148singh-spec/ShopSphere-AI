/**
 * Salted SHA-256 so credentials are never kept in plain text in browser storage.
 * This is a development-stage mock (PRD section 11.2): real systems hash on the server
 * with a slow algorithm (argon2/bcrypt) and never trust the client.
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}
