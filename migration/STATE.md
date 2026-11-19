Estado (máx. 25 líneas; solo lo no derivable del repo)
Fase completada: F3 (F2b: LLM → Decision Models; F2c: sin prefiltros regex)
Checks: typecheck ok, test ok (33)
Vistas migradas: popup (src/popup)
Gotchas / bloqueos: CI (.github/workflows/ci.yml) aún corre eslint y tests legados de tests/*.mjs → actualizar en F5
F2b: Decision Models en `src/background/index.ts` (Gateway `typesafe-ai/jev`, pregunta `score` 0..4 → 0..100). Contrato `AI_CLASSIFY` intacto; el modelo legado se mapea al default en `getClassifierConfig`. Borrados `background.js` y dep `valibot`.
F2c: borrados NEGATIVE_PATTERNS, extractPostAge() y el filtro 2+ meses. Se conservan normalizeText (ahora en src/content/parser.ts) y MIN_DESCRIPTION_LENGTH.
F2: dispatcher usa `KNOWN_TYPES`; migración legacy en `shared/settings.ts`.
F3: `clearProcessedHashes` ahora también limpia la caché AI (el original reutilizaba scores viejos tras cambiar config).
F3: `ClassifierConfig.timeoutMs?: number` añadido para conservar el timeout opcional que leía aiFilter.
F3: sin UI Vue; `.lc-pending` se inyecta como `<style>` en document porque estiliza posts del host (no shadow). Sin assets runtime → `web_accessible_resources` eliminado del manifest.
F3: content scripts ya no usan import()/getURL: crxjs bundlea `src/content/index.ts` con sus imports.
F4: popup lee config con getClassifierConfig (migración+clamp) y el toggle usa el nuevo `shared/useStorage.ts` (sincroniza onChanged, limpia en onScopeDispose).
F4: Tailwind por clases en App.vue; `src/popup/style.css` solo directives y ancho de body. popup.html/popup.js/theme.css heredados → F5.
Próxima: F5
Decisiones fijas (no re-evaluar; cambiar solo con justificación aquí)
Plugin MV3: @crxjs/vite-plugin 3.0 (peer vite 8 cubierto); manifest.json se conserva, rutas apuntan a src/.
Tailwind v3.4 (PostCSS), no v4: comportamiento determinista dentro de Shadow DOM.
Tests: happy-dom + Vitest; `test.include` solo src/**/*.test.ts.
Código nuevo: noUncheckedIndexedAccess: true.
Validador: sin librería (valibot eliminado en F2b); zod queda solo como peer transitivo de `ai`.
pnpm 12: allowBuilds en pnpm-workspace.yaml.
