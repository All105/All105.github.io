// Replaces the placeholder domain and repository everywhere they are configured.
// Usage: node scripts/set-domain.mjs www.yourdomain.com your-github-user/your-repo
import fs from "node:fs";

const [host, repo] = process.argv.slice(2);
if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) || (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo))) {
  console.error("Usage: node scripts/set-domain.mjs www.yourdomain.com your-github-user/your-repo");
  process.exit(1);
}
const zone = host.replace(/^www\./, "");
const edits = {
  "src/content/site.json": (s) => s.replace(/https:\/\/www\.example\.com/g, `https://${host}`),
  "src/admin/config.yml": (s) => {
    s = s.replace(/https:\/\/www\.example\.com/g, `https://${host}`);
    return repo ? s.replace("YOUR-GITHUB-USER/all-clean-group", repo) : s;
  },
  "workers/quote/wrangler.toml": (s) =>
    s.replace(/www\.example\.com/g, host).replace(/no-reply@example\.com/g, `no-reply@${zone}`).replace(/zone_name = "example\.com"/g, `zone_name = "${zone}"`),
  "workers/cms-auth/wrangler.toml": (s) => s.replace(/www\.example\.com/g, host).replace(/zone_name = "example\.com"/g, `zone_name = "${zone}"`),
};
for (const [file, fn] of Object.entries(edits)) {
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  fs.writeFileSync(file, after);
  console.log(`${before === after ? "unchanged" : "updated  "} ${file}`);
}
console.log(`\nDone. Also use https://${host} in the Cloudflare rules (docs/DESPLIEGUE.md).`);
