import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setSessionExpiredHandler } from "./api";
import { queryClient } from "./query";
import { tokenStore } from "./token-store";

type Status = "loading" | "signedOut" | "signedIn";

type AuthContextValue = {
  status: Status;
  signIn: (phone: string, otp: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");

  const signOut = useCallback(async () => {
    await tokenStore.clear();
    queryClient.clear(); // never show one user's cached ledger to the next person
    setStatus("signedOut");
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      void signOut();
    });
    // A stored refresh token means the user was signed in. The first API call mints an access token.
    tokenStore
      .getRefresh()
      .then((t) => setStatus(t ? "signedIn" : "signedOut"))
      .catch(() => setStatus("signedOut"));
  }, [signOut]);

  const signIn = useCallback(async (phone: string, otp: string) => {
    const tokens = await api.verifyOtp(phone, otp);
    queryClient.clear();
    await tokenStore.save(tokens);
    await tokenStore.setPhone(phone);
    setStatus("signedIn");
  }, []);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
