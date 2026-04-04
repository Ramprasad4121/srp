import { rm } from "node:fs/promises";

const targets = [
  "apps/cli/dist",
  "apps/gateway/dist",
  "apps/worker/dist",
  "apps/web/dist",
  "packages/shared-types/dist",
  "packages/ids/dist",
  "packages/config/dist",
  "packages/events/dist",
  "packages/providers/dist",
  "packages/security/dist",
  "packages/sessions/dist",
  "packages/artifacts/dist"
];

await Promise.all(
  targets.map(async (target) => {
    await rm(target, { force: true, recursive: true });
  })
);
