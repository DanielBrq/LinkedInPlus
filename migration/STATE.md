Estado (máx. 25 líneas; solo lo no derivable del repo)
Fase completada: F2 (F2b: poda de tests)
Checks: typecheck ok, test ok (17)
Vistas migradas: — (se llena en F4 desde INVENTORY)
Gotchas / bloqueos: dispatcher usa `KNOWN_TYPES` (Record) para exhaustividad porque `switch` no estrecha a `never` uniones de un solo mensaje; la migración de datos legacy vive en `shared/settings.ts`; CI (.github/workflows/ci.yml) aún corre eslint y tests legados de tests/*.mjs → actualizar en F5
F2b: no hay Decision Models en el repo ni en STATE/INVENTORY/git log; el LLM es el clasificador vivo y contrato MV3 → no se borró nada de LLM. Lista B pendiente de confirmación.
Próxima: F3
Decisiones fijas (no re-evaluar; cambiar solo con justificación aquí)
Plugin MV3: @crxjs/vite-plugin 3.0 (peer vite 8 cubierto); manifest.json se conserva, rutas apuntan a src/.
Tailwind v3.4 (PostCSS), no v4: comportamiento determinista dentro de Shadow DOM.
Tests: happy-dom + Vitest; `test.include` solo src/**/*.test.ts (los tests legados están en tests/*.mjs).
Código nuevo: noUncheckedIndexedAccess: true.
Validador: valibot en vez de zod (zod queda solo como peer transitivo de `ai`).
pnpm 12: builds aprobados en pnpm-workspace.yaml (`allowBuilds`), no en package.json.
