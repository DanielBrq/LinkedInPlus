import { getSavedJobs, clearSavedJobs, removeJob } from '../lib/storage.js';
import { downloadFile } from '../lib/utils.js';
import {
  CSS_COLLAPSED, DESC_COLLAPSE_AT, FIT_HIGH, FIT_MID,
  FIT_SCORE_DEFAULT, FADE_OUT_DURATION_MS,
  EXPORT_FILENAME, EXPORT_MIME_TYPE
} from '../lib/constants.js';

const DESC_TOGGLE_SHOW = 'Show description';
const DESC_TOGGLE_HIDE = 'Hide description';
const CONFIRM_DELETE_ALL = 'Delete all %d job matches?';

const exportBtn = document.getElementById('exportBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const listContainer = document.getElementById('listContainer');
const emptyState = document.getElementById('emptyState');
const statsCount = document.getElementById('statsCount');

let jobs = [];

function fitClass(score) {
  if (score >= FIT_HIGH) return 'fit-high';
  if (score >= FIT_MID) return 'fit-mid';
  return 'fit-low';
}

function buildCard(job, idx) {
  const card = document.createElement('div');
  card.className = 'card';

  const fitScore = typeof job.fitScore === 'number' ? job.fitScore : FIT_SCORE_DEFAULT;
  const fClass = fitClass(fitScore);

  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <span class="idx">#${idx + 1}${job.title ? ' — ' + esc(job.title) : ''}</span>
    <span class="fit-badge ${fClass}">${fitScore}% fit</span>
  `;

  const body = document.createElement('div');
  body.className = 'card-body';

  const fields = document.createElement('div');
  fields.className = 'field-row';

  if (job.posterName) {
    fields.innerHTML += `<div class="field"><div class="field-label">Posted by</div><div class="field-value">${esc(job.posterName)}</div></div>`;
  }
  if (job.companyName) {
    fields.innerHTML += `<div class="field"><div class="field-label">Company</div><div class="field-value">${esc(job.companyName)}</div></div>`;
  }
  if (job.location) {
    fields.innerHTML += `<div class="field"><div class="field-label">Location</div><div class="field-value">${esc(job.location)}</div></div>`;
  }
  if (job.modality) {
    fields.innerHTML += `<div class="field"><div class="field-label">Modality</div><div class="field-value">${esc(job.modality)}</div></div>`;
  }
  if (job.englishLevel) {
    fields.innerHTML += `<div class="field"><div class="field-label">English</div><div class="field-value">${esc(job.englishLevel)}</div></div>`;
  }
  if (job.applicationEmail) {
    fields.innerHTML += `<div class="field"><div class="field-label">Email</div><div class="field-value">${esc(job.applicationEmail)}</div></div>`;
  }
  if (job.applicationLink) {
    const link = esc(job.applicationLink);
    fields.innerHTML += `<div class="field"><div class="field-label">Link</div><div class="field-value"><a href="${link}" target="_blank" rel="noopener" style="color:var(--primary-text)">${link}</a></div></div>`;
  }

  body.appendChild(fields);

  if (Array.isArray(job.technologies) && job.technologies.length > 0) {
    const techWrap = document.createElement('div');
    techWrap.style.marginBottom = '8px';
    job.technologies.forEach(t => {
      const tag = document.createElement('span');
      tag.className = 'tech-tag';
      tag.textContent = t;
      techWrap.appendChild(tag);
    });
    body.appendChild(techWrap);
  }

  if (Array.isArray(job.hashtags) && job.hashtags.length > 0) {
    const tagWrap = document.createElement('div');
    job.hashtags.forEach(h => {
      const tag = document.createElement('span');
      tag.className = 'tech-tag';
      tag.style.background = 'rgba(241,106,86,0.12)';
      tag.style.color = '#f48978';
      tag.textContent = h;
      tagWrap.appendChild(tag);
    });
    body.appendChild(tagWrap);
  }

  if (job.description) {
    const desc = document.createElement('div');
    desc.className = `desc-preview ${CSS_COLLAPSED}`;
    desc.textContent = job.description;
    body.appendChild(desc);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'secondary';
  toggleBtn.textContent = DESC_TOGGLE_SHOW;
  if (!job.description || job.description.length <= DESC_COLLAPSE_AT) toggleBtn.style.display = 'none';

  const spacer = document.createElement('span');
  spacer.className = 'flex-spacer';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'danger';
  deleteBtn.textContent = 'Delete';

  actions.append(toggleBtn, spacer, deleteBtn);
  card.append(header, body, actions);

  toggleBtn.addEventListener('click', () => {
    const desc = body.querySelector('.desc-preview');
    if (!desc) return;
    const isCollapsed = desc.classList.toggle(CSS_COLLAPSED);
    toggleBtn.textContent = isCollapsed ? DESC_TOGGLE_SHOW : DESC_TOGGLE_HIDE;
  });

  deleteBtn.addEventListener('click', async () => {
    card.classList.add('fade-out');
    setTimeout(async () => {
      const i = Array.from(card.parentNode.children).indexOf(card);
      if (i === -1) return;
      jobs.splice(i, 1);
      card.remove();
      renumberCards();
      updateStats();
      if (jobs.length === 0) {
        emptyState.style.display = 'block';
      }
      await deleteFromStorage(job);
    }, FADE_OUT_DURATION_MS);
  });

  return card;
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renumberCards() {
  const cards = document.querySelectorAll('.card');
  cards.forEach((c, i) => {
    const idxEl = c.querySelector('.idx');
    if (idxEl) idxEl.textContent = `#${i + 1}${jobs[i]?.title ? ' — ' + esc(jobs[i].title) : ''}`;
  });
}

function renderList() {
  clearCards();
  if (jobs.length === 0) {
    emptyState.style.display = 'block';
    updateStats();
    return;
  }
  emptyState.style.display = 'none';
  const fragment = document.createDocumentFragment();
  jobs.forEach((j, idx) => fragment.appendChild(buildCard(j, idx)));
  listContainer.appendChild(fragment);
  updateStats();
}

function clearCards() {
  for (const c of document.querySelectorAll('.card')) c.remove();
}

function updateStats() {
  statsCount.textContent = jobs.length;
  exportBtn.disabled = jobs.length === 0;
  clearAllBtn.disabled = jobs.length === 0;
}

async function loadData() {
  jobs = await getSavedJobs();
  renderList();
}

async function deleteFromStorage(job) {
  const h = job._hash;
  if (!h) return;
  await removeJob(h);
}

async function clearStorage() {
  await clearSavedJobs();
}

exportBtn.addEventListener('click', () => {
  if (jobs.length === 0) return;
  const data = JSON.stringify(jobs, null, 2);
  downloadFile(data, EXPORT_FILENAME, EXPORT_MIME_TYPE);
});

clearAllBtn.addEventListener('click', async () => {
  if (jobs.length === 0) return;
  if (!confirm(CONFIRM_DELETE_ALL.replace('%d', jobs.length))) return;
  jobs = [];
  await clearStorage();
  renderList();
});

loadData();
