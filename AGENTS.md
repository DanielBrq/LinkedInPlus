# Migración extensión MV3 → Vite + Vue 3 + TS + Tailwind + Vitest

`./docs/**`

## Protocolo
- Fases: F0 auditoría → F1 toolchain → F2 shared+background → F3 content → F4 vistas (una por ejecución) → F5 verificación final.
- Ante "fase N": lee solo `migration/STATE.md`, `migration/phases/FN.md` y lo que ese archivo liste en **Lee**. No abras otras fases ni re-audites lo ya registrado en `migration/INVENTORY.md`.
- Precondiciones: `git status` limpio y STATE.md marca N-1 completada. Si no, detente y avisa.
- Una fase por sesión (`/new` entre fases).

## Contratos MV3 (inmutables salvo justificación escrita en STATE.md)
Claves de `chrome.storage`, nombres/payloads de mensajes, permisos y `host_permissions`, `matches` de content scripts, selectores DOM de páginas anfitrionas. Fuente de verdad: `migration/INVENTORY.md`.

## Restricciones técnicas
- CSP MV3: prohibido `eval()`, `new Function()`, plantillas Vue compiladas en runtime (solo SFC precompilados; sin alias a `vue/dist/vue.esm-bundler`), scripts/handlers inline en HTML, recursos remotos/CDN.
- TypeScript `strict: true`. Sin `any`: usa `unknown` + narrowing.
- Test solo donde haya lógica con ramas, Decision Models o contratos. Prohibidos tests de montaje trivial, de mocks, de constantes y duplicados. Colocados junto al código (`*.test.ts`).
- `chrome.*` se mockea solo en `src/tests/setup.ts` (mock propio, sin dependencias extra).

## Economía de tokens
- Busca con grep/glob; lee por rango de líneas. Nunca leas `node_modules/`, `dist/`, lockfiles.
- Trunca salidas: `npm run test 2>&1 | tail -40`, `npm run typecheck 2>&1 | head -40`.
- Ediciones puntuales; no reescribas archivos enteros para cambios pequeños.
- Sin explicaciones en el chat. Respuesta final ≤10 líneas: checks, tag, bloqueos.
- Máx. 3 intentos de corrección por check fallido; luego detente y registra el bloqueo en STATE.md.
- ventana de contexto no mas de 80k, parar al alcanzar unmbral, entonces el usuario aplicará un /compact y continuaremos.

## Cierre de fase
1. Checks de la fase en verde.
2. Actualiza `migration/STATE.md` (máx. 25 líneas, solo lo no derivable del repo: decisiones, gotchas, desviaciones). No listes archivos: git los registra.
3. `git add -A && git commit -m "migración: fase N" && git tag migration-fN` (local, sin push).
