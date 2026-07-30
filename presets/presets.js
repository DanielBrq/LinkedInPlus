import {
  getPresets, savePresets, getActivePresetName, setActivePresetName,
  deletePreset, renamePreset, DEFAULT_PRESET_CONFIG
} from '../lib/settings.js';
import { esc } from '../lib/utils.js';
import { FADE_OUT_DURATION_MS } from '../lib/constants.js';

const CONFIRM_DELETE = 'Delete preset "%s"?';
const listContainer = document.getElementById('listContainer');
const emptyState = document.getElementById('emptyState');
const statsCount = document.getElementById('statsCount');
const addPresetBtn = document.getElementById('addPresetBtn');

let presets = {};
let activeName = '';
let editingName = null;

function updateStats() {
  const count = Object.keys(presets).length;
  statsCount.textContent = count;
  emptyState.style.display = count === 0 ? 'block' : 'none';
}

function shortenUrl(url) {
  if (!url) return '';
  try { return new URL(url).hostname + '…'; } catch { return url.slice(0, 40) + '…'; }
}

async function reload() {
  presets = await getPresets();
  activeName = await getActivePresetName();
  render();
}

function render() {
  for (const c of listContainer.querySelectorAll('.card')) c.remove();
  const fragment = document.createDocumentFragment();
  for (const name of Object.keys(presets)) {
    fragment.appendChild(buildCard(name, presets[name]));
  }
  listContainer.appendChild(fragment);
  updateStats();
}

function buildCard(name, preset) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.name = name;

  const isActive = name === activeName;

  // Header
  const header = document.createElement('div');
  header.className = 'preset-card-header';
  header.innerHTML = `
    <span class="preset-active-dot${isActive ? ' active' : ''}" title="${isActive ? 'Active preset' : 'Click to activate'}"></span>
    <span class="preset-name${isActive ? ' active' : ''}">${esc(name)}</span>
    <span class="preset-meta">${esc(shortenUrl(preset.gatewayUrl))} · ${esc(preset.model || '')}</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'preset-card-actions';

  const activateBtn = document.createElement('button');
  activateBtn.className = 'secondary';
  activateBtn.textContent = isActive ? '✓ Active' : 'Set active';
  activateBtn.disabled = isActive;

  const editBtn = document.createElement('button');
  editBtn.className = 'secondary';
  editBtn.textContent = 'Edit';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.disabled = Object.keys(presets).length <= 1;

  actions.append(activateBtn, editBtn, deleteBtn);

  card.append(header, actions);

  // Activate
  activateBtn.addEventListener('click', async () => {
    await setActivePresetName(name);
    activeName = name;
    render();
  });

  // Click dot or name to activate
  header.addEventListener('click', async () => {
    if (name !== activeName) {
      await setActivePresetName(name);
      activeName = name;
      render();
    }
  });

  // Edit inline
  editBtn.addEventListener('click', () => {
    if (editingName === name) return;
    editingName = name;
    render();
  });

  // Delete
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(CONFIRM_DELETE.replace('%s', name))) return;
    card.classList.add('fade-out');
    setTimeout(async () => {
      await deletePreset(name);
      await reload();
    }, FADE_OUT_DURATION_MS);
  });

  // If this card is being edited, expand inline
  if (editingName === name) {
    const editor = buildEditor(name, preset);
    card.appendChild(editor);
    editor.querySelector('input')?.focus();
  }

  return card;
}

function buildEditor(name, preset) {
  const wrap = document.createElement('div');
  wrap.className = 'preset-editor';

  const fields = [
    { key: 'name', label: 'Preset Name', value: name, type: 'text', placeholder: 'my-preset' },
    { key: 'gatewayUrl', label: 'Gateway URL', value: preset.gatewayUrl || '', type: 'text', placeholder: DEFAULT_PRESET_CONFIG.gatewayUrl },
    { key: 'apiKey', label: 'API Key', value: preset.apiKey || '', type: 'password', placeholder: 'sk-...' },
    { key: 'model', label: 'Model', value: preset.model || '', type: 'text', placeholder: DEFAULT_PRESET_CONFIG.model },
    { key: 'filters', label: 'Filters', value: preset.filters || '', type: 'textarea', placeholder: 'Senior developer, remote, fintech...' },
    { key: 'negativeFilters', label: 'Negative Filters', value: preset.negativeFilters || '', type: 'textarea', placeholder: 'No Java, no agencies...' },
    { key: 'locationFilter', label: 'Location Filter', value: preset.locationFilter || '', type: 'text', placeholder: 'Costa Rica, Latam, Argentina, Honduras' },
  ];

  for (const f of fields) {
    const lbl = document.createElement('label');
    lbl.textContent = f.label;
    wrap.appendChild(lbl);

    let input;
    if (f.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.type = f.type;
    }
    input.value = f.value;
    input.placeholder = f.placeholder;
    input.dataset.field = f.key;
    wrap.appendChild(input);
  }

  const actions = document.createElement('div');
  actions.className = 'preset-editor-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'primary';
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'secondary';
  cancelBtn.textContent = 'Cancel';

  actions.append(saveBtn, cancelBtn);
  wrap.appendChild(actions);

  saveBtn.addEventListener('click', async () => {
    const newName = wrap.querySelector('[data-field="name"]').value.trim();
    const gatewayUrl = wrap.querySelector('[data-field="gatewayUrl"]').value.trim();
    const apiKey = wrap.querySelector('[data-field="apiKey"]').value.trim();
    const model = wrap.querySelector('[data-field="model"]').value.trim();
    const filters = wrap.querySelector('[data-field="filters"]').value;
    const negativeFilters = wrap.querySelector('[data-field="negativeFilters"]').value;
    const locationFilter = wrap.querySelector('[data-field="locationFilter"]').value.trim();

    if (!newName) { alert('Preset name is required'); return; }

    const updated = { name: newName, gatewayUrl, apiKey, model, filters, negativeFilters, locationFilter };

    if (newName !== name) {
      await renamePreset(name, newName);
    }

    presets[newName] = updated;
    await savePresets(presets);

    if (activeName === name) activeName = newName;
    editingName = null;
    await reload();
  });

  cancelBtn.addEventListener('click', () => {
    editingName = null;
    render();
  });

  return wrap;
}

// Add new preset
addPresetBtn.addEventListener('click', async () => {
  const existing = Object.keys(presets);
  let baseName = 'New Preset';
  let n = 1;
  while (existing.includes(baseName)) { baseName = `New Preset ${n++}`; }

  const newPreset = { ...DEFAULT_PRESET_CONFIG, name: baseName };
  presets[baseName] = newPreset;
  await savePresets(presets);

  editingName = baseName;
  await reload();

  const newCard = listContainer.querySelector(`.card[data-name="${baseName}"]`);
  if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// Init
reload();
