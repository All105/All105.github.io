# Datos que debes rellenar o confirmar

Solo he usado los datos que me diste. Todo lo demás está en blanco, marcado en la web como <mark>[…]</mark>, o pendiente de confirmar.
"Dónde" indica el campo de **/admin** (o el archivo, si no se edita desde el panel).

## Imprescindible antes de publicar

| # | Dato | Estado actual | Dónde |
|---|---|---|---|
| 1 | **Dominio** | `www.example.com` (marcador) | `node scripts/set-domain.mjs www.tudominio.com usuario/repo` |
| 2 | **Usuario/repositorio de GitHub** | `YOUR-GITHUB-USER/all-clean-group` | mismo script |
| 3 | **Razón social** (tal como aparece en Sunbiz) | vacío | Ajustes › Datos legales › Legal business name |
| 4 | **Dirección postal** (vale un apartado postal o un buzón comercial; no tiene que ser tu casa) | vacío | Ajustes › Datos legales › Mailing address · `POSTAL_ADDRESS` en `workers/quote/wrangler.toml` |
| 5 | **Fecha de entrada en vigor** de los textos legales | vacío | Ajustes › Datos legales › Effective date |
| 6 | **Turnstile site key** (pública) | vacío; sin ella el formulario no tiene antispam y el Worker lo rechaza | Ajustes › Integrations |
| 7 | **Turnstile secret key** | — | `wrangler secret put TURNSTILE_SECRET` (nunca en el repo) |
| 8 | **Brevo API key** | — | `wrangler secret put BREVO_API_KEY` |
| 9 | **Remitente verificado en Brevo** (`no-reply@tudominio.com`) | marcador | `FROM_EMAIL` en `workers/quote/wrangler.toml` |
| 10 | **UNSUB_SECRET** (cadena aleatoria larga) | — | `wrangler secret put UNSUB_SECRET` |
| 11 | **GitHub OAuth Client ID/Secret** (login del CMS) | — | `wrangler secret put …` en `workers/cms-auth` |
| 12 | **Fotos de los 6 servicios**: propias o con licencia, 16:10, JPG/WebP, < 400 KB, con descripción (alt) EN/ES | marcadores provisionales | Servicios › Foto / Photo description |
| 13 | **Imagen para redes** 1200×630 JPG | marcador con el nombre | Ajustes › Social share image |

## Confirmar (los redacté a partir de lo que me diste; corrígelos si no son exactos)

| # | Dato | Lo que puse | Dónde |
|---|---|---|---|
| 14 | **WhatsApp**: ¿es el mismo número que el teléfono? | `18133781020` | Ajustes › WhatsApp (déjalo vacío para ocultar el botón) |
| 15 | **Correo de recepción de cotizaciones** | `unitycorporateusa@gmail.com` | `TO_EMAIL` en `workers/quote/wrangler.toml` |
| 16 | **Qué incluye cada servicio** (listas "What it usually includes / Qué suele incluir"). Ejemplos: cambio de sábanas con tu ropa de cama, interior de electrodomésticos a pedido, retiro de restos ligeros | Lista típica del sector, no confirmada | Servicios › Qué incluye (EN/ES) |
| 17 | **Ciudades cercanas** por zona (Dunedin, Largo, Safety Harbor, Palm Harbor, St. Petersburg · Brandon, Riverview, Wesley Chapel, Plant City · Kissimmee, Winter Park, Davenport, Lakeland) | Ciudades del corredor Clearwater–Orlando | Zonas › Nearby communities |
| 18 | **Condados**: Kissimmee (Osceola), Davenport y Lakeland (Polk) no son del condado de Orange. ¿Quieres páginas propias para Lakeland o Kissimmee? | Solo hay páginas para Clearwater, Tampa y Orlando | Zonas › nueva entrada |
| 19 | **Atención en español** (pregunta frecuente n.º 7) | "Sí, en español o en inglés" | Preguntas frecuentes |
| 20 | **Conservación de solicitudes** | 24 meses | Ajustes › Datos legales › Keep quote requests |
| 21 | **Acuse de recibo al cliente** por correo | desactivado (`SEND_CONFIRMATION = "false"`) | `workers/quote/wrangler.toml` (requiere los datos 4 y 10 y la lista KV) |

## Políticas del negocio (huecos marcados en los Términos)

| # | Dato | Dónde |
|---|---|---|
| 22 | Validez de la cotización (p. ej. 30 días) | Páginas legales › Terms (EN/ES), sección 2 |
| 23 | Política de cancelación y cambio de fecha (preaviso, cargos) | Terms, sección 3 |
| 24 | Condado de jurisdicción (con tu abogado) | Terms, sección 9 |

## Opcional

| # | Dato | Dónde |
|---|---|---|
| 25 | Redes sociales (Facebook, Instagram, TikTok, perfil de Google) | Ajustes › Social networks (si está vacío, no se muestra) |
| 26 | Token de Cloudflare Web Analytics | Ajustes › Integrations (si está vacío, no hay analítica ni aviso) |
| 27 | Número de documento de Sunbiz | Ajustes › Datos legales |
| 28 | **Licencia / seguro / fianza**: márcalos **solo si es verdad** y tienes el documento. Hoy están desactivados y la web no lo menciona en ningún sitio (un test lo comprueba) | Ajustes › Credentials |
| 29 | "Revisado por abogado de Florida": márcalo cuando el abogado apruebe los textos; quita el aviso de borrador | Ajustes › Datos legales |

## Lo que no debes añadir sin pruebas

Reseñas o testimonios, valoraciones con estrellas, número de clientes, años de experiencia, certificaciones, "productos ecológicos", "personal verificado / background-checked", "satisfacción garantizada", fotos de antes y después que no sean reales y precios publicados.
Cualquiera de estas afirmaciones, si no es verdad, puede infringir la FDUTPA (Florida Deceptive and Unfair Trade Practices Act).
