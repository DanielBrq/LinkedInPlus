Estado (máx. 25 líneas; solo lo no derivable del repo)
Fase completada: ninguna
Checks (typecheck / test / build): —
Vistas migradas: — (se llena en F4 desde INVENTORY)
Gotchas / bloqueos: —
Próxima: F0
Decisiones fijas (no re-evaluar; cambiar solo con justificación aquí)
Plugin MV3: @crxjs/vite-plugin. En F1 verificar con pnpm view que su peer vite cubre la versión instalada; si no, usar vite-plugin-web-extension y anotarlo aquí.
Tailwind v3.4 (PostCSS), no v4: comportamiento determinista dentro de Shadow DOM.
Tests: happy-dom; fallback jsdom si falla algo de Shadow DOM.
manifest.json se conserva como archivo; solo cambian las rutas de entry points a fuentes src/.
Código nuevo: noUncheckedIndexedAccess: true.