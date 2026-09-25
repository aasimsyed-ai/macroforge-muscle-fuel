import { describe, expect, it } from "vitest";

import { parseAuthCallback, resolveAuthView } from "../src/lib/auth-state";

describe("resolveAuthView", () => {
  it("treats a session that is still restoring as restoring, not logged out", () => {
    expect(resolveAuthView({ loading: true, hasSession: false })).toBe("restoring");
  });
  it("shows the app whenever a session exists, even while loading", () => {
    expect(resolveAuthView({ loading: false, hasSession: true })).toBe("authenticated");
    expect(resolveAuthView({ loading: true, hasSession: true })).toBe("authenticated");
  });
  it("is unauthenticated only after restoring finished with no session", () => {
    expect(resolveAuthView({ loading: false, hasSession: false })).toBe("unauthenticated");
  });
});

describe("parseAuthCallback", () => {
  it("ignores a normal URL", () => {
    expect(parseAuthCallback("", "")).toEqual({ kind: "none" });
  });
  it("recognises an implicit-flow verification redirect (hash tokens)", () => {
    expect(parseAuthCallback("", "#access_token=a&refresh_token=b&type=signup").kind).toBe(
      "pending",
    );
  });
  it("recognises a PKCE code redirect", () => {
    expect(parseAuthCallback("?code=abc", "").kind).toBe("pending");
  });
  it("reports an expired link instead of silently dropping it", () => {
    const result = parseAuthCallback(
      "",
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.message).toMatch(/expired/i);
  });
  it("reports an unknown error message", () => {
    const result = parseAuthCallback("?error=server_error&error_description=Boom", "");
    expect(result).toEqual({ kind: "error", message: "Boom" });
  });
});
