import {
  hasErrors,
  normalizeEmail,
  validateEmail,
  validateLogin,
  validateName,
  validateNewPassword,
  validateRegistration,
} from "./validation";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Name@Example.COM ")).toBe("name@example.com");
  });
});

describe("validateEmail", () => {
  it("accepts a valid address, ignoring surrounding whitespace", () => {
    expect(validateEmail("name@example.com")).toBeNull();
    expect(validateEmail("  name@example.com  ")).toBeNull();
  });

  it("rejects empty and malformed addresses with a specific message", () => {
    expect(validateEmail("")).toBe("Enter your email address.");
    expect(validateEmail("   ")).toBe("Enter your email address.");
    expect(validateEmail("name")).toBe("Enter a valid email address, like name@example.com.");
    expect(validateEmail("name@")).toBe("Enter a valid email address, like name@example.com.");
    expect(validateEmail("name@example")).toBe("Enter a valid email address, like name@example.com.");
    expect(validateEmail("na me@example.com")).toBe("Enter a valid email address, like name@example.com.");
  });

  it("rejects an extremely long address", () => {
    expect(validateEmail(`${"a".repeat(250)}@example.com`)).not.toBeNull();
  });
});

describe("validateName", () => {
  it("accepts a normal name and rejects empty, too short, and too long names", () => {
    expect(validateName("Asha Rao")).toBeNull();
    expect(validateName("")).toBe("Enter your name.");
    expect(validateName("A")).toBe("Name must be 2 to 60 characters.");
    expect(validateName("a".repeat(61))).toBe("Name must be 2 to 60 characters.");
  });
});

describe("validateNewPassword", () => {
  it("requires length, a letter, and a number", () => {
    expect(validateNewPassword("")).toBe("Create a password.");
    expect(validateNewPassword("short1")).toBe("Use at least 8 characters.");
    expect(validateNewPassword("onlyletters")).toBe("Include at least one letter and one number.");
    expect(validateNewPassword("12345678")).toBe("Include at least one letter and one number.");
    expect(validateNewPassword("a1".repeat(65))).toBe("Use no more than 128 characters.");
    expect(validateNewPassword("Password123")).toBeNull();
  });
});

describe("validateLogin", () => {
  it("reports each failing field separately", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
    expect(validateLogin({ email: "name@example.com", password: "" })).toEqual({ password: "Enter your password." });
    expect(hasErrors(validateLogin({ email: "name@example.com", password: "x" }))).toBe(false);
  });
});

describe("validateRegistration", () => {
  const valid = { name: "Asha Rao", email: "asha@example.com", password: "Password123", confirmPassword: "Password123" };

  it("passes valid input", () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it("flags a password mismatch on the confirmation field", () => {
    expect(validateRegistration({ ...valid, confirmPassword: "Different123" })).toEqual({
      confirmPassword: "Passwords do not match.",
    });
  });

  it("flags every empty field", () => {
    const errors = validateRegistration({ name: "", email: "", password: "", confirmPassword: "" });
    expect(Object.keys(errors).sort()).toEqual(["confirmPassword", "email", "name", "password"]);
  });
});
