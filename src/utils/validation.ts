/** Pure form validators shared by the auth forms and the auth service. Each returns user-facing messages. */

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const EMAIL_MAX_LENGTH = 254;
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 60;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (value.length === 0) return "Enter your email address.";
  if (value.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(value)) {
    return "Enter a valid email address, like name@example.com.";
  }
  return null;
}

export function validateName(name: string): string | null {
  const value = name.trim();
  if (value.length === 0) return "Enter your name.";
  if (value.length < NAME_MIN_LENGTH || value.length > NAME_MAX_LENGTH) {
    return `Name must be ${NAME_MIN_LENGTH} to ${NAME_MAX_LENGTH} characters.`;
  }
  return null;
}

export function validateNewPassword(password: string): string | null {
  if (password.length === 0) return "Create a password.";
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use no more than ${PASSWORD_MAX_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "Include at least one letter and one number.";
  return null;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

export function validateLogin(values: { email: string; password: string }): FieldErrors<"email" | "password"> {
  const errors: FieldErrors<"email" | "password"> = {};
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  if (values.password.length === 0) errors.password = "Enter your password.";
  return errors;
}

export function validateRegistration(values: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): FieldErrors<"name" | "email" | "password" | "confirmPassword"> {
  const errors: FieldErrors<"name" | "email" | "password" | "confirmPassword"> = {};
  const nameError = validateName(values.name);
  if (nameError) errors.name = nameError;
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  const passwordError = validateNewPassword(values.password);
  if (passwordError) errors.password = passwordError;
  if (values.confirmPassword.length === 0) errors.confirmPassword = "Confirm your password.";
  else if (values.confirmPassword !== values.password) errors.confirmPassword = "Passwords do not match.";
  return errors;
}
