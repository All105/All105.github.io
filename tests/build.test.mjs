// Checks on the built site (_site). Run `npm run build` first (npm test does it).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SITE = path.resolve("_site");
const site = JSON.parse(fs.readFileSync("src/content/site.json", "utf8"));
const base = (process.env.SITE_URL || site.url).replace(/\/+$/, "");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const htmlFiles = walk(SITE).filter((f) => f.endsWith(".html") && !f.includes(`${path.sep}admin${path.sep}`));
const pages = htmlFiles.map((file) => {
  const html = fs.readFileSync(file, "utf8");
  const rel = "/" + path.relative(SITE, file).split(path.sep).join("/");
  const url = rel.replace(/index\.html$/, "");
  return { file, rel, url, html };
});
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const isIndexable = (p) => !/<meta name="robots" content="noindex/.test(p.html);
const localized = pages.filter((p) => /^\/(en|es)\//.test(p.url));

test("site was built", () => {
  assert.ok(pages.length >= 40, `expected many pages, got ${pages.length}`);
});

test("no inline styles, inline scripts or inline event handlers", () => {
  for (const p of pages) {
    assert.ok(!/<style[\s>]/i.test(p.html), `${p.rel}: <style> element`);
    assert.ok(!/\sstyle\s*=/i.test(p.html), `${p.rel}: style="" attribute`);
    assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(p.html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")), `${p.rel}: inline handler`);
    for (const m of p.html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const [, attrs, body] = m;
      if (/type="application\/ld\+json"/.test(attrs)) {
        assert.doesNotThrow(() => JSON.parse(body), `${p.rel}: JSON-LD must be valid JSON`);
        continue;
      }
      const src = attr(" " + attrs, "src");
      assert.ok(src && src.startsWith("/"), `${p.rel}: scripts must be same-origin files (got ${src || "inline"})`);
      assert.equal(body.trim(), "", `${p.rel}: script with src must be empty`);
    }
  }
});

test("GSAP is self-hosted and no third-party trackers are present", () => {
  for (const p of pages) {
    assert.ok(!/cdnjs|jsdelivr|unpkg|googletagmanager|google-analytics|gtag\(|fbq\(|hotjar/i.test(p.html), `${p.rel}: third-party script reference`);
  }
  assert.ok(fs.existsSync(path.join(SITE, "assets/vendor/gsap.min.js")));
});

test("every localized page has lang, title, description, canonical and reciprocal hreflang", () => {
  const byUrl = new Map(localized.map((p) => [base + p.url, p]));
  for (const p of localized) {
    const lang = p.url.slice(1, 3);
    assert.match(p.html, new RegExp(`<html lang="${lang}-US"`), `${p.rel}: html lang`);
    assert.match(p.html, /<title>[^<]{10,}<\/title>/, `${p.rel}: title`);
    assert.match(p.html, /<meta name="description" content="[^"]{30,}">/, `${p.rel}: description`);
    assert.ok(p.html.includes(`<link rel="canonical" href="${base}${p.url}">`), `${p.rel}: canonical`);
    const en = (p.html.match(/hreflang="en-US" href="([^"]+)"/) || [])[1];
    const es = (p.html.match(/hreflang="es-US" href="([^"]+)"/) || [])[1];
    assert.ok(en && es && p.html.includes('hreflang="x-default"'), `${p.rel}: hreflang set`);
    for (const target of [en, es]) {
      const other = byUrl.get(target);
      assert.ok(other, `${p.rel}: hreflang target ${target} exists`);
      assert.ok(other.html.includes(`hreflang="${lang}-US" href="${base}${p.url}"`), `${target} must point back to ${p.url}`);
    }
    assert.ok(/class="lang-switch"/.test(p.html), `${p.rel}: EN|ES switch`);
  }
});

test("titles and descriptions are unique among indexable pages", () => {
  const seenT = new Map();
  const seenD = new Map();
  for (const p of localized.filter(isIndexable)) {
    const t = p.html.match(/<title>([^<]+)<\/title>/)[1];
    const d = p.html.match(/<meta name="description" content="([^"]+)">/)[1];
    assert.ok(!seenT.has(t), `duplicate title "${t}" in ${p.rel} and ${seenT.get(t)}`);
    assert.ok(!seenD.has(d), `duplicate description in ${p.rel} and ${seenD.get(d)}`);
    seenT.set(t, p.rel);
    seenD.set(d, p.rel);
  }
});

test("internal links and assets resolve", () => {
  for (const p of pages) {
    for (const m of p.html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)) {
      const clean = m[1].split(/[?#]/)[0];
      if (clean.startsWith("/api/") || clean.startsWith("/cms-auth/")) continue;
      const target = path.join(SITE, clean.endsWith("/") ? clean + "index.html" : clean);
      assert.ok(fs.existsSync(target), `${p.rel}: broken link ${m[1]}`);
    }
  }
});

test("all images have alt text attribute", () => {
  for (const p of pages) {
    for (const m of p.html.matchAll(/<img\b[^>]*>/g)) assert.ok(/\salt="/.test(m[0]), `${p.rel}: img without alt`);
  }
});

test("no unverified claims: credentials only when enabled, no prices, no reviews", () => {
  const c = site.credentials;
  for (const p of pages) {
    const text = p.html.replace(/<[^>]+>/g, " ");
    if (!c.licensed) assert.ok(!/\blicensed\b|con licencia/i.test(text), `${p.rel}: says licensed`);
    if (!c.insured) assert.ok(!/\binsured\b|asegurad[oa]s?\b/i.test(text), `${p.rel}: says insured`);
    if (!c.bonded) assert.ok(!/\bbonded\b|con fianza/i.test(text), `${p.rel}: says bonded`);
    assert.ok(!/\$\s?\d/.test(text), `${p.rel}: shows a price`);
    assert.ok(!/aggregateRating|"Review"/.test(p.html), `${p.rel}: rating/review markup`);
  }
});

test("quote form: required fields, privacy required, SMS optional and unchecked, honeypot", () => {
  for (const url of ["/en/quote/", "/es/cotizar/", "/en/", "/es/"]) {
    const p = pages.find((x) => x.url === url);
    const form = p.html.match(/<form class="quote-form"[\s\S]*?<\/form>/)[0];
    for (const name of ["name", "phone", "email", "service", "zip"]) {
      assert.match(form, new RegExp(`name="${name}"[^>]*required`), `${url}: ${name} required`);
    }
    assert.match(form, /name="message"/);
    assert.match(form, /id="f-privacy" name="privacy" type="checkbox" value="yes" required/);
    const sms = form.match(/<input id="f-sms"[^>]*>/)[0];
    assert.ok(!/checked|required/.test(sms), `${url}: SMS box must be optional and unchecked`);
    assert.match(form, /STOP/);
    assert.match(form, /class="hp" aria-hidden="true"[\s\S]*name="website"[^>]*tabindex="-1"/);
    assert.ok(!/password|ssn|social security number|card number/i.test(form.replace(/<p class="field-hint"[\s\S]*?<\/p>/g, "")), `${url}: sensitive fields`);
  }
});

test("legal pages exist in both languages and are flagged for attorney review", () => {
  for (const url of ["/en/privacy/", "/es/privacidad/", "/en/terms/", "/es/terminos/", "/en/accessibility/", "/es/accesibilidad/"]) {
    const p = pages.find((x) => x.url === url);
    assert.ok(p, `${url} exists`);
    if (!site.legal.reviewed_by_lawyer) assert.match(p.html, /review-banner/, `${url}: review banner`);
  }
  const priv = pages.find((x) => x.url === "/en/privacy/").html;
  for (const word of ["Brevo", "Cloudflare", "501.171", "delete", "months", "STOP"]) assert.ok(priv.includes(word), `privacy mentions ${word}`);
  assert.match(pages.find((x) => x.url === "/en/accessibility/").html, /WCAG\) 2\.1, level AA/);
});

test("structured data uses a valid LocalBusiness subtype without a street address", () => {
  const home = pages.find((x) => x.url === "/en/").html;
  const ld = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const biz = ld.find((x) => x["@type"] === "HomeAndConstructionBusiness");
  assert.ok(biz);
  assert.equal(biz.telephone, site.phone);
  assert.ok(!biz.address.streetAddress, "service-area business: no street address");
  assert.ok(biz.areaServed.length >= 3);
});

test("sitemap lists every indexable page once and robots points to it", { skip: process.env.NOINDEX === "true" }, () => {
  const xml = fs.readFileSync(path.join(SITE, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length, "no duplicates");
  for (const p of localized) {
    const listed = locs.includes(base + p.url);
    assert.equal(listed, isIndexable(p), `${p.url} indexable=${isIndexable(p)} listed=${listed}`);
  }
  const robots = fs.readFileSync(path.join(SITE, "robots.txt"), "utf8");
  assert.match(robots, new RegExp(`Sitemap: ${base}/sitemap.xml`));
  assert.match(robots, /Disallow: \/admin\//);
});

test("security headers config is strict on the public site", () => {
  const h = JSON.parse(fs.readFileSync("cloudflare/headers.json", "utf8")).site;
  const csp = h["Content-Security-Policy"];
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp), "no unsafe-* in public CSP");
  for (const d of ["default-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "object-src 'none'", "form-action 'self'"]) assert.ok(csp.includes(d), d);
  assert.match(h["Strict-Transport-Security"], /max-age=(\d{8,})/);
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["X-Frame-Options"], "DENY");
  assert.ok(h["Referrer-Policy"] && h["Permissions-Policy"]);
});

test("Decap admin is present with parallel _en/_es fields", () => {
  assert.ok(fs.existsSync(path.join(SITE, "admin/index.html")));
  assert.ok(fs.existsSync(path.join(SITE, "admin/vendor/decap-cms.js")));
  const cfg = fs.readFileSync(path.join(SITE, "admin/config.yml"), "utf8");
  for (const f of ["name_en", "name_es", "summary_en", "summary_es", "image_alt_en", "image_alt_es", "q_en", "q_es", "intro_title_en", "intro_title_es"]) assert.ok(cfg.includes(`name: ${f}`), f);
});

test("uploaded photos are web formats and not huge", () => {
  const dir = "src/assets/uploads";
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (f.startsWith(".")) continue;
    assert.match(f, /\.(jpe?g|webp|png)$/i, `${f}: use JPG or WebP`);
    assert.ok(fs.statSync(path.join(dir, f)).size < 2 * 1024 * 1024, `${f}: larger than 2 MB (target is < 400 KB)`);
  }
});

test("demo builds (NOINDEX=true) block every crawler", { skip: process.env.NOINDEX !== "true" }, () => {
  assert.match(fs.readFileSync(path.join(SITE, "robots.txt"), "utf8"), /Disallow: \/\s*$/m);
  for (const p of pages) assert.match(p.html, /<meta name="robots" content="noindex/, `${p.rel} must be noindex`);
});
