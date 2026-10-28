// Lighthouse (mobile + desktop) against the local server (npm run serve). Target: ≥ 90 in all four categories.
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { chromium } from "playwright";

const BASE = process.env.LH_BASE || "http://localhost:8080";
const RUNS = Number(process.env.LH_RUNS || 3);
const PAGES = (process.env.LH_PAGES || "/en/,/es/,/es/cotizar/,/en/services/residential-cleaning/,/es/zonas/tampa/,/en/privacy/").split(",");
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-sandbox"] });
let failed = false;
const rows = [];
try {
  for (const formFactor of ["mobile", "desktop"]) {
    for (const path of PAGES) {
      const config = formFactor === "desktop"
        ? { extends: "lighthouse:default", settings: { formFactor: "desktop", screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttlingMethod: "simulate" } }
        : { extends: "lighthouse:default" };
      // Median of RUNS runs (Lighthouse varies run to run, especially on shared CPUs).
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        runs.push((await lighthouse(BASE + path, { port: chrome.port, output: "json", logLevel: "error" }, config)).lhr);
      }
      runs.sort((a, b) => a.categories.performance.score - b.categories.performance.score);
      const lhr = runs[Math.floor(runs.length / 2)];
      const s = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
      s.lcp_ms = Math.round(lhr.audits["largest-contentful-paint"].numericValue);
      s.tbt_ms = Math.round(lhr.audits["total-blocking-time"].numericValue);
      s.cls = Number(lhr.audits["cumulative-layout-shift"].numericValue.toFixed(3));
      rows.push({ formFactor, path, ...s });
      if (["performance", "accessibility", "best-practices", "seo"].some((k) => s[k] < 90)) {
        failed = true;
        const bad = Object.values(lhr.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable");
        console.log(`  ${formFactor} ${path}: ` + bad.map((a) => `${a.id}=${a.score}`).join(", "));
      }
    }
  }
} finally {
  await chrome.kill();
}
console.table(rows);
process.exit(failed ? 1 : 0);
