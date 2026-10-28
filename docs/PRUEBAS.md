# Resultados de las pruebas

Ejecutadas el 28/10/2026 en local (Node 22, Chromium de Playwright 1.63, Lighthouse 13.6), contra el sitio compilado y servido con **las mismas cabeceras de producción** (`cloudflare/headers.json`, CSP incluida), compresión Brotli y caché, como hará Cloudflare.
El dominio todavía es el marcador `www.example.com`.

Capturas: [escritorio EN](capturas/escritorio-en.jpg) · [escritorio ES](capturas/escritorio-es.jpg) · [móvil EN](capturas/movil-en.jpg)

## Resumen

| Bloque | Resultado |
|---|---|
| Validación HTML (`html-validate`, 40 páginas) | ✅ 0 errores |
| Tests del sitio compilado (`tests/build.test.mjs`, 15) + secretos (1) | ✅ 16/16 |
| Worker del formulario (`workers/quote`) | ✅ 14/14 |
| Worker de login del CMS (`workers/cms-auth`) | ✅ 3/3 |
| Navegador E2E (`tests/e2e.mjs`) | ✅ 10/10 |
| `wrangler deploy --dry-run` | ✅ compila; bindings correctos (rate limit + variables) |
| `npm audit` | ✅ 0 vulnerabilidades |
| Panel /admin (Decap 3.17.3, verificado por sha512) | ✅ carga sin errores bajo su CSP; editor con campos `_en`/`_es`; guardar escribe el JSON correctamente (probado con `decap-server`) |
| Lighthouse | Accesibilidad, Buenas prácticas y SEO: **100** en las 12 mediciones. Rendimiento: **83–100** (ver abajo) |

## Formulario

- Servicio preseleccionado desde el botón de la diapositiva (`?service=deep` → "Limpieza profunda"). ✅
- Envío vacío: errores en el idioma de la página, `aria-invalid`, resumen con `role="alert"` y foco en el primer campo con error. ✅
- Código postal fuera de Florida (10001) rechazado; el de Tampa (33602) aceptado. ✅
- Casilla SMS desmarcada por defecto. Si se marca, se envía el texto exacto que vio el usuario. ✅
- El honeypot queda fuera del orden de tabulación. Si se rellena, el Worker responde "ok" y **no envía nada**. ✅
- Worker: Turnstile verificado en el servidor (secreto, IP, hostname y acción); falla cerrado si falta el secreto; rechaza otros orígenes (403), métodos (405), tipos (415), cuerpos grandes (413), JSON roto (400) y exceso de peticiones (429); si Brevo falla responde 502 y la web pide que llamen; el HTML de los campos se escapa en el correo; el consentimiento SMS queda con marca de hora. ✅
- Baja en un clic: enlace firmado con HMAC, que solo guarda un hash de la dirección; un token falso da 400; una dirección dada de baja no recibe más acuses. ✅
- **Se corrigió un fallo real** encontrado en las pruebas: al salir de un campo con error, el mensaje se borraba en el `blur`, el contenido se desplazaba y el clic en la casilla de privacidad se perdía. Ahora el error se borra mientras se escribe.

## Idioma

- `/` con navegador en `es-MX` → `/es/`; con `en-US` → `/en/`. ✅
- El selector EN | ES lleva a la misma página en el otro idioma (`/en/services/deep-cleaning/` ↔ `/es/servicios/limpieza-profunda/`) y guarda la preferencia en `localStorage`. La siguiente visita a `/` la respeta. ✅
- **0 cookies.** ✅
- hreflang `en-US` / `es-US` / `x-default` recíprocos en todas las páginas; canonical; `lang` correcto; títulos y descripciones únicos por idioma; sitemap con alternates y sin páginas `noindex`. ✅

## Móvil

- 21 páginas a 360 px: **sin scroll horizontal**. ✅
- Menú hamburguesa (con `aria-expanded` y cierre con Escape) y botón de llamada visible en la cabecera. ✅
- Deslizar a la izquierda → servicio siguiente; a la derecha → anterior. **Se corrigió**: faltaba `touch-action: pan-y` y el navegador se quedaba con el gesto. ✅

## Teclado y movimiento

- ← → cambian de diapositiva (no mientras se escribe en un campo), con anuncio "2 of 6: …" para lectores de pantalla. ✅
- Los botones anterior, siguiente y pausa funcionan. En pausa no avanza (comprobado 8 s). El panel oculto es `inert` y tiene `aria-hidden`. ✅
- Enlace "Saltar al contenido" y formulario accesible con Tab. ✅
- Con `prefers-reduced-motion: reduce`: no hay barrido, empieza en pausa, no avanza solo y las flechas cambian de diapositiva sin animación. ✅
- Con movimiento permitido, el carrusel avanza solo a los ~6 s. ✅
- Sin JavaScript se ve la primera diapositiva y la fila de tarjetas en la misma posición que con JS (comprobado al píxel), y no se queda la pantalla en blanco. CLS = 0. ✅

## Cabeceras y CSP

- **0 violaciones de CSP, 0 errores JS y 0 peticiones a terceros** en las 21 páginas (CSP `default-src 'none'`, sin `unsafe-inline` ni `unsafe-eval`). ✅
- Sin `style=""`, sin `<style>`, sin scripts en línea ni `on…=`. El único `<script>` sin `src` es JSON-LD (datos, no se ejecuta). ✅
- GSAP se sirve desde `/assets/vendor/` (npm, 3.15.0); no hay CDN. ✅
- Analítica: no se carga nada antes de dar el consentimiento. Con "Permitir" se carga el beacon; con "No permitir" nunca; con Global Privacy Control no aparece el aviso. ✅
- Cabeceras que se envían: CSP, HSTS (1 año + includeSubDomains + preload), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP y CORP. Son las que evalúan SecurityHeaders y MDN Observatory para dar **A+**, pero la nota real **solo se puede obtener con el dominio publicado** (ver "No verificado").

## Lighthouse (mediana de 3 ejecuciones por página)

| Página | Móvil Perf | Escritorio Perf | A11y | BP | SEO | LCP | CLS |
|---|---|---|---|---|---|---|---|
| `/en/` | 86–100 | 70–90 | 100 | 100 | 100 | 0,78–0,96 s | 0 |
| `/es/` | 87–100 | 76–95 | 100 | 100 | 100 | 0,79–0,94 s | 0 |
| `/es/cotizar/` | 93–100 | 83–99 | 100 | 100 | 100 | 0,81–0,83 s | 0 |
| `/en/services/residential-cleaning/` | 85–100 | 83–98 | 100 | 100 | 100 | 0,80–1,03 s | 0 |
| `/es/zonas/tampa/` | 92–100 | 82–99 | 100 | 100 | 100 | 0,81 s | 0 |
| `/en/privacy/` | 93–100 | 84–99 | 100 | 100 | 100 | 0,82–0,84 s | 0 |

Los rangos recogen tres tandas completas con el mismo código. LCP y CLS son estables. Lo que varía es el *Total Blocking Time*, entre 0 y 540 ms. En escritorio, Lighthouse no ralentiza la CPU, y aun así la página de privacidad, con solo 16 KB de JS, llegó a medir 344 ms. Eso apunta a la carga del contenedor de pruebas, no al sitio.

**El objetivo de 90+ en Rendimiento no está garantizado** hasta medirlo con PageSpeed Insights sobre el dominio real. En las tres categorías restantes se cumple siempre (100).

Optimizaciones ya aplicadas: CSS/JS minificados (esbuild), tarjetas colocadas desde CSS (pintan en el primer frame), sin fundido de opacidad en el título (LCP), lecturas de GSAP agrupadas, imágenes visibles con carga inmediata y las demás diferidas, y Turnstile cargado solo cuando el formulario se acerca a la pantalla.

## Cómo repetirlas

```bash
npm test
```

```bash
npm run test:e2e
```

```bash
npm run serve
```

```bash
npm run test:lighthouse
```

La última, en otra terminal con `npm run serve` en marcha. Variables: `LH_RUNS=5`, `LH_PAGES=/en/,/es/`.
