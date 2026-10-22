const { getDefaultConfig } = require("expo/metro-config");

// Expo's default config already understands pnpm/npm workspaces (it watches the repo root),
// so @miniledger/shared resolves to packages/shared/src without extra setup.
module.exports = getDefaultConfig(__dirname);
