// All Clean Group — quote form Worker.
// POST /api/quote        → validates, verifies Turnstile, emails the owner via Brevo.
// GET|POST /api/unsubscribe → one-click unsubscribe (RFC 8058) for confirmation emails.
import { validateQuote, isHoneypotFilled, LIMITS } from "./validate.js";
import { ownerEmail, customerEmail, sendBrevo, blocklistInBrevo } from "./email.js";
import { hmac, sha256, safeEqual, b64urlText, fromB64urlText } from "./crypto.js";

const list = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);

function json(body, status, origin) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "Origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  form.append("idempotency_key", crypto.randomUUID());
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  if (!res.ok) return false;
  const out = await res.json();
  if (!out.success) return false;
  const hosts = list(env.TURNSTILE_HOSTNAMES);
  if (hosts.length && !hosts.includes(out.hostname)) return false;
  if (out.action && out.action !== "quote") return false;
  return true;
}

export async function unsubscribeUrl(env, email, lang) {
  const e = b64urlText(email);
  const t = await hmac(env.UNSUB_SECRET, email);
  return `${env.SITE_URL}/api/unsubscribe?e=${e}&t=${t}&l=${lang}`;
}

async function handleQuote(request, env, ctx) {
  const origin = request.headers.get("origin") || "";
  const allowed = list(env.ALLOWED_ORIGINS);
  const okOrigin = allowed.includes(origin) ? origin : "";

  if (request.method === "OPTIONS") {
    if (!okOrigin) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": okOrigin,
        "access-control-allow-methods": "POST",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        vary: "Origin",
      },
    });
  }
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
  if (!okOrigin) return json({ ok: false, error: "origin" }, 403);
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return json({ ok: false, error: "type" }, 415, okOrigin);
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > LIMITS.body) return json({ ok: false, error: "size" }, 413, okOrigin);

  const ip = request.headers.get("cf-connecting-ip") || "";
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: ip || "unknown" });
    if (!success) return json({ ok: false, error: "rate" }, 429, okOrigin);
  }

  let raw;
  try {
    const text = await request.text();
    if (text.length > LIMITS.body) return json({ ok: false, error: "size" }, 413, okOrigin);
    raw = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "json" }, 400, okOrigin);
  }

  // Bots that fill the hidden field get a normal-looking answer and nothing is sent.
  if (isHoneypotFilled(raw)) return json({ ok: true }, 200, okOrigin);

  const { ok, errors, value } = validateQuote(raw);
  if (!ok) return json({ ok: false, errors }, 422, okOrigin);

  if (!(await verifyTurnstile(env, typeof raw.turnstile === "string" ? raw.turnstile : "", ip))) {
    return json({ ok: false, error: "captcha" }, 403, okOrigin);
  }

  const meta = { receivedAt: new Date().toISOString() };
  const mail = ownerEmail(value, meta);
  const sent = await sendBrevo(env, { to: env.TO_EMAIL, replyTo: value.email, ...mail }).catch(() => false);
  if (!sent) {
    console.error("brevo_owner_send_failed");
    return json({ ok: false, error: "server" }, 502, okOrigin);
  }

  if (env.SEND_CONFIRMATION === "true" && env.UNSUB_SECRET && env.POSTAL_ADDRESS && env.SUPPRESSION) {
    ctx.waitUntil(
      (async () => {
        if (await env.SUPPRESSION.get(await sha256(value.email))) return;
        const url = await unsubscribeUrl(env, value.email, value.lang);
        const c = customerEmail(value, env, url);
        await sendBrevo(env, {
          to: value.email,
          ...c,
          headers: { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        });
      })().catch(() => console.error("brevo_confirmation_failed"))
    );
  }
  return json({ ok: true }, 200, okOrigin);
}

async function handleUnsubscribe(request, env, url) {
  if (request.method !== "GET" && request.method !== "POST") return new Response(null, { status: 405 });
  const lang = url.searchParams.get("l") === "es" ? "es" : "en";
  let email = "";
  try {
    email = fromB64urlText(url.searchParams.get("e") || "");
  } catch {
    return new Response("Invalid link", { status: 400 });
  }
  const token = url.searchParams.get("t") || "";
  if (!email || !env.UNSUB_SECRET || !safeEqual(token, await hmac(env.UNSUB_SECRET, email))) {
    return new Response("Invalid link", { status: 400 });
  }
  if (env.SUPPRESSION) await env.SUPPRESSION.put(await sha256(email), "1");
  await blocklistInBrevo(env, email).catch(() => console.error("brevo_blocklist_failed"));
  if (request.method === "POST") return new Response(null, { status: 200 }); // one-click from the mail client
  const page = lang === "es" ? "/es/baja/" : "/en/unsubscribed/";
  return Response.redirect(`${env.SITE_URL}${page}`, 303);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/quote") return handleQuote(request, env, ctx);
    if (url.pathname === "/api/unsubscribe") return handleUnsubscribe(request, env, url);
    return json({ ok: false, error: "not_found" }, 404);
  },
};
