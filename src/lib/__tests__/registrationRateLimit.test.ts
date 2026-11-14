import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fn = readFileSync(resolve(process.cwd(), "supabase/functions/rate-limit/index.ts"), "utf8");

describe("registration rate-limit edge function contract", () => {
  it("keeps the users-table duplicate check as the account-exists verdict", () => {
    expect(fn).toContain('from("users").select("id")');
    expect(fn).toContain('"account_exists"');
  });

  it("limits attempts per connection (IP) only, never per email/phone history", () => {
    expect(fn).toContain("ipCount < 6");
    // A failed first attempt must not lock the same email/phone out for 24h.
    expect(fn).not.toContain("duplicateEmail");
    expect(fn).not.toContain("duplicatePhone");
    expect(fn).not.toContain("86_400_000");
  });

  it("keeps registration audit logging for allowed and blocked attempts", () => {
    expect(fn).toContain('"registration_attempt"');
    expect(fn).toContain('"registration_blocked"');
    expect(fn).toContain("admin_audit_log");
  });

  it("stays read-only for office data and anonymous-call safe (no auth.uid dependency)", () => {
    expect(fn).not.toContain("auth.uid");
    expect(fn).not.toContain("auth.jwt");
  });
});
