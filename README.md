# All Clean Group: sitio web bilingüe (EN/ES)

Sitio estático para una empresa de limpieza en Florida (Clearwater, Tampa, Orlando y la zona entre ellas).
Usa **Eleventy**, se publica en **GitHub Pages detrás de Cloudflare** y no tiene servidor ni base de datos.
El formulario de cotización lo procesa un **Cloudflare Worker**, que verifica Turnstile en el servidor y envía el aviso por **Brevo**.
El contenido se edita en **/admin** (Decap CMS), donde cada texto tiene sus campos `_en` y `_es`.

> Los textos legales son **borradores pendientes de revisión por un abogado de Florida**. Mientras en `/admin › Ajustes › Datos legales` no marques "Revisado por abogado", cada página legal muestra un aviso con esa leyenda.

## Documentación

| Documento | Para qué |
|---|---|
| [docs/DEMO-GITHUB.md](docs/DEMO-GITHUB.md) | **Empieza aquí:** publicar una demo en `*.github.io`, oculta para Google |
| [docs/DATOS-A-RELLENAR.md](docs/DATOS-A-RELLENAR.md) | Tabla con todo lo que falta (dominio, dirección postal, fotos, claves…) |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Pasos en orden: dominio, Cloudflare, Worker, Brevo, Pages, CMS y reglas de seguridad |
| [docs/GOOGLE-BUSINESS.md](docs/GOOGLE-BUSINESS.md) | Texto para la ficha de Google Business (negocio de área de servicio) |
| [docs/CUMPLIMIENTO.md](docs/CUMPLIMIENTO.md) | Qué cubre cada requisito legal (FDUTPA, FIPA, CAN-SPAM, TCPA, WCAG) y qué debe revisar el abogado |
| [docs/PRUEBAS.md](docs/PRUEBAS.md) | Resultados de las pruebas y lo que no se pudo verificar |

## Estructura

```
.github/              CI: escáner de secretos, tests, despliegue a Pages; Dependabot
cloudflare/headers.json  Cabeceras de seguridad (CSP, HSTS…) → reglas de Cloudflare
docs/                 Guías (español)
scripts/              fetch-decap (descarga verificada por hash), serve (servidor local con cabeceras),
                      set-domain (pone tu dominio en todos los archivos), make-placeholders
src/
  content/            ← DATOS EDITABLES desde /admin (JSON): site, home, services/, zones/, faq/
  legal/              Privacidad, términos y accesibilidad (EN/ES, markdown editable en /admin)
  pages/              Plantillas: inicio, servicios, zonas, cotizar, contacto, gracias, baja
  _includes/          Layout, cabecera, pie, carrusel, formulario, iconos
  _data/              Textos de interfaz (i18n.js) y SEO de páginas fijas (seo.js)
  assets/             CSS, JS (sin scripts ni estilos en línea), imágenes, uploads/ (fotos del CMS)
  admin/              Decap CMS (config.yml)
tests/                build (HTML generado), secrets, e2e (Playwright), lighthouse
workers/quote/        Worker del formulario: Turnstile, honeypot, validación, Brevo y baja en un clic
workers/cms-auth/     Worker de inicio de sesión con GitHub para /admin
```

## URLs

| | Inglés | Español |
|---|---|---|
| Inicio | `/en/` | `/es/` |
| Servicios | `/en/services/<servicio>/` | `/es/servicios/<servicio>/` |
| Zonas | `/en/areas/<ciudad>/` | `/es/zonas/<ciudad>/` |
| Cotizar | `/en/quote/?service=<id>` | `/es/cotizar/?service=<id>` |
| Contacto | `/en/contact/` | `/es/contacto/` |
| Legal | `/en/privacy/`, `/en/terms/`, `/en/accessibility/` | `/es/privacidad/`, `/es/terminos/`, `/es/accesibilidad/` |

`/` detecta el idioma del navegador y redirige a `/en/` o `/es/`. Si el visitante elige idioma con el selector EN | ES, se guarda en `localStorage` (no se usan cookies).

## Comandos

```bash
npm ci
```

```bash
npm start            # desarrollo con recarga en http://localhost:8080
```

```bash
npm test             # build + validación HTML + tests del sitio + secretos + Workers
```

```bash
npm run serve        # sirve _site con las cabeceras de producción (CSP incluida)
```

```bash
npm run test:e2e     # pruebas en navegador (con `npm run build` hecho antes)
```

```bash
npm run test:lighthouse   # con `npm run serve` en otra terminal
```

## Fotos

Hoy todas las imágenes son **marcadores provisionales** que lo indican de forma visible ("PHOTO PLACEHOLDER · FOTO PROVISIONAL").
Sustitúyelas desde `/admin › Servicios › Foto`:

- Fotos **propias** del negocio, o con licencia que permita uso comercial.
- Formato **16:10** (ideal 1920×1200 px), **JPG o WebP**, **menos de 400 KB**.
- Rellena la descripción (alt) en inglés y en español.
- No publiques fotos de "antes y después" que no sean reales, ni fotos donde se vea a clientes o direcciones.

Durante el build, Eleventy genera versiones WebP/JPEG de 480 a 1920 px. Si una foto pasa de 400 KB, el build lo avisa.

## Diseño

Reproduce la mecánica de la plantilla de referencia: tarjetas fotográficas a pantalla completa, barra de progreso superior (`.indicator`), navegación fija, dos paneles de detalle que se alternan (`#details-even` / `#details-odd`) con etiqueta, título en dos líneas, descripción y botón, HUD con flechas, barra `progress-sub` y numeración, y barrido inicial (`.cover`).
Cambios sobre la referencia:

- Cada diapositiva es un servicio. El botón principal es "Get a quote / Pedir cotización" y lleva al formulario con el servicio ya elegido.
- El marcador (bookmark) pasa a ser un botón de WhatsApp, o de llamada si no hay WhatsApp.
- Se añaden flecha "anterior", botón de pausa, teclado (← →), gestos táctiles y `prefers-reduced-motion` (sin animación ni avance automático).
- Todos los `style=""` se movieron a CSS. GSAP se sirve desde el propio sitio (npm), no desde cdnjs.
- Las tarjetas se colocan ya desde CSS, con las mismas fórmulas que el JS, para que no haya saltos (CLS 0) y la página pinte rápido.
