# Despliegue, paso a paso

Orden recomendado: **dominio → Cloudflare → GitHub Pages → Turnstile → Brevo → Worker del formulario → login del CMS → reglas de seguridad → analítica → comprobaciones**.
En todos los ejemplos, `www.tudominio.com` es tu dominio.

> **Antes de empezar:** activa la **verificación en dos pasos (2FA)** en GitHub, Cloudflare, Brevo y Gmail. Usa una app de autenticación, no SMS.

---

## 0. Preparar el repositorio

1. Pon tu dominio y tu repositorio en todos los archivos:

   ```bash
   node scripts/set-domain.mjs www.tudominio.com TU-USUARIO-GITHUB/all-clean-group
   ```

2. Comprueba que todo pasa:

   ```bash
   npm ci && npm test
   ```

3. Crea el repositorio en GitHub y sube el código. GitHub Pages es gratis en repositorios **públicos**; para uno privado necesitas un plan de pago. El repositorio no contiene ningún secreto, así que puede ser público.

   ```bash
   git remote add origin https://github.com/TU-USUARIO-GITHUB/all-clean-group.git
   ```

   ```bash
   git push -u origin main
   ```

## 1. Dominio

1. Compra el dominio en el registrador que prefieras. Cloudflare Registrar también vende dominios a precio de coste.
2. Activa el bloqueo de transferencia y la privacidad WHOIS. En el registro **no pongas el domicilio particular** si no quieres que se vea.

## 2. Cloudflare (zona DNS)

1. Crea una cuenta en Cloudflare, añade el dominio (plan Free) y cambia los *nameservers* en el registrador por los que indique Cloudflare.
2. Crea estos registros DNS. Al principio, déjalos **sin proxy (nube gris)** para que GitHub pueda emitir su certificado:

   | Tipo | Nombre | Valor |
   |---|---|---|
   | CNAME | `www` | `TU-USUARIO-GITHUB.github.io` |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA | `@` | `2606:50c0:8000::153` (y `8001`, `8002`, `8003`) |

## 3. GitHub Pages

1. En el repositorio, ve a **Settings › Pages › Build and deployment › Source** y elige **GitHub Actions**.
2. En **Settings › Pages › Custom domain**, escribe `www.tudominio.com` y espera a que el certificado esté listo. Después marca **Enforce HTTPS**.
3. Verifica el dominio en **Settings (de tu cuenta) › Pages › Verified domains**. Eso añade un TXT `_github-pages-challenge-…` en Cloudflare y evita que otra persona use tu dominio en GitHub.
4. En **Settings › Secrets and variables › Actions › Variables**, crea `SITE_URL` = `https://www.tudominio.com`.
5. En **Settings › Code security**, activa Dependabot alerts, Dependabot security updates, Secret scanning y Push protection.
6. En **Settings › Rules**, crea una regla para `main` que **bloquee el force-push y el borrado de la rama**. No exijas pull requests: el CMS guarda directamente en `main`.
7. Haz un push o lanza **Actions › Test and deploy › Run workflow**. El flujo ejecuta gitleaks, `npm audit`, todos los tests y las pruebas de navegador, y solo publica si todo pasa.
8. Cuando la web ya cargue por HTTPS, vuelve a Cloudflare y activa el **proxy (nube naranja)** en `www` y en `@`.

## 4. Cloudflare: SSL/TLS

- **SSL/TLS › Overview**: modo **Full (strict)**.
- **Edge Certificates**: activa Always Use HTTPS, TLS 1.3 y Automatic HTTPS Rewrites, y pon la versión mínima de TLS en **1.2**.
- **Edge Certificates › HSTS**: activa HSTS con Max-Age **12 meses**, **Include subdomains** y **Preload**, y marca también No-Sniff.
  Hazlo solo cuando todo (incluidos los subdominios) funcione por HTTPS.
- **Rules › Redirect Rules**: crea una redirección 301 de `tudominio.com/*` a `https://www.tudominio.com/${1}`, conservando la query string.

> Si GitHub no consigue renovar su certificado con el proxy activado, pon la nube gris un momento, espera la renovación y vuelve a activarla.

## 5. Turnstile (antispam del formulario)

1. En Cloudflare, ve a **Turnstile › Add widget**. Ponle de nombre "All Clean Group quote", añade el hostname `www.tudominio.com` y elige el modo **Managed**.
2. La **Site key** es pública: pégala en `/admin › Ajustes › Datos del negocio › Integrations › Turnstile site key`. También puedes ponerla en `src/content/site.json`.
3. La **Secret key** es secreta: va solo al Worker, en el paso 7. Nunca la pongas en el repositorio.

## 6. Brevo (envío del aviso por correo)

1. Crea la cuenta y activa la 2FA.
2. En **Senders, Domains & Dedicated IPs › Domains**, añade `tudominio.com` y crea en Cloudflare DNS los registros que te indique Brevo (código de verificación, DKIM y DMARC).
   DMARC de partida: `_dmarc` TXT `v=DMARC1; p=quarantine; rua=mailto:unitycorporateusa@gmail.com`.
3. Crea el remitente `no-reply@tudominio.com`. **No uses @gmail.com como remitente**: Gmail no permite autenticarlo y los correos acabarían en spam.
4. En **SMTP & API › API Keys**, crea una clave llamada `website-worker`. Si tienes activado "Authorized IPs", desactívalo para esta clave, porque los Workers no tienen IP fija.
5. Ten en cuenta CAN-SPAM: cualquier campaña de marketing que envíes desde Brevo debe incluir tu dirección postal y el enlace de baja de Brevo.

## 7. Worker del formulario (`workers/quote`)

```bash
cd workers/quote
```

```bash
npx wrangler@4.154.0 login
```

Revisa `wrangler.toml`: `TO_EMAIL` (dónde recibes los avisos), `FROM_EMAIL` y, si quieres enviar al cliente un acuse de recibo, `POSTAL_ADDRESS` y `SEND_CONFIRMATION = "true"`. Después guarda los secretos:

```bash
npx wrangler@4.154.0 secret put BREVO_API_KEY
```

```bash
npx wrangler@4.154.0 secret put TURNSTILE_SECRET
```

```bash
npx wrangler@4.154.0 secret put UNSUB_SECRET
```

Para `UNSUB_SECRET`, inventa una cadena larga y aleatoria. Puedes generarla con `openssl rand -base64 32`.

Si activas el acuse de recibo, crea la lista de bajas y pega su `id` en `wrangler.toml` (descomenta el bloque `kv_namespaces`):

```bash
npx wrangler@4.154.0 kv namespace create SUPPRESSION
```

Despliega y prueba:

```bash
npm test && npx wrangler@4.154.0 deploy
```

```bash
curl -i -X POST https://www.tudominio.com/api/quote -H "Origin: https://evil.example" -H "Content-Type: application/json" -d '{}'
```

La respuesta esperada es `403` (origen no permitido). Después envía el formulario real desde la web y comprueba que llega el correo.

## 8. Login del panel /admin (`workers/cms-auth`)

1. En GitHub, ve a **Settings › Developer settings › OAuth Apps › New OAuth App** y rellena:
   - Homepage URL: `https://www.tudominio.com`
   - Authorization callback URL: `https://www.tudominio.com/cms-auth/callback`
2. Guarda el Client ID y genera un Client secret. Después:

   ```bash
   cd workers/cms-auth
   ```

   ```bash
   npx wrangler@4.154.0 secret put GITHUB_CLIENT_ID
   ```

   ```bash
   npx wrangler@4.154.0 secret put GITHUB_CLIENT_SECRET
   ```

   ```bash
   npm test && npx wrangler@4.154.0 deploy
   ```

3. Entra en `https://www.tudominio.com/admin/`, inicia sesión con GitHub y edita. Cada vez que guardas se hace un commit, que vuelve a pasar los tests y publica en unos 2 minutos.
   Solo pueden editar las cuentas de GitHub con permiso de escritura en el repositorio.

Opcional: para desplegar los Workers automáticamente cuando cambien, crea en GitHub los secretos `CLOUDFLARE_API_TOKEN` (permisos *Workers Scripts: Edit* y *Workers Routes: Edit*) y `CLOUDFLARE_ACCOUNT_ID`, y la variable `DEPLOY_WORKERS` = `true`.

## 9. Cloudflare: cabeceras de seguridad (Transform Rules)

GitHub Pages no permite configurar cabeceras, así que se añaden en Cloudflare: **Rules › Transform Rules › Modify Response Header**. Los valores exactos están en [`cloudflare/headers.json`](../cloudflare/headers.json); cópialos de ahí.

**Regla 1, "Security headers – site"**

- Expresión (editor de expresiones):

  ```
  (http.host eq "www.tudominio.com" and not starts_with(http.request.uri.path, "/admin") and not starts_with(http.request.uri.path, "/cms-auth/"))
  ```

- Operación *Set static* para cada cabecera del bloque `site`: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` y `X-Permitted-Cross-Domain-Policies`.
  HSTS lo pone el ajuste del paso 4.
- Operación *Remove* para `x-github-request-id` y `access-control-allow-origin` (GitHub manda `*` por defecto).

**Regla 2, "Security headers – admin"**

- Expresión:

  ```
  (http.host eq "www.tudominio.com" and starts_with(http.request.uri.path, "/admin"))
  ```

- *Set static* con los valores del bloque `admin`, que es más permisivo porque Decap lo necesita y solo afecta a `/admin`.

`/cms-auth/` queda fuera de ambas reglas a propósito: ese Worker envía su propia CSP con *nonce*.

## 10. Cloudflare: caché y límites

- **Rules › Cache Rules**: para la ruta `/assets/*`, marca *Eligible for cache*, pon el Edge TTL en 1 mes y el Browser TTL en 1 año. Los archivos llevan `?v=` con el identificador del build, así que se renuevan solos al publicar.
- **Security › WAF › Rate limiting rules** (el plan Free incluye una regla): si la ruta es `/api/quote` y el método POST, permite 10 peticiones por minuto por IP y luego bloquea durante 10 minutos. El Worker aplica además su propio límite de 5 por minuto.
- **Security › Bots**: Bot Fight Mode es opcional y compatible con Turnstile.

## 11. Analítica (opcional, solo con consentimiento)

1. En Cloudflare, ve a **Analytics & Logs › Web Analytics › Add a site** y elige la instalación **manual con JS snippet**.
   **No actives la configuración automática**: inyectaría el script sin pedir consentimiento.
2. Copia solo el `token` del snippet en `/admin › Ajustes › Integrations › Cloudflare Web Analytics token`.
   A partir de ahí la web muestra el aviso y solo carga el script si el visitante pulsa "Permitir". Si el navegador envía Global Privacy Control, no se carga.

## 12. Comprobaciones finales

- [ ] https://securityheaders.com/?q=https://www.tudominio.com/en/ → objetivo **A+**
- [ ] https://www.ssllabs.com/ssltest/analyze.html?d=www.tudominio.com → objetivo **A+** (requiere el HSTS del paso 4)
- [ ] https://developer.mozilla.org/en-US/observatory/analyze?host=www.tudominio.com → objetivo **A+**
- [ ] https://pagespeed.web.dev/ en `/en/` y `/es/` (móvil y escritorio) → objetivo 90+ en las cuatro categorías
- [ ] Envía el formulario en inglés y en español, con y sin SMS, y comprueba que el correo llega con la marca de hora del consentimiento.
- [ ] Prueba la baja en un clic, si activaste el acuse de recibo.
- [ ] Google Search Console: añade el dominio (verificación DNS) y envía `https://www.tudominio.com/sitemap.xml`.
- [ ] Google Business Profile: ver [GOOGLE-BUSINESS.md](GOOGLE-BUSINESS.md).
- [ ] Unas semanas después, con HSTS funcionando sin problemas, solicita la inclusión en https://hstspreload.org.
- [ ] Revisión legal y cambio de "Revisado por abogado" en /admin.
