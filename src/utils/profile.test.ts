import { cleanProfile, initialsOf, isAvatarDataUrl, profilesEqual, validateAvatarFile, validateProfile, AVATAR_MAX_BYTES } from "./profile";

describe("validateProfile", () => {
  const ok = { name: "Uma Customer", email: "uma@example.com", phone: "9876543210" };

  it("accepts a complete profile and an empty optional phone", () => {
    expect(validateProfile(ok)).toEqual({});
    expect(validateProfile({ ...ok, phone: "" })).toEqual({});
  });

  it("reports field-specific errors", () => {
    expect(validateProfile({ name: "", email: "nope", phone: "123" })).toEqual({
      name: expect.any(String),
      email: expect.any(String),
      phone: "Enter a valid 10-digit mobile number.",
    });
  });

  it("accepts +91 and spaced phone formats", () => {
    expect(validateProfile({ ...ok, phone: "+91 98765 43210" })).toEqual({});
  });
});

describe("cleanProfile", () => {
  it("trims, collapses spaces and normalises the phone", () => {
    expect(cleanProfile({ name: "  Uma   K  ", email: " a@b.co ", phone: "+91 98765 43210", avatar: null })).toEqual({ name: "Uma K", email: "a@b.co", phone: "9876543210", avatar: null });
  });
});

describe("avatar rules", () => {
  it("accepts small PNG/JPEG/WebP and rejects other types and large files", () => {
    expect(validateAvatarFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateAvatarFile({ type: "image/gif", size: 1000 })).toMatch(/PNG, JPEG or WebP/);
    expect(validateAvatarFile({ type: "image/jpeg", size: AVATAR_MAX_BYTES + 1 })).toMatch(/under/);
  });

  it("only trusts well-formed image data URLs", () => {
    expect(isAvatarDataUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(isAvatarDataUrl("data:text/html;base64,AAAA")).toBe(false);
    expect(isAvatarDataUrl("javascript:alert(1)")).toBe(false);
    expect(isAvatarDataUrl(null)).toBe(false);
  });
});

describe("helpers", () => {
  it("builds initials", () => {
    expect(initialsOf("uma customer")).toBe("UC");
    expect(initialsOf("Cher")).toBe("C");
    expect(initialsOf("   ")).toBe("?");
  });

  it("compares profiles", () => {
    const a = { name: "A", email: "a@b.co", phone: "", avatar: null };
    expect(profilesEqual(a, { ...a })).toBe(true);
    expect(profilesEqual(a, { ...a, phone: "9876543210" })).toBe(false);
  });
});
