import { getSafeRedirectPath } from "./redirect";

describe("getSafeRedirectPath", () => {
  it("returns the fallback when nothing is provided", () => {
    expect(getSafeRedirectPath(undefined)).toBe("/");
    expect(getSafeRedirectPath(null)).toBe("/");
    expect(getSafeRedirectPath("")).toBe("/");
    expect(getSafeRedirectPath(undefined, "/dashboard")).toBe("/dashboard");
  });

  it("allows in-app paths, including query strings", () => {
    expect(getSafeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath("/search?q=shoes&page=2")).toBe("/search?q=shoes&page=2");
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(getSafeRedirectPath(["/orders", "/admin"])).toBe("/orders");
  });

  it("rejects external, protocol-relative, and backslash URLs", () => {
    expect(getSafeRedirectPath("https://evil.example")).toBe("/");
    expect(getSafeRedirectPath("//evil.example")).toBe("/");
    expect(getSafeRedirectPath("/\\evil.example")).toBe("/");
    expect(getSafeRedirectPath("javascript:alert(1)")).toBe("/");
    expect(getSafeRedirectPath("dashboard")).toBe("/");
  });

  it("rejects control characters", () => {
    expect(getSafeRedirectPath("/\t/evil.example")).toBe("/");
  });

  it("avoids redirect loops through the auth pages", () => {
    expect(getSafeRedirectPath("/login")).toBe("/");
    expect(getSafeRedirectPath("/register?next=/orders")).toBe("/");
  });
});
