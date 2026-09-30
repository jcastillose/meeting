import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const dir = await mkdtemp(join(tmpdir(), "atmeet-schedule-"));
try {
  for (const name of ["confirmation-integration", "availability-draft", "schedule-editor", "daily-ranges", "calendar-export", "performance", "account-roles", "account-requests", "admin", "notifications", "management"]) {
    const outfile = join(dir, name + ".mjs");
    await build({
      entryPoints: ["scripts/test-" + name + ".mjs"],
      outfile,
      bundle: true,
      platform: "node",
      format: "esm",
    });
    execFileSync(process.execPath, [outfile], { stdio: "inherit" });
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
