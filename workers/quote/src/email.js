// Email bodies and the Brevo transactional API call.

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fmtPhone = (d) => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;

export function ownerEmail(q, meta) {
  const rows = [
    ["Name / Nombre", q.name],
    ["Phone / Teléfono", fmtPhone(q.phone)],
    ["Email / Correo", q.email],
    ["Service / Servicio", q.service],
    ["ZIP", q.zip],
    ["Message / Mensaje", q.message || "—"],
    ["Language / Idioma", q.lang],
    ["Page / Página", q.page || "—"],
    ["Received / Recibido (UTC)", meta.receivedAt],
    ["Privacy policy accepted / Política aceptada", "yes / sí"],
    ["SMS consent / Consentimiento SMS", q.sms_consent ? `YES / SÍ — ${meta.receivedAt}` : "no"],
  ];
  if (q.sms_consent) rows.push(["SMS consent text shown / Texto mostrado", q.sms_text]);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0b2233">
<h2 style="margin:0 0 12px">New quote request · Nueva solicitud de cotización</h2>
<table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="border-bottom:1px solid #d5e6ee;font-weight:bold;vertical-align:top">${esc(k)}</td><td style="border-bottom:1px solid #d5e6ee;white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join("")}</table>
<p style="color:#4a5d6b;font-size:12px">Keep this email as the record of the request${q.sms_consent ? " and of the SMS consent (TCPA)" : ""}. Reply to answer the customer directly.</p>
</body></html>`;
  return {
    subject: `New quote / Nueva cotización: ${q.service} · ${q.zip}`,
    text,
    html,
  };
}

const COPY = {
  en: {
    subject: (b) => `We received your request — ${b}`,
    hello: (n) => `Hi ${n},`,
    body: "Thank you for contacting us. We received your quote request and will get back to you soon.",
    summary: "Service requested",
    unsub: "Unsubscribe",
    footer: "You are receiving this email because you sent a quote request on our website.",
  },
  es: {
    subject: (b) => `Recibimos tu solicitud — ${b}`,
    hello: (n) => `Hola, ${n}:`,
    body: "Gracias por contactarnos. Recibimos tu solicitud de cotización y te responderemos pronto.",
    summary: "Servicio solicitado",
    unsub: "Darme de baja",
    footer: "Recibes este correo porque enviaste una solicitud de cotización en nuestra web.",
  },
};

export function customerEmail(q, env, unsubUrl) {
  const c = COPY[q.lang] || COPY.en;
  const biz = env.BUSINESS_NAME || "All Clean Group";
  const text = [
    c.hello(q.name),
    "",
    c.body,
    `${c.summary}: ${q.service} (ZIP ${q.zip})`,
    "",
    "—",
    biz,
    env.POSTAL_ADDRESS,
    c.footer,
    `${c.unsub}: ${unsubUrl}`,
  ].join("\n");
  const html = `<!doctype html><html lang="${q.lang}"><body style="font-family:Arial,sans-serif;color:#0b2233">
<p>${esc(c.hello(q.name))}</p><p>${esc(c.body)}</p>
<p><strong>${esc(c.summary)}:</strong> ${esc(q.service)} (ZIP ${esc(q.zip)})</p>
<hr style="border:0;border-top:1px solid #d5e6ee">
<p style="font-size:12px;color:#4a5d6b">${esc(biz)}<br>${esc(env.POSTAL_ADDRESS)}<br>${esc(c.footer)}<br>
<a href="${esc(unsubUrl)}">${esc(c.unsub)}</a></p></body></html>`;
  return { subject: c.subject(biz), text, html };
}

export async function sendBrevo(env, { to, replyTo, subject, text, html, headers }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: env.FROM_EMAIL, name: env.FROM_NAME || "All Clean Group" },
      to: [{ email: to }],
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      subject,
      textContent: text,
      htmlContent: html,
      ...(headers ? { headers } : {}),
    }),
  });
  return res.ok;
}

// Marks the address as unsubscribed in Brevo so no campaign can reach it either.
export async function blocklistInBrevo(env, email) {
  const res = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email, emailBlacklisted: true, updateEnabled: true }),
  });
  return res.ok || res.status === 204;
}
