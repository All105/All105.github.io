import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const env = { SITE_ORIGIN: "https://www.example.com", GITHUB_CLIENT_ID: "cid", GITHUB_CLIENT_SECRET: "csecret" };

test("auth redirects to GitHub with state cookie", async () => {
  const res = await worker.fetch(new Request("https://www.example.com/cms-auth/auth?provider=github&scope=repo"), env);
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get("location"));
  assert.equal(loc.origin, "https://github.com");
  assert.equal(loc.searchParams.get("redirect_uri"), "https://www.example.com/cms-auth/callback");
  const state = loc.searchParams.get("state");
  assert.match(res.headers.get("set-cookie"), new RegExp(`__Host-cms_state=${state};.*HttpOnly`));
});

test("callback rejects a state that does not match the cookie", async () => {
  const res = await worker.fetch(new Request("https://www.example.com/cms-auth/callback?code=x&state=a", { headers: { cookie: "__Host-cms_state=b" } }), env);
  assert.equal(res.status, 401);
});

test("callback exchanges code and posts token only to the site origin", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://github.com/login/oauth/access_token");
    assert.equal(JSON.parse(init.body).client_secret, "csecret");
    return new Response(JSON.stringify({ access_token: "gho_test" }), { status: 200 });
  };
  const res = await worker.fetch(new Request("https://www.example.com/cms-auth/callback?code=x&state=s1", { headers: { cookie: "__Host-cms_state=s1" } }), env);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /gho_test/);
  assert.match(html, /var origin = "https:\/\/www\.example\.com"/);
  assert.ok(!html.includes('postMessage(message, "*")'));
  const csp = res.headers.get("content-security-policy");
  const nonce = csp.match(/nonce-([^']+)/)[1];
  assert.ok(html.includes(`nonce="${nonce}"`));
});
