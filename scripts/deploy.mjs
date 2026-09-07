// Build the production site and publish it to the `main` branch, which GitHub
// Pages serves as-is (repository setting: Source = Deploy from a branch, main / root).
//
//   pnpm deploy
//
// Drafts are hidden (HIDE_DRAFTS=1). The source stays on the `rebuild` branch;
// `main` only ever holds the built output plus CNAME and .nojekyll.
import { execSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const out = (cmd, opts = {}) => execSync(cmd, { encoding: "utf8", ...opts }).trim();

const build = mkdtempSync(join(tmpdir(), "phai-build-"));
const worktree = mkdtempSync(join(tmpdir(), "phai-main-"));

try {
  run(`npx eleventy --output="${build}"`, { env: { ...process.env, HIDE_DRAFTS: "1" } });
  writeFileSync(join(build, ".nojekyll"), "");

  run("git fetch -q origin main");
  run(`git worktree add -q --detach "${worktree}" origin/main`);
  for (const name of readdirSync(worktree)) {
    if (name !== ".git") rmSync(join(worktree, name), { recursive: true, force: true });
  }
  cpSync(build, worktree, { recursive: true });

  run("git add -A", { cwd: worktree });
  if (!out("git status --porcelain", { cwd: worktree })) {
    console.log("Nothing to deploy: main already matches this build.");
  } else {
    const source = `${out("git rev-parse --abbrev-ref HEAD")}@${out("git rev-parse --short HEAD")}`;
    run(`git commit -q -m "Deploy site from ${source}"`, { cwd: worktree });
    run("git push -q origin HEAD:main", { cwd: worktree });
    console.log(`Deployed ${source} to main. GitHub Pages picks it up within a minute or two.`);
  }
} finally {
  try { run(`git worktree remove --force "${worktree}"`); } catch {}
  rmSync(build, { recursive: true, force: true });
}
