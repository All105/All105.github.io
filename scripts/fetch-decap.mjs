// Downloads the prebuilt Decap CMS bundle from npm, checks its sha512 integrity against the
// pinned value and copies only the browser files into .cache/decap (served at /admin/vendor/).
// Decap is not installed as a dependency: its build-time dependencies are not needed at runtime.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const VERSION = "3.17.3";
const INTEGRITY = "sha512-aoNAV1throw76ieMmCVe5qb3EbhbbFdXwG+fTupQqvKVwJYnJVQiFdAwvWeP9+H5prNeXS6mrVbW9cxGD/m6tg==";
const out = path.resolve(".cache/decap");
const stamp = path.join(out, ".version");

if (fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8") === INTEGRITY) {
  console.log(`decap-cms ${VERSION} already present`);
  process.exit(0);
}
fs.mkdirSync(path.resolve(".cache"), { recursive: true }); // absent on a fresh checkout
const tmp = fs.mkdtempSync(path.resolve(".cache/decap-tmp-"));
try {
  const file = execFileSync("npm", ["pack", `decap-cms@${VERSION}`, "--silent", "--pack-destination", tmp], { encoding: "utf8" }).trim().split("\n").pop();
  const tgz = path.join(tmp, file);
  const digest = "sha512-" + crypto.createHash("sha512").update(fs.readFileSync(tgz)).digest("base64");
  if (digest !== INTEGRITY) throw new Error(`Integrity mismatch for decap-cms@${VERSION}: ${digest}`);
  execFileSync("tar", ["-xzf", tgz, "-C", tmp]);
  const dist = path.join(tmp, "package", "dist");
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(dist)) {
    if (/(^|\.)decap-cms\.js$/.test(f)) { fs.copyFileSync(path.join(dist, f), path.join(out, f)); n++; }
    if (f === "LICENSE" || f.endsWith(".LICENSE.txt")) fs.copyFileSync(path.join(dist, f), path.join(out, f));
  }
  fs.writeFileSync(stamp, INTEGRITY);
  console.log(`decap-cms ${VERSION}: ${n} files verified and copied`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
