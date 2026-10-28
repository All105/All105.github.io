# Publicar la demo en GitHub, paso a paso

Resultado: la web funcionando en `https://NOMBRE-ORG.github.io/`, **oculta para Google**, lista para enseñársela al cliente.
Tiempo: unos 20 minutos. No necesitas instalar Node.js.

> En todo este documento, `allcleangroup-demo` es un ejemplo de nombre. Usa el que quieras, pero **siempre el mismo**.

---

## Paso 1. Cuenta de GitHub con 2FA

1. Entra en https://github.com y crea una cuenta, o inicia sesión.
2. Ve a tu foto › **Settings › Password and authentication › Enable two-factor authentication** y usa una app como Google Authenticator o Authy.

## Paso 2. Organización gratuita para el cliente

1. Ve a tu foto › **Your organizations › New organization** y elige el plan **Free**.
2. Nombre de la organización: `allcleangroup-demo`.
3. En "This organization belongs to", elige **My personal account**.
4. Pulsa Next; el paso de invitar personas puedes saltarlo.

Usar una organización y no tu cuenta personal permite entregársela al cliente más adelante, con todo el historial.

## Paso 3. Repositorio

1. Dentro de la organización, pulsa **Repositories › New repository**.
2. **Repository name**, exactamente: `allcleangroup-demo.github.io`, es decir, el nombre de la organización seguido de `.github.io`.
3. Elige **Public**. GitHub Pages es gratis solo en repositorios públicos, y el proyecto no contiene ningún secreto.
4. **No** marques "Add a README", ni .gitignore, ni licencia: el repositorio tiene que estar vacío.
5. Pulsa **Create repository**.

## Paso 4. Variables del modo demo

En el repositorio, ve a **Settings › Secrets and variables › Actions › pestaña Variables › New repository variable** y crea dos:

| Name | Value |
|---|---|
| `SITE_URL` | `https://allcleangroup-demo.github.io` |
| `NOINDEX` | `true` |

`NOINDEX = true` impide que Google indexe la demo.

## Paso 5. Activar Pages

Ve a **Settings › Pages › Build and deployment › Source** y elige **GitHub Actions**.

## Paso 6. Subir los archivos con GitHub Desktop

La subida desde la web de GitHub admite como máximo 100 archivos por vez y a veces omite la carpeta oculta `.github`, que es imprescindible. Por eso conviene usar la app gratuita **GitHub Desktop**:

1. Descomprime `all-clean-group.zip` en una carpeta de tu ordenador.
2. Descarga e instala GitHub Desktop desde https://desktop.github.com e inicia sesión con tu cuenta.
3. Elige **File › Clone repository** y selecciona `allcleangroup-demo/allcleangroup-demo.github.io`. Elige una carpeta local y pulsa **Clone**.
4. Abre esa carpeta (Repository › Show in Explorer, o Show in Finder en Mac) y **copia dentro todo el contenido** de la carpeta descomprimida: `src`, `docs`, `.github`, `package.json`, etc. Copia el contenido, no la carpeta que lo contiene.
   - En Windows, para ver las carpetas ocultas: Explorador › Vista › Mostrar › Elementos ocultos.
   - En Mac, pulsa `Cmd + Shift + .` en Finder.
5. Vuelve a GitHub Desktop. Verás unos 108 archivos nuevos. Abajo a la izquierda, en Summary, escribe `Demo inicial` y pulsa **Commit to main**.
6. Pulsa **Publish branch** (o **Push origin**).

**Alternativa:** si prefieres no instalar nada, dime el nombre de la organización y del repositorio y lo subo yo desde aquí.

## Paso 7. Esperar la publicación

1. En el repositorio, abre la pestaña **Actions**. Verás "Test and deploy" en marcha.
   Tarda entre 3 y 5 minutos porque primero pasa todas las pruebas: secretos, HTML, formulario, navegador.
2. Cuando aparezca el ✅ verde, abre `https://allcleangroup-demo.github.io/`.
3. Si aparece una ❌ roja, entra en el paso que falló, copia el texto del error y envíamelo.

## Paso 8. Comprobar la demo

- [ ] `/` redirige a `/en/` o `/es/` según el idioma de tu navegador.
- [ ] El carrusel se mueve, responde a las flechas del teclado, se desliza con el dedo en el móvil y tiene botón de pausa.
- [ ] El selector EN | ES cambia de idioma en todas las páginas.
- [ ] "Pedir cotización" lleva al formulario con el servicio ya elegido.
- [ ] `https://allcleangroup-demo.github.io/robots.txt` muestra `Disallow: /`, la prueba de que Google no la indexará.

**Normal en la demo:** el formulario responde "No pudimos enviar tu solicitud, llámanos", y `/admin` no permite iniciar sesión. Las dos cosas necesitan el dominio, Cloudflare y Brevo, que se configuran cuando el cliente apruebe (ver `DESPLIEGUE.md`).

## Paso 9. Cambiar textos en la demo (sin /admin)

Mientras no haya dominio, puedes editar desde la web de GitHub: abre el archivo, pulsa el lápiz ✏️, cambia el texto y pulsa **Commit changes**. La web se actualiza sola en unos 4 minutos.

| Quiero cambiar… | Archivo |
|---|---|
| Teléfono, correo, horario, redes | `src/content/site.json` |
| Textos de la portada y los pasos | `src/content/home.json` |
| Un servicio | `src/content/services/*.json` |
| Una zona | `src/content/zones/*.json` |
| Preguntas frecuentes | `src/content/faq/*.json` |

Respeta las comillas y las comas del archivo. Si falta una, la publicación falla y el aviso aparece en la pestaña Actions.

## Paso 10. Cuando el cliente apruebe

1. Las cuentas a nombre del cliente: dominio, Cloudflare, Brevo y el correo, todas con 2FA.
2. Entrega la organización al cliente: **Settings (de la organización) › People**, invita al cliente como **Owner**. Cuando acepte, tú puedes quedarte como miembro o salir.
3. En Variables, borra `NOINDEX` y cambia `SITE_URL` por `https://www.dominio-del-cliente.com`.
4. Sigue [DESPLIEGUE.md](DESPLIEGUE.md) desde el paso 0.
