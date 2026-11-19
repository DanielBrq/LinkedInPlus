# Plan Maestro de Migración: Extensión MV3 → Vite + Vue 3 + TS + Tailwind + Vitest

## Reglas Globales para el Agente (Obligatorias en todas las fases)
1. **Ejecución estrictamente por fase:** Cuando el usuario indique `"ejecuta fase N"`, lee únicamente este `migration.md` (incluyendo la sección `Estado Actual`) y los archivos estrictamente necesarios para esa fase. No ejecutes fases posteriores ni re-audites archivos ya documentados en el estado.
2. **Preservación de contratos MV3:** No alteres claves de `chrome.storage`, nombres de mensajes (`runtime` / `tabs`), permisos en `manifest.json` ni selectores DOM de páginas anfitrionas sin justificarlo explícitamente.
3. **Cumplimiento CSP Manifest V3:** Prohibido usar `eval()`, `new Function()`, compilación de plantillas Vue en runtime o scripts remotos por CDN.
4. **TypeScript estricto y tests:** Todo el código nuevo debe compilar bajo `strict: true` (sin `any` implícitos) y contar con tests unitarios en **Vitest** para lógica pura, contratos de storage/mensajería y componentes clave.
5. **Actualización de estado al cerrar fase:** Antes de finalizar tu turno, actualiza la sección `## Estado Actual y Handoff` al final de este archivo con los archivos creados/modificados, resultados de `vue-tsc`/`vitest`/`build` y cualquier detalle crítico para la siguiente fase.

---

## Fase 1: Scaffolding, Toolchain, Tailwind y Vitest
**Objetivo:** Configurar la infraestructura base de compilación, tipado, estilos y testing sin migrar aún toda la lógica de negocio.

**Tareas:**
1. Lee `migration.md` (`Estado Actual`), `package.json` y `manifest.json`.
2. Configura:
   - `package.json`: dependencias de `vue` (v3), `typescript`, `@types/chrome` (o `webextension-polyfill` si aplica), `vite`, `@vitejs/plugin-vue`, plugin MV3 para Vite (ej. `@crxjs/vite-plugin` o `vite-plugin-web-extension` compatible) y `tailwindcss`.
   - `tsconfig.json`: `strict: true`, resolución de módulos compatible con Vite y alias `@/` hacia `src/`.
   - `vite.config.ts` y configuración de Tailwind CSS.
   - **Vitest:** Instala `vitest`, `@vue/test-utils`, `happy-dom` (o `jsdom`) y configura `vitest.config.ts` (o bloque `test` en `vite.config.ts`) junto con un setup básico de mocks para `chrome.*` APIs en `src/tests/setup.ts`.
   - Crea el esqueleto de carpetas en `src/` según el mapa de Fase 1 y añade scripts en `package.json` (`dev`, `build`, `typecheck` con `vue-tsc --noEmit`, `test` con `vitest run`).
3. **Criterio de salida:** `pnpm run typecheck` y `pnpm run test` (con un test smoke inicial) pasan en verde. Actualiza `migration.md`.

---

## Fase 2: Capa Compartida (`src/shared/`) y Background (`service_worker`)
**Objetivo:** Migrar contratos compartidos y la lógica de fondo a TypeScript estricto con cobertura en Vitest.

**Tareas:**
1. Lee `migration.md` (`Estado Actual`) y únicamente los archivos originales del `background`, mensajería y storage.
2. Implementa `src/shared/`:
   - `messages.ts`: uniones discriminadas en TypeScript para tipar mensajes y respuestas entre vistas Vue, content scripts y background.
   - `storage.ts`: helpers tipados sobre `chrome.storage` respetando exactamente las claves originales.
3. Migra el `background` a `src/background/` en TypeScript puro:
   - Cero imports de Vue y cero referencias a `window` o `document`.
   - Enrutamiento tipado de mensajes, listeners de ciclo de vida y persistencia en `chrome.storage` (evitando estado volátil en memoria ante suspensión del service worker).
4. Escribe tests unitarios en Vitest para `storage.ts`, utilidades compartidas y los handlers principales del `background` mockeando `chrome.runtime` y `chrome.storage`.
5. **Criterio de salida:** `pnpm run typecheck` y `pnpm run test` pasan sin errores. Actualiza `migration.md`.

---

## Fase 3: Content Scripts (TS estricto + Shadow DOM y Tailwind si hay UI)
**Objetivo:** Migrar los `content scripts` a TypeScript estricto, aislando cualquier UI inyectada con Shadow DOM + Tailwind CSS y cubriendo la lógica con Vitest.

**Tareas:**
1. Lee `migration.md` (`Estado Actual`) y únicamente los archivos originales de `content scripts` y sus utilidades DOM.
2. Migra cada content script a `src/content/`:
   - Valida nodos DOM en runtime (`null` checks estrictos) ante cambios en páginas anfitrionas.
   - Conecta mensajería y almacenamiento usando `src/shared/`.
   - **Si monta UI en la página anfitriona:** Monta la app Vue 3 dentro de un `ShadowRoot` (`attachShadow({ mode: 'open' })`) e inyecta el CSS compilado de Tailwind dentro de ese `shadowRoot`. Si usa assets locales, resuélvelos con `chrome.runtime.getURL(...)` y decláralos en `web_accessible_resources` en `manifest.json`.
3. Escribe tests en Vitest (con `happy-dom`/`jsdom`) validando manipulación DOM, montaje en Shadow DOM (si aplica) y envío/recepción de mensajes.
4. **Criterio de salida:** `pnpm run typecheck` y `pnpm run test` pasan sin errores. Actualiza `migration.md`.

---

## Fase 4: Vistas Vue 3 + Tailwind, Tests de Componentes y Verificación Final
**Objetivo:** Migrar las vistas UI propias de la extensión (`popup`, `options`, `sidepanel`, etc.), completar tests en Vitest y validar el `build` de producción MV3.

**Tareas:**
1. Lee `migration.md` (`Estado Actual`) y únicamente los archivos HTML/JS/CSS originales de las vistas propias de la extensión.
2. Migra cada vista a su punto de entrada (`index.html` + `main.ts` + `App.vue` + componentes/composables tipados) con Tailwind CSS, conectando estado y eventos con `src/shared/` y sincronizando cambios reactivos con `chrome.storage.onChanged`.
3. Escribe tests en Vitest con `@vue/test-utils` para los componentes/flujos principales de las vistas migradas.
4. Verifica el paquete final:
   - Ejecuta `pnpm run typecheck`, `pnpm run test` y `pnpm run build`.
   - Comprueba que `dist/manifest.json` apunte correctamente a los bundles compilados, permisos e iconos, sin `eval()`/`new Function()` ni recursos remotos.
   - Lista en `migration.md` los archivos heredados obsoletos listos para eliminar y los pasos de prueba manual en `chrome://extensions`.
5. **Criterio de salida:** Build de producción limpio en `dist/`, tests y typecheck en verde. Actualiza `migration.md`.

---

## Estado Actual y Handoff
- **Última fase completada:** Ninguna (Pendiente Fase 1)
- **Estado de checks (`typecheck` / `test` / `build`):** Pendiente
- **Auditoría y Mapa de Archivos:** _(Completar en Fase 1)_
- **Archivos creados/modificados:** _(Actualizar al cierre de cada fase)_
- **Notas críticas para la siguiente sesión:** Ejecutar Fase 1.