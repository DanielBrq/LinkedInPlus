# F6 — cola de refactor

## content
| archivo | problema | acción | riesgo |
|---|---|---|---|
| `src/shared/utils.ts` | `hashText` solo lo consume `content/pipeline.ts` | Hecho: movido a `src/content/hash.ts` | bajo |
| `src/content/parser.ts` | `normalizeText` no tiene consumidores externos | Hecho: quitado `export` innecesario | bajo |

## popup
| archivo | problema | acción | riesgo |
|---|---|---|---|
| `src/shared/useStorage.ts` | composable Vue con un único consumidor en `popup/App.vue` | Hecho: movido a `src/popup/useStorage.ts` | bajo |

## Hechos
- `src`: 27 archivos versionados; máximo 112 LOC (`popup/App.vue`), ninguno supera 250 LOC.
- `src/content/index.ts` contiene una función ejecutable de 41 líneas; se mantiene para evitar separar lógica trivial.
- Sin ciclos de imports locales, anidamiento >3 ni duplicación ≥8 líneas en ≥3 sitios.
- Casts restantes corresponden a límites Chrome/DOM, tests o tipos genéricos; no se marcaron como evitables sin evidencia.

## content

| Archivo | Problema | Acción | Riesgo |
|---|---|---|---|
| `src/content/index.ts` | Inicialización concentra carga, observer y suscripciones (41 líneas) | Descartado: dividir añadiría helpers triviales | Bajo |
