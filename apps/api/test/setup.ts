// Runs before every test file. DATABASE_URL must point at a throwaway Postgres (CI uses a service container).
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.RATE_LIMIT_MAX = "100000";
process.env.OTP_RATE_LIMIT_MAX = "100000";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to run the API tests (see apps/api/.env.example)");
}
