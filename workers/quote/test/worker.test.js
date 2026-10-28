import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import worker, { unsubscribeUrl } from "../src/index.js";
import { validateQuote, normalizePhone, isFloridaZip } from "../src/validate.js";

const ORIGIN = "https://www.example.com";
const env = () => ({
  ALLOWED_ORIGINS: ORIGIN,
  TURNSTILE_HOSTNAMES: "www.example.com",
  SITE_URL: ORIGIN,
  TO_EMAIL: "owner@example.com",
  FROM_EMAIL: "no-reply@example.com",
  BREVO_API_KEY: "test-key",
  TURNSTILE_SECRET: "test-secret",
  UNSUB_SECRET: "unsub-secret",
  POSTAL_ADDRESS: "PO Box 1, Tampa, FL 33601",
  SEND_CONFIRMATION: "false",
});
const ctx = { waitUntil: (p) => pending.push(p) };
let pending = [];
let calls = [];
let turnstileResult = { success: true, hostname: "www.example.com", action: "quote" };
let brevoOk = true;

beforeEach(() => {
  calls = [];
  pending = [];
  turnstileResult = { success: true, hostname: "www.example.com", action: "quote" };
  brevoOk = true;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("turnstile")) return new Response(JSON.stringify(turnstileResult), { status: 200 });
    if (String(url).includes("brevo")) return new Response("{}", { status: brevoOk ? 201 : 500 });
    throw new Error("unexpected fetch " + url);
  };
});

const valid = {
  name: "Ana Pérez",
  phone: "(813) 378-1020",
  email: "ana@example.org",
  service: "residential",
  zip: "33755",
  message: "3 bedrooms, 2 baths",
  privacy: true,
  sms_consent: false,
  website: "",
  lang: "es",
  page: "/es/",
  turnstile: "token-123",
};
const post = (body, headers = {}) =>
  new Request("https://www.example.com/api/quote", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "cf-connecting-ip": "203.0.113.5", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

test("phone, ZIP and field validation", () => {
  assert.equal(normalizePhone("+1 (813) 378-1020"), "8133781020");
  assert.equal(normalizePhone("123-456-7890"), null);
  assert.equal(isFloridaZip("33755"), true);
  assert.equal(isFloridaZip("10001"), false);
  const r = validateQuote({ ...valid, email: "bad", zip: "1234", name: "A", privacy: false, service: "<x>" });
  assert.deepEqual(Object.keys(r.errors).sort(), ["email", "name", "privacy", "service", "zip"]);
  assert.equal(validateQuote({ ...valid, message: "x".repeat(2001) }).errors.message, "message");
  assert.equal(validateQuote(valid).ok, true);
});

test("valid request sends owner email through Brevo with reply-to and no secrets leaked", async () => {
  const res = await worker.fetch(post(valid), env(), ctx);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const ts = calls.find((c) => c.url.includes("turnstile"));
  assert.ok(ts, "turnstile verified server-side");
  assert.equal(ts.init.body.get("secret"), "test-secret");
  assert.equal(ts.init.body.get("remoteip"), "203.0.113.5");
  const brevo = calls.find((c) => c.url.includes("brevo"));
  const payload = JSON.parse(brevo.init.body);
  assert.equal(brevo.init.headers["api-key"], "test-key");
  assert.equal(payload.to[0].email, "owner@example.com");
  assert.equal(payload.replyTo.email, "ana@example.org");
  assert.match(payload.textContent, /SMS consent \/ Consentimiento SMS: no/);
  assert.ok(!payload.htmlContent.includes("<script"));
});

test("HTML in fields is escaped in the owner email", async () => {
  await worker.fetch(post({ ...valid, message: "<img src=x onerror=alert(1)>" }), env(), ctx);
  const payload = JSON.parse(calls.find((c) => c.url.includes("brevo")).init.body);
  assert.ok(payload.htmlContent.includes("&lt;img src=x onerror=alert(1)&gt;"));
});

test("SMS consent is recorded with timestamp and text", async () => {
  await worker.fetch(post({ ...valid, sms_consent: true, sms_text: "Yes, I want to receive text messages…" }), env(), ctx);
  const payload = JSON.parse(calls.find((c) => c.url.includes("brevo")).init.body);
  assert.match(payload.textContent, /SMS consent \/ Consentimiento SMS: YES \/ SÍ — \d{4}-\d{2}-\d{2}T/);
  assert.match(payload.textContent, /Yes, I want to receive text messages/);
});

test("honeypot: pretends success, sends nothing", async () => {
  const res = await worker.fetch(post({ ...valid, website: "http://spam" }), env(), ctx);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});

test("invalid fields return 422 with codes and no external calls", async () => {
  const res = await worker.fetch(post({ ...valid, phone: "12" }), env(), ctx);
  assert.equal(res.status, 422);
  assert.deepEqual((await res.json()).errors, { phone: "phone" });
  assert.equal(calls.length, 0);
});

test("failed or foreign-host Turnstile is rejected", async () => {
  turnstileResult = { success: false };
  assert.equal((await worker.fetch(post(valid), env(), ctx)).status, 403);
  turnstileResult = { success: true, hostname: "evil.example", action: "quote" };
  const res = await worker.fetch(post(valid), env(), ctx);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "captcha");
  assert.ok(!calls.some((c) => c.url.includes("brevo")));
});

test("missing Turnstile secret fails closed", async () => {
  const e = env();
  delete e.TURNSTILE_SECRET;
  assert.equal((await worker.fetch(post(valid), e, ctx)).status, 403);
});

test("wrong origin, wrong method, wrong type, oversized and bad JSON are rejected", async () => {
  assert.equal((await worker.fetch(post(valid, { origin: "https://evil.example" }), env(), ctx)).status, 403);
  assert.equal((await worker.fetch(new Request("https://www.example.com/api/quote"), env(), ctx)).status, 405);
  assert.equal((await worker.fetch(post(valid, { "content-type": "text/plain" }), env(), ctx)).status, 415);
  assert.equal((await worker.fetch(post({ ...valid, message: "x".repeat(12000) }), env(), ctx)).status, 413);
  assert.equal((await worker.fetch(post("{not json"), env(), ctx)).status, 400);
});

test("rate limiter returns 429", async () => {
  const e = { ...env(), RATE_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await worker.fetch(post(valid), e, ctx)).status, 429);
});

test("Brevo failure returns 502 so the visitor is told to call", async () => {
  brevoOk = false;
  const res = await worker.fetch(post(valid), env(), ctx);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, "server");
});

test("confirmation email carries postal address and one-click unsubscribe headers", async () => {
  const kv = new Map();
  const e = { ...env(), SEND_CONFIRMATION: "true", SUPPRESSION: { get: async (k) => kv.get(k), put: async (k, v) => kv.set(k, v) } };
  await worker.fetch(post(valid), e, ctx);
  await Promise.all(pending);
  const mails = calls.filter((c) => c.url.includes("smtp/email")).map((c) => JSON.parse(c.init.body));
  assert.equal(mails.length, 2);
  const conf = mails[1];
  assert.equal(conf.to[0].email, "ana@example.org");
  assert.match(conf.textContent, /PO Box 1, Tampa, FL 33601/);
  assert.match(conf.headers["List-Unsubscribe"], /^<https:\/\/www\.example\.com\/api\/unsubscribe\?e=/);
  assert.equal(conf.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(conf.subject, /Recibimos tu solicitud/);
});

test("unsubscribe: valid token suppresses address and blocklists it; bad token is rejected", async () => {
  const kv = new Map();
  const e = { ...env(), SUPPRESSION: { get: async (k) => kv.get(k), put: async (k, v) => kv.set(k, v) } };
  const link = await unsubscribeUrl(e, "ana@example.org", "es");
  const res = await worker.fetch(new Request(link, { method: "POST", body: "List-Unsubscribe=One-Click" }), e, ctx);
  assert.equal(res.status, 200);
  assert.equal(kv.size, 1);
  assert.ok(![...kv.keys()][0].includes("ana"), "stores a hash, not the address");
  const contact = JSON.parse(calls.find((c) => c.url.endsWith("/v3/contacts")).init.body);
  assert.equal(contact.emailBlacklisted, true);
  const get = await worker.fetch(new Request(link), e, ctx);
  assert.equal(get.status, 303);
  assert.equal(get.headers.get("location"), "https://www.example.com/es/baja/");
  const bad = await worker.fetch(new Request(link.replace(/t=[^&]+/, "t=forged")), e, ctx);
  assert.equal(bad.status, 400);
});

test("suppressed address gets no confirmation email", async () => {
  const kv = new Map();
  const e = { ...env(), SEND_CONFIRMATION: "true", SUPPRESSION: { get: async (k) => kv.get(k), put: async (k, v) => kv.set(k, v) } };
  await worker.fetch(new Request(await unsubscribeUrl(e, "ana@example.org", "en"), { method: "POST" }), e, ctx);
  calls = [];
  await worker.fetch(post(valid), e, ctx);
  await Promise.all(pending);
  assert.equal(calls.filter((c) => c.url.includes("smtp/email")).length, 1);
});
