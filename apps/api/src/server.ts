import { buildApp } from "./app";
import { loadEnv } from "./config/env";

const env = loadEnv(); // throws with a readable list if anything is missing
const app = await buildApp({ env });

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0));
  });
}
