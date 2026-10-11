/** Single entry point for estate approval/rejection + supplier notification. */
import { approveEstate, readEstate, rejectEstate } from "./estateRepo";
import { sendFcmToSupplier } from "./fcm";
import { createAlert } from "./notifications";

async function notifySupplier(
  supplierId: string | null,
  title: string,
  body: string,
  estateId: string,
  status: "approved" | "rejected",
): Promise<void> {
  if (!supplierId) return;
  await Promise.allSettled([
    createAlert({ targetUserId: supplierId, title, body, type: "general" }),
    sendFcmToSupplier({
      token: `fcm:${supplierId}`,
      title,
      body,
      data: { targetUserId: supplierId, type: "estate", estateId, status },
    }),
  ]);
}

export async function approveEstateAndNotify(
  estateId: string,
  adminId: string,
  adminNotes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const estate = await readEstate(estateId);
    if (!estate) return { success: false, error: "Estate was not found." };
    await approveEstate(estateId, adminId, adminNotes);
    await notifySupplier(
      estate.ownerSupplierId,
      "වත්ත අනුමත විය!",
      `“${estate.name}” වත්ත අනුමත කර ඇත. දැන් ඔබට වත්ත කළමනාකරණය කළ හැකිය.`,
      estateId,
      "approved",
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Estate approval failed." };
  }
}

export async function rejectEstateAndNotify(
  estateId: string,
  adminId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const estate = await readEstate(estateId);
    if (!estate) return { success: false, error: "Estate was not found." };
    await rejectEstate(estateId, adminId, reason);
    await notifySupplier(
      estate.ownerSupplierId,
      "වත්ත ලියාපදිංචිය ප්‍රතික්ෂේප විය",
      `“${estate.name}” — ${reason}`,
      estateId,
      "rejected",
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Estate rejection failed." };
  }
}
