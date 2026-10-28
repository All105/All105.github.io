// End-to-end checks in Chromium against the built site, served with the production headers (CSP included).
// Usage: npm run build && npm run test:e2e
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 8090 + Math.floor(Math.random() * 500);
const BASE = `http://localhost:${PORT}`;
let server;
let browser;

before(async () => {
  server = spawn(process.execPath, ["scripts/serve.mjs"], { env: { ...process.env, PORT: String(PORT), QUOTE_MOCK: "1" }, stdio: "pipe" });
  await new Promise((resolve) => server.stdout.once("data", resolve));
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.kill();
});

async function open(path, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await context.newPage();
  const problems = [];
  const external = [];
  page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("request", (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) external.push(r.url()); });
  await page.goto(BASE + path);
  return { context, page, problems, external };
}
const activeTitle = (page) =>
  page.evaluate(() => {
    const p = [...document.querySelectorAll(".details")].find((d) => !d.hasAttribute("aria-hidden"));
    return p.querySelector(".title-1").textContent + " " + p.querySelector(".title-2").textContent;
  });

const ALL_PAGES = [
  "/en/", "/es/", "/en/services/", "/es/servicios/", "/en/services/residential-cleaning/", "/es/servicios/limpieza-profunda/",
  "/en/areas/", "/es/zonas/", "/en/areas/tampa/", "/es/zonas/orlando/", "/en/quote/", "/es/cotizar/", "/en/contact/", "/es/contacto/",
  "/en/privacy/", "/es/privacidad/", "/en/terms/", "/es/terminos/", "/en/accessibility/", "/es/accesibilidad/", "/404.html",
];

test("no CSP violations, JS errors or third-party requests on any page", async () => {
  for (const path of ALL_PAGES) {
    const { context, page, problems, external } = await open(path);
    await page.waitForTimeout(300);
    assert.deepEqual(problems, [], `${path}: ${problems.join(" | ")}`);
    assert.deepEqual(external, [], `${path}: external requests ${external.join(", ")}`);
    await context.close();
  }
});

test("carousel: arrow keys, buttons, slide number, pause control and quote link", async () => {
  const { context, page } = await open("/en/");
  await page.waitForSelector(".cover", { state: "detached", timeout: 5000 });
  assert.equal(await activeTitle(page), "Residential cleaning");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1200);
  assert.equal(await activeTitle(page), "Commercial cleaning");
  assert.match(await page.textContent("#hero-status"), /2 of 6/);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(1200);
  assert.equal(await activeTitle(page), "Residential cleaning");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(1200);
  assert.equal(await activeTitle(page), "Deep cleaning", "wraps around backwards");
  await page.click(".arrow-right");
  await page.waitForTimeout(1200);
  assert.equal(await activeTitle(page), "Residential cleaning");
  const href = await page.evaluate(() => [...document.querySelectorAll(".details")].find((d) => !d.hasAttribute("aria-hidden")).querySelector(".discover").getAttribute("href"));
  assert.equal(href, "/en/quote/?service=residential#quote-form");
  // The bookmark was replaced by WhatsApp
  assert.match(await page.getAttribute("#details-even .bookmark", "href"), /^https:\/\/wa\.me\/1\d{10}$/);
  // Pause
  await page.click(".arrow-play");
  assert.equal(await page.getAttribute(".arrow-play", "aria-pressed"), "true");
  await page.mouse.click(5, 300); // move focus out of the slideshow
  const before = await activeTitle(page);
  await page.waitForTimeout(8000);
  assert.equal(await activeTitle(page), before, "paused slideshow does not advance");
  // Inactive details panel is hidden from assistive tech and not focusable
  const hiddenInert = await page.evaluate(() => [...document.querySelectorAll(".details[aria-hidden='true']")].every((d) => d.inert));
  assert.ok(hiddenInert);
  await context.close();
});

test("carousel autoplays when motion is allowed", async () => {
  const { context, page } = await open("/es/");
  await page.waitForSelector(".cover", { state: "detached", timeout: 5000 });
  assert.equal(await activeTitle(page), "Limpieza residencial");
  await page.waitForTimeout(9000);
  assert.notEqual(await activeTitle(page), "Limpieza residencial");
  await context.close();
});

test("prefers-reduced-motion: no cover sweep, no autoplay, arrows still work", async () => {
  const { context, page } = await open("/en/", { reducedMotion: "reduce" });
  await page.waitForTimeout(300);
  assert.equal(await page.$(".cover"), null, "cover removed immediately");
  assert.equal(await page.getAttribute(".arrow-play", "aria-pressed"), "true", "starts paused");
  await page.waitForTimeout(8000);
  assert.equal(await activeTitle(page), "Residential cleaning");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  assert.equal(await activeTitle(page), "Commercial cleaning", "instant change without animation");
  await context.close();
});

test("touch swipe on mobile changes the slide", async () => {
  const { context, page } = await open("/en/", { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  await page.waitForSelector(".cover", { state: "detached", timeout: 5000 });
  const cdp = await context.newCDPSession(page);
  const swipe = async (x1, x2) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: 300 }] });
    for (let i = 1; i <= 5; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1 + ((x2 - x1) * i) / 5, y: 302 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await swipe(320, 80);
  await page.waitForTimeout(1300);
  assert.equal(await activeTitle(page), "Commercial cleaning", "swipe left → next");
  await swipe(80, 320);
  await page.waitForTimeout(1300);
  assert.equal(await activeTitle(page), "Residential cleaning", "swipe right → previous");
  await context.close();
});

test("mobile: no horizontal scroll on any page, menu opens and closes", async () => {
  for (const path of ALL_PAGES) {
    const { context, page } = await open(path, { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `${path}: horizontal overflow ${overflow}px`);
    await context.close();
  }
  const { context, page } = await open("/es/servicios/", { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  assert.equal(await page.isVisible("#nav-menu"), false);
  await page.click(".nav-toggle");
  assert.equal(await page.isVisible("#nav-menu"), true);
  assert.equal(await page.getAttribute(".nav-toggle", "aria-expanded"), "true");
  assert.equal(await page.isVisible(".nav-call-mobile"), true, "call button visible on mobile");
  await page.keyboard.press("Escape");
  assert.equal(await page.isVisible("#nav-menu"), false);
  await context.close();
});

test("language: root follows the browser, then the saved choice", async () => {
  let s = await open("/", { locale: "es-MX" });
  await s.page.waitForURL(BASE + "/es/");
  await s.context.close();
  s = await open("/", { locale: "en-US" });
  await s.page.waitForURL(BASE + "/en/");
  // Switch to ES on a service page → lands on the Spanish version of the same page and remembers it
  await s.page.goto(BASE + "/en/services/deep-cleaning/");
  await s.page.click('.lang-switch a[data-set-lang="es"]');
  await s.page.waitForURL(BASE + "/es/servicios/limpieza-profunda/");
  assert.equal(await s.page.evaluate(() => localStorage.getItem("acg-lang")), "es");
  const cookies = await s.context.cookies();
  assert.equal(cookies.length, 0, "no cookies set");
  await s.page.goto(BASE + "/");
  await s.page.waitForURL(BASE + "/es/");
  await s.context.close();
});

test("quote form: preselected service, localized errors, valid submission", async () => {
  const { context, page } = await open("/es/cotizar/?service=deep#quote-form");
  assert.equal(await page.inputValue("#f-service"), "deep");
  await page.click('button[type="submit"]');
  assert.equal(await page.isVisible("#form-errors"), true);
  assert.match(await page.textContent("#err-name"), /Escribe tu nombre/);
  assert.match(await page.textContent("#err-privacy"), /Política de privacidad/);
  assert.equal(await page.evaluate(() => document.activeElement.id), "f-name", "focus moves to first error");
  assert.equal(await page.getAttribute("#f-name", "aria-invalid"), "true");

  await page.fill("#f-name", "Ana Pérez");
  await page.fill("#f-phone", "813-378-1020");
  await page.fill("#f-email", "ana@example.org");
  await page.fill("#f-zip", "10001");
  await page.check("#f-privacy");
  await page.click('button[type="submit"]');
  assert.match(await page.textContent("#err-zip"), /Florida/);

  await page.fill("#f-zip", "33602");
  await page.fill("#f-message", "Casa de 3 habitaciones");
  assert.equal(await page.isChecked("#f-sms"), false, "SMS unchecked by default");
  await page.check("#f-sms");
  await page.click('button[type="submit"]');
  await page.waitForSelector(".form-status.is-success");
  assert.match(await page.textContent("#form-status"), /Hemos recibido tu solicitud/);
  const log = await (await fetch(`${BASE}/__mock_log`)).json();
  const sent = JSON.parse(log.at(-1));
  assert.equal(sent.service, "deep");
  assert.equal(sent.zip, "33602");
  assert.equal(sent.privacy, true);
  assert.equal(sent.sms_consent, true);
  assert.match(sent.sms_text, /Responde STOP/);
  assert.equal(sent.website, "");
  assert.equal(sent.lang, "es");
  await context.close();
});

test("keyboard-only: skip link and form reachable", async () => {
  const { context, page } = await open("/en/quote/");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.className), "skip-link");
  await page.keyboard.press("Enter");
  let found = false;
  for (let i = 0; i < 25 && !found; i++) {
    await page.keyboard.press("Tab");
    found = (await page.evaluate(() => document.activeElement.id)) === "f-name";
  }
  assert.ok(found, "name field reachable with Tab");
  const honeypotFocusable = await page.evaluate(() => document.getElementById("f-website").tabIndex);
  assert.equal(honeypotFocusable, -1);
  await context.close();
});

test("analytics: nothing loads before consent; loads after Allow; GPC suppresses the banner", async () => {
  const withToken = async (gpc) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    if (gpc) await context.addInitScript(() => Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { get: () => true }));
    const beacon = [];
    await context.route("https://static.cloudflareinsights.com/**", (r) => { beacon.push(r.request().url()); r.fulfill({ status: 200, contentType: "text/javascript", body: "" }); });
    // Simulate a configured token: add data-cf-token and the banner markup the template renders when a token is set.
    await context.route(BASE + "/en/contact/", async (r) => {
      const res = await r.fetch();
      let html = await res.text();
      html = html.replace('<body class="" data-lang="en">', '<body class="" data-lang="en" data-cf-token="test-token">')
        .replace("</footer>", '</footer><div class="consent" id="consent" role="region" aria-label="Analytics consent" hidden><p>Analytics?</p><div class="consent-actions"><button type="button" class="btn btn-ghost" data-consent="no">No</button><button type="button" class="btn btn-primary" data-consent="yes">Allow</button></div></div>');
      await r.fulfill({ response: res, body: html });
    });
    const page = await context.newPage();
    await page.goto(BASE + "/en/contact/");
    return { context, page, beacon };
  };
  let s = await withToken(false);
  assert.equal(await s.page.isVisible("#consent"), true, "banner shown");
  await s.page.waitForTimeout(500);
  assert.equal(s.beacon.length, 0, "no analytics before consent");
  await s.page.click('[data-consent="yes"]');
  await s.page.waitForTimeout(500);
  assert.equal(s.beacon.length, 1, "beacon loaded after Allow");
  assert.equal(await s.page.evaluate(() => localStorage.getItem("acg-consent")), "yes");
  await s.context.close();

  s = await withToken(false);
  await s.page.click('[data-consent="no"]');
  await s.page.reload();
  await s.page.waitForTimeout(500);
  assert.equal(s.beacon.length, 0, "rejected → never loaded");
  assert.equal(await s.page.isVisible("#consent"), false, "choice remembered");
  await s.context.close();

  s = await withToken(true);
  await s.page.waitForTimeout(500);
  assert.equal(await s.page.isVisible("#consent"), false, "GPC: no banner");
  assert.equal(s.beacon.length, 0, "GPC: no analytics");
  await s.context.close();
});
