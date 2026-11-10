import { profileStorage } from "@/lib/profile-storage";
import { useProfileStore } from "./profile-store";

const values = { name: "Uma Customer", email: "uma@example.com", phone: "9876543210", avatar: null };

beforeEach(() => {
  localStorage.clear();
  useProfileStore.setState({ status: "idle", ownerId: null, saved: null });
});

describe("profile store", () => {
  it("has nothing saved for a new customer and for a signed-out visitor", () => {
    useProfileStore.getState().switchOwner("u1");
    expect(useProfileStore.getState().saved).toBeNull();
    useProfileStore.getState().switchOwner(null);
    expect(useProfileStore.getState().saved).toBeNull();
  });

  it("saves a valid profile, persists it, and restores it after a reload", () => {
    useProfileStore.getState().switchOwner("u1");
    expect(useProfileStore.getState().save({ ...values, name: "  Uma  K " })).toEqual({ ok: true });
    expect(profileStorage.load("u1")).toMatchObject({ name: "Uma K", phone: "9876543210" });

    useProfileStore.setState({ status: "idle", ownerId: null, saved: null });
    useProfileStore.getState().switchOwner("u1");
    expect(useProfileStore.getState().saved?.name).toBe("Uma K");
  });

  it("refuses invalid values without saving anything", () => {
    useProfileStore.getState().switchOwner("u1");
    const result = useProfileStore.getState().save({ ...values, email: "bad" });
    expect(result).toMatchObject({ ok: false, errors: { email: expect.any(String) } });
    expect(profileStorage.has("u1")).toBe(false);
  });

  it("keeps each customer's profile separate and refuses to save when signed out", () => {
    useProfileStore.getState().switchOwner("u1");
    useProfileStore.getState().save(values);
    useProfileStore.getState().switchOwner("u2");
    expect(useProfileStore.getState().saved).toBeNull();
    useProfileStore.getState().switchOwner(null);
    expect(useProfileStore.getState().save(values)).toEqual({ ok: false, reason: "signed-out" });
  });

  it("ignores corrupt or tampered stored data", () => {
    localStorage.setItem(profileStorage.key("u1"), JSON.stringify({ name: "X", email: "x@y.co", avatar: "javascript:alert(1)" }));
    useProfileStore.getState().switchOwner("u1");
    expect(useProfileStore.getState().saved).toEqual({ name: "X", email: "x@y.co", phone: "", avatar: null });
    localStorage.setItem(profileStorage.key("u2"), "not json");
    useProfileStore.getState().switchOwner("u2");
    expect(useProfileStore.getState().saved).toBeNull();
  });
});
