import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  // The shared package ships TS source, so bundle it into the output.
  noExternal: ["@miniledger/shared"],
});
