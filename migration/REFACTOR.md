# F6 — cola de refactor

## content
| archivo | problema | acción | riesgo |
|---|---|---|---|
| `src/shared/utils.ts` | `hashText` solo lo consume `content/pipeline.ts` | Hecho: movido a `src/content/hash.ts` | bajo |

## popup
| archivo | problema | acción | riesgo |
|---|---|---|---|
| `src/shared/useStorage.ts` | composable Vue con un único consumidor en `popup/App.vue` | Mover a `popup` junto al consumidor | bajo |

## Hechos
- Plan medido con `migration-f5` completo y árbol de trabajo limpio; `migration-pre-refactor` ya existía.
- `src`: 26 archivos versionados; máximo 106 LOC (`popup/App.vue`), ninguno supera 250 LOC.
- Sin ciclos de imports locales detectados; no se identificaron funciones >40 líneas ni anidamiento >3.
- No se encontró duplicación que cumpla el umbral (bloque ≥8 líneas en ≥3 sitios).
- Casts restantes corresponden a límites Chrome/DOM, tests o tipos genéricos; no se marcaron como evitables sin evidencia.
