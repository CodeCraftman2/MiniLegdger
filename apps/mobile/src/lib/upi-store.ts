import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "miniledger.upi.v1";

export type UpiProfile = { upiId: string; payeeName: string };

/** The lender's own UPI details live on this device only; they are never sent to the API. */
export async function loadUpiProfile(): Promise<UpiProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UpiProfile>;
    return typeof parsed.upiId === "string" ? { upiId: parsed.upiId, payeeName: parsed.payeeName ?? "" } : null;
  } catch {
    return null;
  }
}

export async function saveUpiProfile(profile: UpiProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
}
