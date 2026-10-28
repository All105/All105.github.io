// Lightweight secret scan of every tracked file (CI also runs gitleaks on the full history).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const PATTERNS = [
  ["Brevo API key", /xkeysib-[a-f0-9]{64}-[A-Za-z0-9]{16}/],
  ["Brevo SMTP key", /xsmtpsib-[a-f0-9]{64}-[A-Za-z0-9]{16}/],
  // Secret keys are longer than the public site key (which is fine to commit).
  ["Turnstile secret key", /0x4AAAAA[A-Za-z0-9_-]{25,}/],
  ["GitHub token", /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ["Cloudflare API token assignment", /(CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[=:]\s*["']?[A-Za-z0-9_-]{40}/],
  ["Private key", /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ["AWS key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Generic secret assignment", /(api[_-]?key|client[_-]?secret|secret[_-]?key)\s*[=:]\s*["'][A-Za-z0-9_\-]{24,}["']/i],
];

test("no secrets in tracked files", () => {
  let files;
  try {
    files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      // Installed packages and build output are not ours, even if .gitignore is missing.
      .filter((f) => !/^(node_modules|_site|\.cache|\.wrangler)\//.test(f) && !f.includes("/node_modules/"));
  } catch {
    return; // not a git checkout
  }
  for (const f of files) {
    if (!fs.existsSync(f) || fs.statSync(f).size > 2_000_000 || /\.(png|jpe?g|webp|ico)$/i.test(f)) continue;
    const text = fs.readFileSync(f, "utf8");
    for (const [name, re] of PATTERNS) assert.ok(!re.test(text), `${name} found in ${f}`);
  }
  assert.ok(!files.some((f) => /(^|\/)\.dev\.vars$|(^|\/)\.env$/.test(f)), ".env / .dev.vars must not be committed");
});
