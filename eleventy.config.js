import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import markdownIt from "markdown-it";
import Image from "@11ty/eleventy-img";
import * as esbuild from "esbuild";

const CONTENT = "src/content";
const LANGS = ["en", "es"];

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const readDir = (dir) =>
  fs
    .readdirSync(path.join(CONTENT, dir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(path.join(CONTENT, dir, f)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

// Fixed routes. Keys are shared by both languages so every page knows its translation.
const STATIC_ROUTES = {
  home: { en: "/en/", es: "/es/" },
  services: { en: "/en/services/", es: "/es/servicios/" },
  areas: { en: "/en/areas/", es: "/es/zonas/" },
  quote: { en: "/en/quote/", es: "/es/cotizar/" },
  contact: { en: "/en/contact/", es: "/es/contacto/" },
  privacy: { en: "/en/privacy/", es: "/es/privacidad/" },
  terms: { en: "/en/terms/", es: "/es/terminos/" },
  accessibility: { en: "/en/accessibility/", es: "/es/accesibilidad/" },
  thanks: { en: "/en/thanks/", es: "/es/gracias/", noindex: true },
  unsubscribed: { en: "/en/unsubscribed/", es: "/es/baja/", noindex: true },
};

export default function (eleventyConfig) {
  const site = readJson(path.join(CONTENT, "site.json"));
  if (process.env.SITE_URL) site.url = process.env.SITE_URL;
  // Demo / staging builds (e.g. on a github.io address) must never be indexed.
  site.noindex = process.env.NOINDEX === "true";
  site.url = site.url.replace(/\/+$/, "");
  site.whatsapp_display =
    site.whatsapp && site.whatsapp === site.phone.replace("+", "") ? site.phone_display : `+${site.whatsapp}`;

  const services = readDir("services");
  const zones = readDir("zones");
  const faqs = readDir("faq");

  const routes = structuredClone(STATIC_ROUTES);
  for (const s of services) {
    routes[`service:${s.id}`] = {
      en: `/en/services/${s.slug_en}/`,
      es: `/es/servicios/${s.slug_es}/`,
    };
  }
  for (const z of zones.filter((z) => z.has_page)) {
    routes[`zone:${z.id}`] = { en: `/en/areas/${z.slug}/`, es: `/es/zonas/${z.slug}/` };
  }

  const pairs = (items) => LANGS.flatMap((lang) => items.map((item) => ({ lang, item })));

  eleventyConfig.addGlobalData("site", site);
  eleventyConfig.addGlobalData("home", readJson(path.join(CONTENT, "home.json")));
  eleventyConfig.addGlobalData("services", services);
  eleventyConfig.addGlobalData("carouselServices", services.filter((s) => s.show_in_carousel !== false));
  eleventyConfig.addGlobalData("zones", zones);
  eleventyConfig.addGlobalData("faqs", faqs);
  eleventyConfig.addGlobalData("routes", routes);
  eleventyConfig.addGlobalData("langs", LANGS);
  eleventyConfig.addGlobalData("servicePages", pairs(services));
  eleventyConfig.addGlobalData("zonePages", pairs(zones.filter((z) => z.has_page)));
  eleventyConfig.addGlobalData("buildId", crypto.randomBytes(4).toString("hex"));

  // ---- Structured data (schema.org) ----
  // No schema.org type exists for cleaning companies; HomeAndConstructionBusiness is the most
  // specific valid LocalBusiness subtype that fits residential + commercial cleaning.
  const bizId = `${site.url}/#business`;
  const servedCities = zones.flatMap((z) => [z.name, ...(z.nearby || [])]);
  eleventyConfig.addFilter("ldBusiness", (lang) => {
    const ld = {
      "@context": "https://schema.org",
      "@type": "HomeAndConstructionBusiness",
      "@id": bizId,
      name: site.business_name,
      url: `${site.url}/${lang}/`,
      telephone: site.phone,
      email: site.email,
      image: site.url + site.og_image,
      inLanguage: lang === "en" ? "en-US" : "es-US",
      knowsLanguage: ["en", "es"],
      currenciesAccepted: "USD",
      address: { "@type": "PostalAddress", addressRegion: "FL", addressCountry: "US" },
      areaServed: [
        ...[...new Set(servedCities)].map((name) => ({
          "@type": "City",
          name: `${name}, FL`,
        })),
        ...[...new Set(zones.map((z) => z.county))].map((name) => ({
          "@type": "AdministrativeArea",
          name: `${name}, FL`,
        })),
      ],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: lang === "en" ? "Cleaning services" : "Servicios de limpieza",
        itemListElement: services.map((s) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: s["name_" + lang],
            url: site.url + routes[`service:${s.id}`][lang],
          },
        })),
      },
    };
    if (site.open_24_7) {
      ld.openingHoursSpecification = [{
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "00:00",
        closes: "23:59",
      }];
    }
    if (site.legal.legal_name) ld.legalName = site.legal.legal_name;
    const sameAs = Object.values(site.social || {}).filter(Boolean);
    if (sameAs.length) ld.sameAs = sameAs;
    return ld;
  });
  eleventyConfig.addFilter("ldService", (s, lang) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    name: s["name_" + lang],
    serviceType: s["name_" + lang],
    description: s["seo_description_" + lang],
    url: site.url + routes[`service:${s.id}`][lang],
    provider: { "@id": bizId },
    areaServed: zones.map((z) => ({ "@type": "City", name: `${z.name}, FL` })),
  }));
  eleventyConfig.addFilter("ldFaq", (lang) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f["q_" + lang],
      acceptedAnswer: { "@type": "Answer", text: f["a_" + lang] },
    })),
  }));
  eleventyConfig.addFilter("ldBreadcrumb", (items) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, url], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: site.url + url,
    })),
  }));

  const md = markdownIt({ html: true, linkify: true, typographer: true });
  eleventyConfig.setLibrary("md", md);
  eleventyConfig.addFilter("md", (s) => md.render(s || ""));
  eleventyConfig.addFilter("mdInline", (s) => md.renderInline(s || ""));
  // Renders a value, or a visible "fill me in" marker when the owner has not set it yet in /admin.
  eleventyConfig.addShortcode("fill", (value, label) =>
    value ? String(value) : `<mark class="todo">[${label}]</mark>`
  );
  eleventyConfig.addFilter("absUrl", (p) => site.url + p);
  eleventyConfig.addFilter("year", () => new Date().getFullYear());
  // Keeps a phone number on one line (non-breaking space and hyphen).
  eleventyConfig.addFilter("nbphone", (s) => String(s || "").replace(/ /g, "\u00a0").replace(/-/g, "\u2011"));
  eleventyConfig.addFilter("pad2", (n) => String(n).padStart(2, "0"));
  // JSON-LD is a data block (never executed). Escape "<" so content cannot close the tag.
  eleventyConfig.addFilter("jsonld", (obj) => JSON.stringify(obj).replace(/</g, "\\u003c"));
  eleventyConfig.addFilter("pick", (obj, field, lang) => (obj ? obj[`${field}_${lang}`] : ""));

  // Responsive images for uploaded photos; SVG placeholders are passed through untouched.
  eleventyConfig.addAsyncShortcode("image", async (src, alt, opts = {}) => {
    // eager: the LCP image (high priority); visible: on screen at load, so not lazy.
    const { sizes = "100vw", cls = "", eager = false, visible = false } = opts;
    const loading = eager ? 'loading="eager" fetchpriority="high"' : visible ? 'loading="eager"' : 'loading="lazy"';
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    if (!src || src.endsWith(".svg") || /^https?:/.test(src)) {
      return `<img src="${esc(src)}" alt="${esc(alt)}" width="1920" height="1200" class="${cls}" ${loading} decoding="async">`;
    }
    const file = path.join("src", src);
    const kb = fs.statSync(file).size / 1024;
    if (kb > 400) console.warn(`[images] ${src} is ${Math.round(kb)} KB — please upload photos under 400 KB.`);
    const meta = await Image(file, {
      widths: [480, 960, 1600, 1920],
      formats: ["webp", "jpeg"],
      outputDir: "_site/assets/img/optimized/",
      urlPath: "/assets/img/optimized/",
    });
    return Image.generateHTML(meta, {
      alt,
      sizes,
      class: cls,
      loading: eager || visible ? "eager" : "lazy",
            ...(eager && { fetchpriority: "high" }),
      decoding: "async",
    });
  });

  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/assets/uploads": "assets/uploads" });
  eleventyConfig.addPassthroughCopy({ "node_modules/gsap/dist/gsap.min.js": "assets/vendor/gsap.min.js" });
  eleventyConfig.addPassthroughCopy({ "src/admin/config.yml": "admin/config.yml" });
  eleventyConfig.addPassthroughCopy({ "src/admin/index.html": "admin/index.html" });
  eleventyConfig.addPassthroughCopy({ ".cache/decap": "admin/vendor" });

  // CMS data and the admin page are read or copied as-is, never rendered as templates.
  eleventyConfig.ignores.add("src/content/**");
  eleventyConfig.ignores.add("src/admin/**");
  eleventyConfig.addWatchTarget(CONTENT);

  // Minify our own CSS and JS after the build (GSAP and Decap already ship minified).
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const files = ["assets/js/main.js", "assets/js/lang-redirect.js", "assets/css/main.css", "assets/css/noscript.css"];
    for (const f of files) {
      const file = path.join(dir.output, f);
      if (!fs.existsSync(file)) continue;
      const out = await esbuild.transform(fs.readFileSync(file, "utf8"), {
        loader: f.endsWith(".css") ? "css" : "js",
        minify: true,
        target: f.endsWith(".css") ? ["chrome100", "safari15", "firefox100"] : "es2019",
      });
      fs.writeFileSync(file, out.code);
    }
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md"],
  };
}
