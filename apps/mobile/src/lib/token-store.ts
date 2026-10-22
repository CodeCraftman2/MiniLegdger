import * as SecureStore from "expo-secure-store";

const ACCESS = "ml.accessToken";
const REFRESH = "ml.refreshToken";

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
  async clear() {
    accessToken = null;
    await SecureStore.deleteItemAsync(REFRESH);
    await SecureStore.deleteItemAsync(ACCESS).catch(() => undefined);
  },
};
