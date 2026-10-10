import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => {
  const user = { uid: "firebase-uid", getIdTokenResult: vi.fn() };
  return { user, auth: { currentUser: user }, token: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
    createUser: vi.fn(), callable: vi.fn(), profile: vi.fn(), realtime: vi.fn(), watch: vi.fn() };
});
vi.mock("firebase/app", () => ({ initializeApp: vi.fn(), deleteApp: vi.fn() }));
vi.mock("firebase/auth", () => ({ getAuth: () => m.auth, signInWithEmailAndPassword: m.signIn,
  createUserWithEmailAndPassword: m.createUser, signOut: m.signOut, onIdTokenChanged: m.watch,
  setPersistence: vi.fn(), inMemoryPersistence: {}, deleteUser: vi.fn() }));
vi.mock("firebase/functions", () => ({ getFunctions: vi.fn(), httpsCallable: () => m.callable }));
vi.mock("./firebase", () => ({ firebaseConfigured: true, initFirebase: () => ({ app: {}, auth: m.auth }) }));
vi.mock("./supabase", () => ({ supabaseConfigured: true, getSupabase: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.profile }) }) }),
  realtime: { setAuth: m.realtime }, removeAllChannels: vi.fn(),
}) }));
vi.mock("./repo", () => ({ isValidUuid: vi.fn() }));
import { signInWithEmail, watchHybridSession } from "./auth.hybrid";

beforeEach(() => {
  vi.clearAllMocks();
  m.signIn.mockResolvedValue({ user: m.user });
  m.user.getIdTokenResult.mockResolvedValue({ token: "fresh-firebase-jwt", claims: { role: "authenticated" } });
  m.profile.mockResolvedValue({ data: { id: m.user.uid, name: "Supplier", role: "supplier", status: "active" }, error: null });
});
describe("hybrid session", () => {
  it("uses Firebase identity to load the protected profile", async () => {
    const session = await signInWithEmail("person@example.test", "input-password");
    expect(session.uid).toBe(m.user.uid);
    expect(m.realtime).toHaveBeenCalledWith("fresh-firebase-jwt");
    expect(m.createUser).not.toHaveBeenCalled();
  });
  it("refreshes the ID token after receiving the authenticated database claim", async () => {
    m.user.getIdTokenResult.mockResolvedValueOnce({ token: "old", claims: {} });
    await signInWithEmail("person@example.test", "input-password");
    expect(m.callable).toHaveBeenCalledOnce();
    expect(m.user.getIdTokenResult).toHaveBeenCalledWith(true);
  });
  it("never creates an administrator after failed login", async () => {
    m.signIn.mockRejectedValueOnce({ code: "auth/invalid-credential" });
    await expect(signInWithEmail("admin@example.test", "wrong-password")).rejects.toThrow("Incorrect email or password");
    expect(m.createUser).not.toHaveBeenCalled();
  });
  it("fails closed for suspended accounts and signs out", async () => {
    m.profile.mockResolvedValueOnce({ data: { id: m.user.uid, role: "supplier", status: "suspended" }, error: null });
    await expect(signInWithEmail("person@example.test", "input-password")).rejects.toThrow("suspended");
    expect(m.signOut).toHaveBeenCalled();
  });
  it("does not auto-provision an unregistered profile", async () => {
    m.profile.mockResolvedValueOnce({ data: null, error: null });
    await expect(signInWithEmail("person@example.test", "input-password")).rejects.toThrow("not provisioned");
    expect(m.createUser).not.toHaveBeenCalled();
  });
  it("clears session subscribers when Firebase signs out", async () => {
    m.watch.mockImplementation((_auth, callback) => { callback(null); return () => {}; });
    const callback = vi.fn();
    const unsubscribe = watchHybridSession(callback);
    expect(callback).toHaveBeenCalledWith(null);
    unsubscribe();
  });
});
