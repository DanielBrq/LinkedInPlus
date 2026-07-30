# LinkedIn Post HTML Structure — Extension Reference

Reference for DOM selectors used by the extension. Based on real LinkedIn HTML (Jul 2026).

## Contenedor raíz

```html
<div role="listitem" class="...">
```

- **Selector usado**: `[role="listitem"]` (`POST_CONTAINER_SELECTOR`)
- **Ubicación**: `lib/pipeline.js`
- **Nota**: Todos los posts (feed, grupos, jobs) usan `role="listitem"` como envoltorio.
- LinkedIn también renderiza `role="feed"` en el contenedor padre de la lista.

---

## Descripción del trabajo

```html
<span class="..." tabindex="-1" data-testid="expandable-text-box">
  🚀 We're #Hiring: Power Platform Automation Analyst 🚀
  ...
</span>
```

- **Selector usado**: `span[data-testid="expandable-text-box"]`, `[data-testid="expandable-text-box"]`
- **Ubicación**: `lib/parser.js` — `DESCRIPTION_SELECTORS`, `findDescriptionElement()`
- **Extracción**: `element.innerText` → `normalizeText()` (lowercase, colapsa whitespace, elimina zero-width chars)
- **Longitud mínima**: 100 caracteres (`MIN_DESCRIPTION_LENGTH` en `lib/constants.js`)

### Expandir texto truncado

LinkedIn trunca descripciones largas con un botón "See more" / "Mostrar más":

```html
<button aria-label="see more" ...>Ver más</button>
```

- **Selectores**: `button[aria-label*="see more" i]`, `button[aria-label*="mostrar más" i]`, `button[aria-label*="ver más" i]`
- **Ubicación**: `lib/parser.js` — `EXPAND_BUTTON_SELECTORS`
- **Acción**: Click + espera 200ms para que React re-renderice

---

## Edad del post

```html
<p class="...">
  <span>1 día •</span>
  <svg aria-label="Visibilidad: global" ...>...</svg>
</p>
```

- **Selector usado**: Ninguno específico. `extractPostAge()` escanea todos los `<span, time>` dentro del post.
- **Ubicación**: `lib/parser.js` — `extractPostAge()`
- **Lógica**: Busca texto de <16 chars que matchee `/\d+\s*(mo|mes|meses|w|sem|semanas?|d|días?|dias?|h|horas?)\b/`
- **Normalización EN→ES**:
  | LinkedIn muestra | Devuelve |
  |---|---|
  | `1mo`, `2mo` | `1mo`, `2mo` |
  | `1 mes`, `2 meses` | `1mo`, `2mo` |
  | `1w`, `2w` | `1w`, `2w` |
  | `1 sem`, `2 semanas` | `1w`, `2w` |
  | `3d`, `4d` | `3d`, `4d` |
  | `1 día`, `2 días` | `1d`, `2d` |
  | `5h`, `6h` | `5h`, `6h` |
  | `1 hora`, `2 horas` | `1h`, `2h` |
- **Filtro de edad**: `/[2-9]\d*mo/` — oculta posts de 2+ meses (`lib/pipeline.js:140`)

### Variaciones de formato según idioma

| Idioma | Ejemplo |
|--------|---------|
| EN feed | `1mo`, `2w`, `3d`, `4h` |
| ES feed | `1 mes`, `2 meses`, `1 sem`, `2 semanas` |
| ES grupos | `1 día •`, `2 días •` (con bullet separator) |
| EN job cards | `Posted 3 days ago` (no matchea el regex, retorna null → se ignora) |

---

## Botón "…" (menú de control)

```html
<button
  class="..."
  type="button"
  aria-label="Abrir el menú de controles para la publicación de Gabriel Suazo"
  aria-expanded="false"
>
  <svg ...>...</svg>
</button>
```

- **Selector usado** (post-fix): `button[aria-label*="control menu" i], button[aria-label*="menú" i], button[aria-label*="Más opciones"], button[aria-label*="Más acciones"]`
- **Ubicación**: `lib/pipeline.js` — `clickNotInterested()`
- **Acción**: Click → abre menú → busca `<div role="menuitem">` con texto matcheando `/not interested|no me interesa|no es relevante|no tengo interés/i` → click en el item

### Selectores históricos (no funcionan en ES actual)

| aria-label | ¿Matchea? | Nota |
|---|---|---|
| `Open control menu` | Sí (EN) | Selector original |
| `Abrir menú de control` | **No** | LinkedIn cambió a "Abrir **el** menú de **controles**..." |
| `Más opciones` | Sí (ES) | Alternativa ES |
| `Más acciones` | Sí (ES) | Alternativa ES |
| `Abrir el menú de controles para la publicación de...` | **Sí** (post-fix) | Usa `aria-label*="menú" i` |

---

## Dropdown del menú "…" (post ABIERTO)

Al hacer click en el botón "…", LinkedIn renderiza un popover flotante:

```html
<div popover="manual" tabindex="0"
     style="position: fixed; ... max-width: 256px; width: 256px;">
  <div role="menu">
    <div role="menuitem">...</div>  <!-- × N items -->
  </div>
</div>
```

### Estructura de cada menuitem

```html
<div role="menuitem" tabindex="-1" data-tabindex="0">
  <div>
    <svg ...>...</svg>           <!-- icono -->
    <div>
      <p>Texto del item</p>     <!-- ← clickNotInterest testea esto -->
    </div>
  </div>
</div>
```

### Items del menú (ES, Jul 2026)

| # | Texto exacto | ¿Lo usa la extensión? |
|---|---|---|
| 1 | `Guardar` | ✗ |
| 2 | `Copiar enlace a la publicación` | ✗ |
| 3 | `Insertar esta publicación` | ✗ (es `<a>`, no `<div>`) |
| 4 | `Ocultar publicaciones de {autor}` | ✗ |
| 5 | **`No me interesa`** | **✓ — clickNotInterested** |
| 6 | `Marcar como spam de IA` | ✗ |
| 7 | `Denunciar publicación` | ✗ (es `<a>`, no `<div>`) |

### Items del menú (EN, referencia)

| # | Texto exacto |
|---|---|
| 1 | `Save` |
| 2 | `Copy link to post` |
| 3 | `Embed this post` |
| 4 | `Hide posts from {author}` |
| 5 | **`Not interested`** |
| 6 | `Report post as AI spam` |
| 7 | `Report post` |

### Regex de matching del menuitem

```javascript
/not interested|no me interesa|no es relevante|no tengo interés/i
```

Ubicación: `lib/pipeline.js:74`

**Nota**: Items 3 y 7 son `<a role="menuitem">` (no `<div>`), pero `document.querySelectorAll('div[role="menuitem"]')` solo busca `<div>`. Si en el futuro se necesitan esos items, cambiar a `[role="menuitem"]` sin prefijo de tag.

---

## Botón cerrar / ocultar publicación (X)

```html
<button
  class="..."
  type="button"
  aria-label="Ocultar la publicación de Gabriel Suazo"
>
  <svg id="close-small" ...>...</svg>
</button>
```

- **Selector usado**: Ninguno. La extensión NO usa este botón.
- **Nota**: Es una alternativa directa de LinkedIn para ocultar un post SIN abrir menú. Podría usarse como fallback si el botón "…" no se encuentra. El comportamiento es distinto: oculta directamente sin dar feedback "No me interesa" a LinkedIn.

---

## Info del poster

### Post de grupo (este ejemplo)

```html
<div aria-label="Gabriel Suazo, En busca de personal  1er">
  <p><span>Costa Rica Talent</span></p>
</div>
<p>
  <span>Gabriel Suazo</span>
  <span> • 1er</span>
</p>
```

- **Selector usado**: `POSTER_INFO_SELECTORS` (clases como `.update-components-actor__name`, `.feed-shared-actor__name`, etc.)
- **Resultado en grupos**: `null` — las clases CSS de posts de grupo NO coinciden con los selectores del feed.
- **Perfil del poster**: `extractPosterProfileUrl()` busca `a[href*="/in/"]` — en grupos el link es `/groups/...`, no `/in/...`

### Post de feed normal (referencia)

```html
<div class="update-components-actor__meta-container">
  <span class="update-components-actor__name">
    <a href="https://www.linkedin.com/in/username/">Nombre Apellido</a>
  </span>
  <span class="update-components-actor__description">Cargo en Empresa</span>
</div>
```

- Las clases `.update-components-actor__name`, `.feed-shared-actor__name` SÍ matchean en posts de feed.

### Job card (página de empleos)

```html
<div class="job-card-container">
  <span class="job-card-list__company-name">Empresa</span>
  <span class="job-card-container__primary-description">Título del puesto</span>
</div>
```

- Selectores: `.job-card-list__company-name`, `.job-card-container__company-name`, `.jobs-unified-top-card__company-name`

---

## Hashtags

```html
<a href="https://www.linkedin.com/search/results/all/?keywords=%23hiring&amp;origin=HASH_TAG_FROM_FEED">
  <span><strong>#Hiring</strong></span>
</a>
```

- **Extracción**: `extractHashtags()` busca `/#\w+/g` en el texto del description element
- **Ubicación**: `lib/parser.js` — `extractHashtags()`

---

## Enlaces

```html
<a class="..." href="mailto:gsuazo@infotreeservice.com" target="_blank">
  <span><strong>gsuazo@infotreeservice.com</strong></span>
</a>
```

- **Extracción**: `extractLinks()` busca todos los `a[href]` dentro del description element
- **Filtro**: Excluye links internos de LinkedIn (`REGEX_LINKEDIN_SAFETY` en `lib/constants.js`)
- **Uso**: Se pasan a `classifyWithAI()` y se validan contra `result.applicationLink`

---

## Botones de acción (like, comment, share, send)

```html
<button aria-label="Estado del botón de reacción: ninguna reacción">...</button>
<button aria-label="Comentar">...</button>
<button aria-label="Compartir" aria-expanded="false">...</button>
<a aria-label="Enviar" href="https://www.linkedin.com/feed/">...</a>
```

- **La extensión NO usa estos botones.** Solo se documentan para completitud.

---

## Botón "Mostrar traducción"

```html
<button>
  <span>Mostrar traducción</span>
</button>
```

- **La extensión NO usa este botón.** Solo aparece cuando LinkedIn detecta contenido en otro idioma.

---

## Visibilidad del post (ícono globo)

```html
<svg id="globe-americas-small" aria-label="Visibilidad: global" ...>
```

- **La extensión NO usa este elemento.** Documentado para completitud.

---

## Tipos de post y selectores

| Tipo | Contenedor | Descripción | Poster info |
|------|-----------|-------------|-------------|
| Feed post | `[role="listitem"]` | `[data-testid="expandable-text-box"]` | `.update-components-actor__name` ✓ |
| Group post | `[role="listitem"]` | `[data-testid="expandable-text-box"]` | Clases no coinciden → `null` |
| Job card | `.job-card-container` | `.jobs-description__content`, `#job-details` | `.job-card-list__company-name` ✓ |
| Feed comment | `[role="comment"]` | No procesado | No procesado |

---

## Flujo de procesamiento (resumen)

```
DOM detect (MutationObserver)
  → container.closest('[role="listitem"]')
  → extractDescription(container)
      → findDescriptionElement() → span[data-testid="expandable-text-box"]
      → expandDescription() → click "See more" si existe
      → normalizeText() → lowercase, colapsa whitespace
  → NEGATIVE_PATTERNS → pre-filtra engagement bait
  → extractPostAge() → normaliza EN/ES → filtro 2+ meses
  → description.length < 100 → skip
  → classifyWithAI() → LLM clasifica
  → result.relevant → saveJob() o hidePost()
  → clickNotInterested() → feedback a LinkedIn
```

---

## Cambios conocidos en LinkedIn (actualizado Jul 2026)

| Fecha | Cambio | Impacto en extensión |
|-------|--------|---------------------|
| ~2025 | `aria-label="Open control menu"` → `"Abrir el menú de controles para la publicación de {name}"` | Selector del menú "…" dejó de funcionar en ES |
| ~2025 | "Not interested" → "No es relevante para mí" | Regex del menú actualizado |
| 2026 | Edad del post en español: "1 mes", "1 sem", "1 día" | `extractPostAge` actualizado para normalizar ES→EN |
