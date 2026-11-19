Estado (máx. 25 líneas; solo lo no derivable del repo)
Fase completada: F2 (F2b: LLM → Decision Models)
Checks: typecheck ok, test ok (18)
Vistas migradas: — (se llena en F4 desde INVENTORY)
Gotchas / bloqueos: dispatcher usa `KNOWN_TYPES` (Record) para exhaustividad porque `switch` no estrecha a `never` uniones de un solo mensaje; la migración de datos legacy vive en `shared/settings.ts`; CI (.github/workflows/ci.yml) aún corre eslint y tests legados de tests/*.mjs → actualizar en F5
F2b: Decision Models en `src/background/index.ts` (Gateway `typesafe-ai/jev`, pregunta `score` 0..4 → 0..100). Contrato `AI_CLASSIFY` intacto: mismo request y `apiKey`/`model` en storage; el modelo de lenguaje legado se mapea al default en `getClassifierConfig`. Borrados `background.js` y dep `valibot`.
Próxima: F3
Decisiones fijas (no re-evaluar; cambiar solo con justificación aquí)
Plugin MV3: @crxjs/vite-plugin 3.0 (peer vite 8 cubierto); manifest.json se conserva, rutas apuntan a src/.
Tailwind v3.4 (PostCSS), no v4: comportamiento determinista dentro de Shadow DOM.
Tests: happy-dom + Vitest; `test.include` solo src/**/*.test.ts (los tests legados están en tests/*.mjs).
Código nuevo: noUncheckedIndexedAccess: true.
Validador: sin librería (valibot se eliminó en F2b al quitar el schema del LLM); zod queda solo como peer transitivo de `ai`.
pnpm 12: builds aprobados en pnpm-workspace.yaml (`allowBuilds`), no en package.json.
