import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readEstate: vi.fn(), approveEstate: vi.fn(), rejectEstate: vi.fn(), createAlert: vi.fn(), sendFcmToSupplier: vi.fn(),
}));
vi.mock("../estateRepo", () => ({ readEstate: mocks.readEstate, approveEstate: mocks.approveEstate, rejectEstate: mocks.rejectEstate }));
vi.mock("../notifications", () => ({ createAlert: mocks.createAlert }));
vi.mock("../fcm", () => ({ sendFcmToSupplier: mocks.sendFcmToSupplier }));

import { approveEstateAndNotify, rejectEstateAndNotify } from "../approvalWorkflow";

describe("approval workflow", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.approveEstate.mockResolvedValue(true); mocks.rejectEstate.mockResolvedValue(true); mocks.createAlert.mockResolvedValue(undefined); mocks.sendFcmToSupplier.mockResolvedValue({ ok: true }); });
  it("does not approve an estate that no longer exists", async () => {
    mocks.readEstate.mockResolvedValue(null);
    await expect(approveEstateAndNotify("missing", "admin")).resolves.toEqual({ success: false, error: "Estate was not found." });
    expect(mocks.approveEstate).not.toHaveBeenCalled();
  });
  it("approves and notifies the owning supplier", async () => {
    mocks.readEstate.mockResolvedValue({ id: "estate-1", name: "Green Hill", ownerSupplierId: "supplier-1" });
    await expect(approveEstateAndNotify("estate-1", "admin-1")).resolves.toEqual({ success: true });
    expect(mocks.approveEstate).toHaveBeenCalledWith("estate-1", "admin-1", undefined);
    expect(mocks.createAlert).toHaveBeenCalledWith(expect.objectContaining({ targetUserId: "supplier-1" }));
  });
  it("keeps the rejection reason in the supplier notification", async () => {
    mocks.readEstate.mockResolvedValue({ id: "estate-1", name: "Green Hill", ownerSupplierId: "supplier-1" });
    await expect(rejectEstateAndNotify("estate-1", "admin-1", "Document missing")).resolves.toEqual({ success: true });
    expect(mocks.rejectEstate).toHaveBeenCalledWith("estate-1", "admin-1", "Document missing");
    expect(mocks.createAlert).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining("Document missing") }));
  });
});
