import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.{ts,mjs}"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          // Integration specs land with the schema in Phase 2.
          name: "integration",
          include: ["tests/integration/**/*.test.{ts,mjs}"],
          environment: "node",
        },
      },
    ],
  },
});
