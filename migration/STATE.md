Estado (máx. 25 líneas; solo lo no derivable del repo)
Fase completada: F1
Checks: typecheck ok, test ok (3), build falla por falta de entry points src/ (llegan en F2–F4)
Vistas migradas: — (se llena en F4 desde INVENTORY)
Gotchas / bloqueos: build rojo hasta F4; CI (.github/workflows/ci.yml) aún corre eslint y tests legados de tests/*.mjs → actualizar en F5
Próxima: F2
Decisiones fijas (no re-evaluar; cambiar solo con justificación aquí)
Plugin MV3: @crxjs/vite-plugin 3.0 (peer vite 8 cubierto); manifest.json se conserva, rutas apuntan a src/.
Tailwind v3.4 (PostCSS), no v4: comportamiento determinista dentro de Shadow DOM.
Tests: happy-dom + Vitest; `test.include` solo src/**/*.test.ts (los tests legados están en tests/*.mjs).
Código nuevo: noUncheckedIndexedAccess: true.
Validador: valibot en vez de zod (zod queda solo como peer transitivo de `ai`).
pnpm 12: builds aprobados en pnpm-workspace.yaml (`allowBuilds`), no en package.json.
