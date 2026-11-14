import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  or: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabaseConfigured: true,
  getSupabase: () => ({
    from: () => ({ select: () => ({ or: mocks.or }) }),
    functions: { invoke: mocks.invoke },
  }),
}));

import {
  REGISTRATION_DUPLICATE_CHECK_TIMEOUT_MS,
  REGISTRATION_GUARD_TIMEOUT_MS,
  validateRegistration,
  withTimeout,
} from "../registrationHardening";

function noDuplicates() {
  mocks.or.mockReturnValue({ limit: () => Promise.resolve({ data: [], error: null }) });
}

beforeEach(() => {
  mocks.or.mockReset();
  mocks.invoke.mockReset();
  noDuplicates();
});

describe("withTimeout", () => {
  it("resolves a fast promise unchanged", async () => {
    await expect(withTimeout(Promise.resolve("value"), 1000, "Step")).resolves.toBe("value");
  });

  it("rejects a stalled promise with a labelled error", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 500, "Test step");
    const expectation = expect(pending).rejects.toThrow("Test step timed out after 1s");
    await vi.advanceTimersByTimeAsync(600);
    await expectation;
    vi.useRealTimers();
  });
});

describe("supplier registration hardening", () => {
  it("rejects an email/phone that already exists in the users table", async () => {
    mocks.or.mockReturnValue({ limit: () => Promise.resolve({ data: [{ id: "existing" }], error: null }) });
    await expect(validateRegistration({ email: "Dup@KDU.com", phone: "+94 77 111 1111" }))
      .rejects.toThrow("An account with this phone/email already exists");
  });

  it("surfaces a users-table read failure instead of guessing", async () => {
    mocks.or.mockReturnValue({ limit: () => Promise.resolve({ data: null, error: { message: "permission denied" } }) });
    await expect(validateRegistration({ email: "new@kdu.com" }))
      .rejects.toThrow("Could not validate registration: permission denied");
  });

  it("enforces a real account_exists verdict from the rate-limit guard", async () => {
    mocks.invoke.mockResolvedValue({ data: { allowed: false, reason: "account_exists" }, error: null });
    await expect(validateRegistration({ email: "new@kdu.com" }))
      .rejects.toThrow("An account with this phone/email already exists");
  });

  it("enforces a real rate-limit verdict with an accurate message", async () => {
    mocks.invoke.mockResolvedValue({ data: { allowed: false, reason: "rate_limit" }, error: null });
    await expect(validateRegistration({ email: "new@kdu.com" }))
      .rejects.toThrow("Too many registration attempts from this connection");
  });

  it("passes when the rate-limit guard allows the attempt", async () => {
    mocks.invoke.mockResolvedValue({ data: { allowed: true, reason: "allowed" }, error: null });
    await expect(validateRegistration({ email: "new@kdu.com" })).resolves.toBeUndefined();
  });

  it("continues registration when the rate-limit edge function is unavailable (not deployed, crashed or offline)", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error("FunctionsHttpError: Edge Function returned a non-2xx status code") });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(validateRegistration({ email: "new@kdu.com" })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("continues registration when the functions relay itself fails", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error("FunctionsRelayError: Failed to send a request to the Edge Function") });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(validateRegistration({ email: "new@kdu.com" })).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it("never spins forever when the rate-limit guard hangs (connection never settles)", async () => {
    mocks.invoke.mockReturnValue(new Promise(() => {}));
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pending = validateRegistration({ email: "new@kdu.com" });
    const expectation = expect(pending).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(REGISTRATION_GUARD_TIMEOUT_MS + 100);
    await expectation;
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    vi.useRealTimers();
  });

  it("fails fast with a clear message when the duplicate check hangs", async () => {
    mocks.or.mockReturnValue({ limit: () => new Promise(() => {}) });
    vi.useFakeTimers();
    const pending = validateRegistration({ email: "new@kdu.com" });
    const expectation = expect(pending).rejects.toThrow("Account duplicate check timed out");
    await vi.advanceTimersByTimeAsync(REGISTRATION_DUPLICATE_CHECK_TIMEOUT_MS + 100);
    await expectation;
    vi.useRealTimers();
  });
});
