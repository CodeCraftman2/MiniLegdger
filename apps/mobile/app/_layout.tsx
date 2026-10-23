import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/lib/auth";
import { PERSIST_MAX_AGE, persister, queryClient } from "../src/lib/query";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: PERSIST_MAX_AGE, buster: "v2" }}
        // Cache is back from disk: send any add-entry or payment actions that were queued while offline.
        onSuccess={() => {
          void queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries());
        }}
      >
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
