import { validateEmail, validateName, type FieldErrors } from "@/utils/validation";
import { normalizePhone, validatePhone } from "@/utils/checkout";

/** Local profile details (PRD 5.7). Persisted per user on this device only. */
export interface ProfileValues {
  name: string;
  /** Contact email. The sign-in email belongs to the account and is not changed here. */
  email: string;
  /** Optional. Ten digits when given. */
  phone: string;
  /** A small image as a data URL, or null for the initials badge. */
  avatar: string | null;
}

export const AVATAR_MAX_BYTES = 200 * 1024;
export const AVATAR_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"];

export function validateProfile(values: Pick<ProfileValues, "name" | "email" | "phone">): FieldErrors<"name" | "email" | "phone"> {
  const errors: FieldErrors<"name" | "email" | "phone"> = {};
  const name = validateName(values.name);
  if (name) errors.name = name;
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  if (values.phone.trim() !== "") {
    const phone = validatePhone(values.phone);
    if (phone) errors.phone = phone;
  }
  return errors;
}

/** A readable message when the chosen file cannot be used as an avatar, otherwise null. */
export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return "Choose a PNG, JPEG or WebP image.";
  if (file.size > AVATAR_MAX_BYTES) return `Choose an image under ${Math.round(AVATAR_MAX_BYTES / 1024)} KB.`;
  return null;
}

export function isAvatarDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= AVATAR_MAX_BYTES * 2;
}

export function cleanProfile(values: ProfileValues): ProfileValues {
  return {
    name: values.name.trim().replace(/\s+/g, " "),
    email: values.email.trim(),
    phone: values.phone.trim() === "" ? "" : normalizePhone(values.phone),
    avatar: values.avatar,
  };
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

export function profilesEqual(a: ProfileValues, b: ProfileValues): boolean {
  return a.name === b.name && a.email === b.email && a.phone === b.phone && a.avatar === b.avatar;
}
