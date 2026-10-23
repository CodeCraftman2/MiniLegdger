import AsyncStorage from "@react-native-async-storage/async-storage";
import { tokenStore } from "./token-store";

const PREFIX = "miniledger.upi.v2.";
// v1 kept one UPI ID for the whole phone, so a second account saw the first person's QR.
const LEGACY_KEY = "miniledger.upi.v1";

export type UpiProfile = { upiId: string; payeeName: string };

/** One entry per signed-in phone number, so accounts on the same device never see each other's UPI ID. */
async function keyForCurrentUser(): Promise<string | null> {
  const phone = await tokenStore.getPhone();
  return phone ? `${PREFIX}${phone}` : null;
}

/** The lender's own UPI details live on this device only; they are never sent to the API. */
export async function loadUpiProfile(): Promise<UpiProfile | null> {
  try {
    void AsyncStorage.removeItem(LEGACY_KEY);
    const key = await keyForCurrentUser();
    if (!key) return null;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UpiProfile>;
    return typeof parsed.upiId === "string" ? { upiId: parsed.upiId, payeeName: parsed.payeeName ?? "" } : null;
  } catch {
    return null;
  }
}

export async function saveUpiProfile(profile: UpiProfile): Promise<void> {
  const key = await keyForCurrentUser();
  if (key) await AsyncStorage.setItem(key, JSON.stringify(profile));
}

export async function deleteUpiProfile(): Promise<void> {
  const key = await keyForCurrentUser();
  if (key) await AsyncStorage.removeItem(key);
}
