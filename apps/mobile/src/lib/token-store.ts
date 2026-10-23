import * as SecureStore from "expo-secure-store";

const ACCESS = "ml.accessToken";
const REFRESH = "ml.refreshToken";
const PHONE = "ml.phone";

let accessToken: string | null = null;

export const tokenStore = {
  getAccess: () => accessToken,
  setAccess(token: string | null) {
    accessToken = token;
  },
  getRefresh: () => SecureStore.getItemAsync(REFRESH),
  async save(tokens: { accessToken: string; refreshToken?: string }) {
    accessToken = tokens.accessToken;
    // The access token is short-lived and kept in memory only; the refresh token is what survives restarts.
    if (tokens.refreshToken) await SecureStore.setItemAsync(REFRESH, tokens.refreshToken);
  },
  /** The phone number of the signed-in account; per-account data on the device is keyed by it. */
  getPhone: () => SecureStore.getItemAsync(PHONE).catch(() => null),
  setPhone: (phone: string) => SecureStore.setItemAsync(PHONE, phone),
  async clear() {
    accessToken = null;
    await SecureStore.deleteItemAsync(PHONE).catch(() => undefined);
    await SecureStore.deleteItemAsync(REFRESH);
    await SecureStore.deleteItemAsync(ACCESS).catch(() => undefined);
  },
};
