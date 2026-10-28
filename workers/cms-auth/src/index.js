// Minimal GitHub OAuth provider for Decap CMS.
// /cms-auth/auth      → redirects to GitHub with a random state stored in a __Host- cookie.
// /cms-auth/callback  → checks state, exchanges the code and hands the token to the /admin window
//                       with postMessage restricted to SITE_ORIGIN.
const SCOPES = new Set(["repo", "public_repo"]);

function randomState() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, "");
}
function cookie(request, name) {
  const m = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : "";
}

function resultPage(env, status, payload) {
  const nonce = randomState();
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Login</title></head><body>
<p>${status === "success" ? "Logged in. You can close this window." : "Login failed."}</p>
<script nonce="${nonce}">
(function () {
  var origin = ${JSON.stringify(env.SITE_ORIGIN)};
  var message = ${JSON.stringify(message).replace(/</g, "\\u003c")};
  if (!window.opener) return;
  window.addEventListener("message", function (e) {
    if (e.origin !== origin) return;
    window.opener.postMessage(message, origin);
  }, { once: true });
  window.opener.postMessage("authorizing:github", origin);
})();
</script></body></html>`;
  return new Response(html, {
    status: status === "success" ? 200 : 401,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "set-cookie": "__Host-cms_state=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const redirectUri = `${env.SITE_ORIGIN}/cms-auth/callback`;

    if (url.pathname === "/cms-auth/auth") {
      if (url.searchParams.get("provider") !== "github") return new Response("Unsupported provider", { status: 400 });
      const scope = SCOPES.has(url.searchParams.get("scope")) ? url.searchParams.get("scope") : "repo";
      const state = randomState();
      const gh = new URL("https://github.com/login/oauth/authorize");
      gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      gh.searchParams.set("redirect_uri", redirectUri);
      gh.searchParams.set("scope", scope);
      gh.searchParams.set("state", state);
      return new Response(null, {
        status: 302,
        headers: {
          location: gh.toString(),
          "set-cookie": `__Host-cms_state=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,
          "cache-control": "no-store",
        },
      });
    }

    if (url.pathname === "/cms-auth/callback") {
      const state = url.searchParams.get("state") || "";
      const code = url.searchParams.get("code") || "";
      const expected = cookie(request, "__Host-cms_state");
      if (!code || !state || !expected || state !== expected) return resultPage(env, "error", { error: "invalid_state" });
      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", "user-agent": "all-clean-group-cms-auth" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.access_token) return resultPage(env, "error", { error: "token_exchange_failed" });
      return resultPage(env, "success", { token: data.access_token, provider: "github" });
    }

    return new Response("Not found", { status: 404 });
  },
};
