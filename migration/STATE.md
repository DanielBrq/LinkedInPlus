Estado (máx. 25 líneas; solo lo no derivable del repo)
Fase completada: F5 (migración cerrada). Checks: typecheck, test (36), build, check:dist ok.
Obsoletos heredados sin referencias en src/ ni manifest (no borrar sin confirmación): content.js, popup.html, popup.js, theme.css, lib/*.js, tests/*.mjs, .eslintrc.json.
F5: `pnpm run check:dist` (scripts/check-dist.mjs [dir]) verifica rutas del manifest, permissions/host_permissions/matches/run_at contra INVENTORY y escanea dist/**/*.js.
F5: crxjs añade web_accessible_resources en dist para los chunks del content; el manifest fuente no lo declara.
F5: hosts https tolerados en JS de dist (strings de bundle): w3.org, vercel.com, vuejs.org, json-schema.org, ai-gateway.vercel.sh.
F5: CI corre typecheck/test/build/check:dist; lint legado (eslint) fuera. README apunta a dist/.
Checklist manual en Chrome (pendiente de ejecutar):
- Cargar dist/ sin empaquetar; SW sin errores en consola.
- Stop del SW en chrome://serviceworker-internals y repetir AI_CLASSIFY.
- Content en página LinkedIn dentro de matches (clasifica) y fuera (no inyecta).
- Popup lee/escribe classifier_config y respeta el umbral 0..100.
- Selectores de descripción funcionan; estilos Shadow DOM correctos en 2 sitios.
Decisiones fijas (no re-evaluar):
- crxjs 3.0 con manifest.json fuente; rutas a src/.
- Tailwind v3.4 por Shadow DOM; tests happy-dom+Vitest solo src/**/*.test.ts; noUncheckedIndexedAccess.
- Sin validador propio (valibot eliminado; zod solo peer transitivo de ai).
- pnpm 12: allowBuilds en pnpm-workspace.yaml.
F2b: Decision Models (Gateway typesafe-ai/jev, score 0..4 → 0..100); AI_CLASSIFY intacto.
F3: clearProcessedHashes limpia caché AI; ClassifierConfig.timeoutMs conservado.
