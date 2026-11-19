# F2c — Retirar prefiltros por regex

**Lee:** STATE.md, INVENTORY.md (filas content), `lib/constants.js`, `lib/parser.js`, `lib/pipeline.js`, `src/shared/constants.ts`.
**Escribe:** `lib/`, `src/shared/constants.ts`, tests legados afectados, README.

**Tareas**
1. Borrar `NEGATIVE_PATTERNS` y el prefiltro de `pipeline.js`: el Decision Model ya puntúa con las preferencias negativas del usuario.
2. Borrar `extractPostAge()` y el filtro de antigüedad (solo servía a ese prefiltro).
3. Conservar `normalizeText()`: no filtra, sanea el texto para hash/dedupe y prompt.
4. Conservar `MIN_DESCRIPTION_LENGTH` (no es regex).
5. Ajustar tests y README que describían los prefiltros.

**Salida:** typecheck, `pnpm test` y `node --test tests/*.test.mjs` en verde.
