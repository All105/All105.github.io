// Generates clearly-labelled placeholder images. Replace them with your own photos in /admin
// (16:10, JPG or WebP, under 400 KB, ideally 1920×1200).
import fs from "node:fs";
import sharp from "sharp";

const items = {
  residential: ["#0b63a5", "#12b5b0", "RESIDENTIAL · RESIDENCIAL"],
  commercial: ["#0a4f7f", "#1aa0c8", "COMMERCIAL · COMERCIAL"],
  "post-construction": ["#174a6b", "#3fb8a5", "POST-CONSTRUCTION · POST-OBRA"],
  move: ["#0d5c8c", "#5fc9e0", "MOVE-IN/OUT · MUDANZA"],
  "vacation-rental": ["#06607a", "#2cc4b9", "AIRBNB · ALQUILER VACACIONAL"],
  deep: ["#0b3f66", "#16a3a8", "DEEP CLEANING · LIMPIEZA PROFUNDA"],
};
const svg = (a, b, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1200" width="1920" height="1200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse"><circle cx="40" cy="40" r="3" fill="#fff" fill-opacity=".12"/></pattern></defs>
<rect width="1920" height="1200" fill="url(#g)"/><rect width="1920" height="1200" fill="url(#p)"/>
<g fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="6" stroke-linecap="round" transform="translate(-160 180)"><circle cx="1500" cy="420" r="70"/><path d="M1500 300v-40M1500 580v-40M1380 420h-40M1660 420h-40M1415 335l-28-28M1613 533l-28-28M1415 505l-28 28M1613 307l-28 28"/></g>
<g font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" fill="#fff" text-anchor="end">
<text x="1840" y="190" font-size="34" font-weight="700" fill-opacity=".9">${label}</text>
<text x="1840" y="240" font-size="28" fill-opacity=".8">PHOTO PLACEHOLDER · FOTO PROVISIONAL</text>
<text x="1840" y="284" font-size="24" fill-opacity=".7">1920×1200 (16:10) · JPG/WebP · &lt; 400 KB</text></g></svg>`;

fs.mkdirSync("src/assets/img/placeholders", { recursive: true });
for (const [id, [a, b, label]] of Object.entries(items)) {
  fs.writeFileSync(`src/assets/img/placeholders/${id}.svg`, svg(a, b, label));
}
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b63a5"/><stop offset="1" stop-color="#12b5b0"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#g)"/>
<g font-family="DejaVu Sans,system-ui,sans-serif" fill="#fff"><text x="80" y="290" font-size="84" font-weight="700">All Clean Group</text>
<text x="80" y="370" font-size="36">Cleaning services · Servicios de limpieza</text>
<text x="80" y="430" font-size="32" fill-opacity=".85">Clearwater · Tampa · Orlando, FL</text></g></svg>`;
fs.writeFileSync("src/assets/img/placeholders/og-default.svg", og);
await sharp(Buffer.from(og)).jpeg({ quality: 82 }).toFile("src/assets/img/og-default.jpg");
fs.writeFileSync("src/assets/img/favicon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#0b63a5"/><g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6"/></g></svg>`);
console.log("placeholders written");
