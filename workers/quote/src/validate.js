// Server-side validation. Mirrors the browser checks, but this is the one that counts.

export const LIMITS = { body: 10_000, name: [2, 100], email: 254, message: 2000, smsText: 600 };

const str = (v) => (typeof v === "string" ? v : "");
const clean = (v) => str(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

export function normalizePhone(v) {
  let d = str(v).replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? d : null;
}

// Florida ZIP codes are in the 32004–34997 range.
export function isFloridaZip(v) {
  if (!/^\d{5}$/.test(v)) return false;
  const n = Number(v);
  return n >= 32004 && n <= 34997;
}

export function validateQuote(input) {
  const errors = {};
  const d = input && typeof input === "object" ? input : {};
  const name = clean(d.name).replace(/\s+/g, " ");
  const email = clean(d.email).toLowerCase();
  const phone = normalizePhone(d.phone);
  const service = clean(d.service);
  const zip = clean(d.zip);
  const message = clean(d.message);
  const lang = d.lang === "es" ? "es" : "en";

  if (name.length < LIMITS.name[0] || name.length > LIMITS.name[1]) errors.name = "name";
  if (!phone) errors.phone = "phone";
  if (email.length > LIMITS.email || !/^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i.test(email)) errors.email = "email";
  // Any slug is accepted so new services added in the CMS work without redeploying the Worker.
  if (!/^[a-z0-9-]{2,40}$/.test(service)) errors.service = "service";
  if (!isFloridaZip(zip)) errors.zip = "zip";
  if (message.length > LIMITS.message) errors.message = "message";
  if (d.privacy !== true && d.privacy !== "yes") errors.privacy = "privacy";

  const sms = d.sms_consent === true || d.sms_consent === "yes";
  const value = {
    name,
    email,
    phone,
    service,
    zip,
    message,
    lang,
    sms_consent: sms,
    sms_text: sms ? clean(d.sms_text).slice(0, LIMITS.smsText) : "",
    page: clean(d.page).slice(0, 200),
  };
  return { ok: Object.keys(errors).length === 0, errors, value };
}

export const isHoneypotFilled = (d) => !!(d && typeof d === "object" && clean(d.website));
