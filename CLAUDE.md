# Reglas de trabajo en este proyecto

## Cómo trabajamos
- El dueño del proyecto hace las configuraciones (Cloudflare, Brevo, GitHub, Squarespace, Google) para aprender. Claude prepara el código.
- Dar **un solo paso cada vez**, diciendo exactamente dónde hacer clic. Pedir una captura al terminar cada paso. Sin teoría innecesaria.
- Nunca pedir ni mostrar claves secretas en el chat (Secret Key de Turnstile, Client secret de GitHub, API key de Brevo, tokens). Solo valores públicos.

## Antes de entregar cualquier cambio de código
1. Probarlo en una **copia limpia** del repositorio de GitHub (git clone nuevo + `npm ci`), igual que hace GitHub Actions.
2. Ejecutar con la misma configuración que CI (`NOINDEX`/`SITE_URL` de las variables del repositorio):
   - `npm audit --audit-level=high`
   - `npm test` (build, validación HTML, tests del sitio, secretos, Workers)
   - `npm run test:e2e` (navegador: teclado, táctil, reduced motion, idioma, formulario, móvil 360 px, CSP)
3. Si un valor nuevo va a un archivo, comprobar que no lo marque el escáner de secretos (gitleaks).
4. Si algo no pasa, no se entrega: se arregla primero.
5. Entregar **solo los archivos que cambian**, en un ZIP con sus carpetas, e indicar desde qué carpeta de GitHub subirlo. Los archivos que empiezan por punto se crean con "Add file › Create new file".

## Datos del proyecto
- Repositorio: All105/All105.github.io (GitHub Pages, despliegue con Actions).
- Dominio: www.allcleanfloridagroup.com (Squarespace como registrador, DNS en Cloudflare).
- Correo de cotizaciones y contacto: comercial@allcleanfloridagroup.com.
- Pasos de despliegue y estado: docs/DESPLIEGUE.md y docs/DATOS-A-RELLENAR.md.
