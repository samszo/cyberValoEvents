// Point d'entrée principal — modules ES natifs
import { loadEvents, saveEvents, getApiKey, saveApiKey } from './storage.js';
import { SAMPLE_EVENTS } from './sampleData.js';
import { generateId, showToast, fmt, typeBadgeCls, statusBadgeCls } from './utils.js';
import { renderDashboard } from './views/dashboard.js';
import { renderEvents }    from './views/events.js';
import { initCalendar, renderCalendar, calPrev, calNext } from './views/calendar.js';
import { initChat }        from './views/chat.js';
import { generateDescription, generateReport, suggestIdeas, getModels } from './openai.js';

// ── État global ────────────────────────────────────────────────────────────
let events = loadEvents() || SAMPLE_EVENTS;
let currentId = null;
let generatedDesc = '';

let models = await getModels();


// ── Bootstrap modals ───────────────────────────────────────────────────────
const bsModal = id => bootstrap.Modal.getOrCreateInstance(document.getElementById(id));

// ── Navigation ─────────────────────────────────────────────────────────────
const VIEWS = { dashboard: 'Tableau de bord', events: 'Événements', calendar: 'Calendrier', ai: 'Assistant IA' };

function setView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('d-none'));
  const v = document.getElementById('view-' + name);
  if (v) v.classList.remove('d-none');

  document.querySelectorAll('[data-view]').forEach(a => {
    a.classList.toggle('active', a.dataset.view === name);
    a.classList.toggle('text-white-50', a.dataset.view !== name);
    a.classList.toggle('text-white',    a.dataset.view === name);
  });
  document.getElementById('topbarTitle').textContent = VIEWS[name] || name;

  if (name === 'dashboard') renderDashboard(events, openDetail);
  if (name === 'events')    renderFilteredEvents();
  if (name === 'calendar')  renderCalendar(events, openDetail);
}

document.querySelectorAll('[data-view]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    setView(link.dataset.view);
    document.getElementById('sidebar').classList.remove('open');
  });
});

// ── Sidebar mobile ─────────────────────────────────────────────────────────
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ── Filtres événements ─────────────────────────────────────────────────────
let searchTimer;
['searchInput', 'filterStatus', 'filterType'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(id === 'searchInput' ? 'input' : 'change', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderFilteredEvents, 250);
  });
});

function renderFilteredEvents() {
  const q      = (document.getElementById('searchInput').value || '').toLowerCase();
  const status = document.getElementById('filterStatus').value;
  const type   = document.getElementById('filterType').value;

  const filtered = events.filter(e => {
    if (status && e.status !== status) return false;
    if (type   && e.type   !== type)   return false;
    if (q && !`${e.title} ${e.description} ${e.laboratory}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  renderEvents(filtered, { onDetail: openDetail, onEdit: openEdit, onDelete: deleteEvent });
}

// ── Calendrier ─────────────────────────────────────────────────────────────
initCalendar();
document.getElementById('calPrev').addEventListener('click', () => calPrev(events, openDetail));
document.getElementById('calNext').addEventListener('click', () => calNext(events, openDetail));

// ── Détail événement ───────────────────────────────────────────────────────
function openDetail(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  currentId = id;
  document.getElementById('detailModalTitle').textContent = ev.title;
  document.getElementById('detailModalBody').innerHTML = detailHtml(ev);
  bsModal('detailModal').show();
}

function detailHtml(ev) {
  const multiDay = ev.endDate && ev.endDate !== ev.date;
  return `
  <div class="row g-3 small">
    <div class="col-6">
      <div class="text-muted fw-semibold mb-1" style="font-size:.68rem;text-transform:uppercase">Type</div>
      <span class="badge ${typeBadgeCls(ev.type)}">${ev.type}</span>
    </div>
    <div class="col-6">
      <div class="text-muted fw-semibold mb-1" style="font-size:.68rem;text-transform:uppercase">Statut</div>
      <span class="badge ${statusBadgeCls(ev.status)}">${ev.status}</span>
    </div>
    <div class="col-6">
      <div class="text-muted fw-semibold mb-1" style="font-size:.68rem;text-transform:uppercase">Date</div>
      ${fmt(ev.date)}${multiDay ? ' → ' + fmt(ev.endDate) : ''}
    </div>
    <div class="col-6">
      <div class="text-muted fw-semibold mb-1" style="font-size:.68rem;text-transform:uppercase">Lieu</div>
      ${ev.location || '—'}
    </div>
    <div class="col-6">
      <div class="text-muted fw-semibold mb-1" style="font-size:.68rem;text-transform:uppercase">Organisateur</div>
      ${ev.organizer || '—'}
    </div>
    <div class="col-6">
      <div class="text-muted fw-semibold mb-1" style="font-size:.68rem;text-transform:uppercase">Laboratoire</div>
      ${ev.laboratory || '—'}
    </div>
    <div class="col-6">
      <div class="text-muted fw-semibold mb-1" style="font-size:.68rem;text-transform:uppercase">Participants</div>
      ${Number(ev.participants || 0).toLocaleString('fr-FR')}
    </div>
    <div class="col-6">
      <div class="text-muted fw-semibold mb-1" style="font-size:.68rem;text-transform:uppercase">Budget</div>
      ${Number(ev.budget || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
    </div>
    ${ev.domains?.length ? `
    <div class="col-12">
      <div class="text-muted fw-semibold mb-1" style="font-size:.68rem;text-transform:uppercase">Domaines</div>
      <div class="d-flex flex-wrap gap-1">
        ${ev.domains.map(d => `<span class="badge bg-primary-subtle text-primary">${d}</span>`).join('')}
      </div>
    </div>` : ''}
    ${ev.objectives ? `
    <div class="col-12">
      <div class="text-muted fw-semibold mb-1" style="font-size:.68rem;text-transform:uppercase">Objectifs</div>
      <p class="mb-0">${ev.objectives}</p>
    </div>` : ''}
    ${ev.description ? `
    <div class="col-12">
      <div class="text-muted fw-semibold mb-1" style="font-size:.68rem;text-transform:uppercase">Description</div>
      <div class="bg-light border rounded p-2">${ev.description}</div>
    </div>` : ''}
  </div>`;
}

document.getElementById('detailEditBtn').addEventListener('click', () => {
  bsModal('detailModal').hide();
  openEdit(currentId);
});
document.getElementById('detailReportBtn').addEventListener('click', () => {
  bsModal('detailModal').hide();
  doGenerateReport(currentId);
});

// ── Formulaire événement ───────────────────────────────────────────────────
document.getElementById('newEventBtn').addEventListener('click', () => openCreate());

function openCreate() {
  document.getElementById('eventForm').reset();
  document.getElementById('fId').value = '';
  document.getElementById('eventModalTitle').textContent = 'Nouvel événement';
  bsModal('eventModal').show();
}

function openEdit(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  document.getElementById('fId').value          = ev.id;
  document.getElementById('fTitle').value       = ev.title || '';
  document.getElementById('fType').value        = ev.type || '';
  document.getElementById('fStatus').value      = ev.status || 'planifié';
  document.getElementById('fDate').value        = ev.date || '';
  document.getElementById('fEndDate').value     = ev.endDate || '';
  document.getElementById('fLocation').value   = ev.location || '';
  document.getElementById('fOrganizer').value  = ev.organizer || '';
  document.getElementById('fLaboratory').value = ev.laboratory || '';
  document.getElementById('fParticipants').value = ev.participants || '';
  document.getElementById('fBudget').value     = ev.budget || '';
  document.getElementById('fDomains').value    = (ev.domains || []).join(', ');
  document.getElementById('fObjectives').value = ev.objectives || '';
  document.getElementById('fDescription').value= ev.description || '';
  document.getElementById('eventModalTitle').textContent = 'Modifier l\'événement';
  bsModal('eventModal').show();
}

document.getElementById('saveEventBtn').addEventListener('click', () => {
  const id      = document.getElementById('fId').value;
  const title   = document.getElementById('fTitle').value.trim();
  const type    = document.getElementById('fType').value;
  const date    = document.getElementById('fDate').value;

  if (!title || !type || !date) {
    showToast('Veuillez remplir les champs obligatoires (titre, type, date)', 'error');
    return;
  }

  const payload = {
    title, type, date,
    status:      document.getElementById('fStatus').value,
    endDate:     document.getElementById('fEndDate').value,
    location:    document.getElementById('fLocation').value.trim(),
    organizer:   document.getElementById('fOrganizer').value.trim(),
    laboratory:  document.getElementById('fLaboratory').value.trim(),
    participants: Number(document.getElementById('fParticipants').value) || 0,
    budget:       Number(document.getElementById('fBudget').value) || 0,
    domains:      document.getElementById('fDomains').value.split(',').map(s => s.trim()).filter(Boolean),
    objectives:   document.getElementById('fObjectives').value.trim(),
    description:  document.getElementById('fDescription').value.trim(),
  };

  if (id) {
    const idx = events.findIndex(e => e.id === id);
    events[idx] = { ...events[idx], ...payload, updatedAt: new Date().toISOString() };
    showToast('Événement mis à jour');
  } else {
    events.unshift({ id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...payload });
    showToast('Événement créé');
  }

  saveEvents(events);
  bsModal('eventModal').hide();
  refreshCurrentView();
});

function deleteEvent(id) {
  if (!confirm('Supprimer cet événement définitivement ?')) return;
  events = events.filter(e => e.id !== id);
  saveEvents(events);
  showToast('Événement supprimé', 'info');
  refreshCurrentView();
}

function refreshCurrentView() {
  const active = document.querySelector('.view:not(.d-none)');
  if (!active) return;
  const id = active.id.replace('view-', '');
  setView(id);
}

// ── Génération description IA ──────────────────────────────────────────────
document.getElementById('generateDescBtn').addEventListener('click', async () => {
  const title = document.getElementById('fTitle').value.trim();
  const type  = document.getElementById('fType').value;
  if (!title || !type) {
    showToast('Renseignez le titre et le type avant de générer', 'error'); return;
  }
  document.getElementById('aiDescOutput').textContent = 'Génération en cours…';
  bsModal('aiDescModal').show();
  try {
    generatedDesc = await generateDescription({
      title, type,
      domains:    document.getElementById('fDomains').value.split(',').map(s => s.trim()).filter(Boolean),
      objectives: document.getElementById('fObjectives').value
    });
    document.getElementById('aiDescOutput').textContent = generatedDesc;
  } catch (err) {
    document.getElementById('aiDescOutput').textContent = '⚠️ ' + err.message;
  }
});

document.getElementById('aiDescUseBtn').addEventListener('click', () => {
  document.getElementById('fDescription').value = generatedDesc;
  bsModal('aiDescModal').hide();
});

// ── Rapport IA ─────────────────────────────────────────────────────────────
async function doGenerateReport(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  document.getElementById('reportOutput').textContent = 'Génération du rapport en cours…';
  bsModal('reportModal').show();
  try {
    const report = await generateReport(ev);
    document.getElementById('reportOutput').textContent = report;
  } catch (err) {
    document.getElementById('reportOutput').textContent = '⚠️ ' + err.message;
  }
}

document.getElementById('reportCopyBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('reportOutput').textContent)
    .then(() => showToast('Rapport copié'));
});

// ── Outils IA (panneau assistant) ──────────────────────────────────────────
document.getElementById('toolGenerateDesc').addEventListener('click', () => {
  setView('events');
  setTimeout(openCreate, 150);
  showToast('Créez un événement puis cliquez sur "Générer avec IA"', 'info');
});

document.getElementById('toolGenerateReport').addEventListener('click', () => {
  const finished = events.filter(e => e.status === 'terminé');
  if (!finished.length) { showToast('Aucun événement terminé', 'error'); return; }
  const card = document.getElementById('aiOutputCard');
  document.getElementById('aiOutputTitle').textContent = 'Choisir un événement terminé';
  document.getElementById('aiOutput').innerHTML = finished.map(e =>
    `<button class="btn btn-sm btn-outline-secondary w-100 text-start mb-1 ai-report-pick" data-id="${e.id}">
      <i class="bi bi-file-text me-1"></i>${e.title}</button>`
  ).join('');
  card.classList.remove('d-none');
  document.querySelectorAll('.ai-report-pick').forEach(btn =>
    btn.addEventListener('click', () => doGenerateReport(btn.dataset.id))
  );
});

document.getElementById('toolSuggestIdeas').addEventListener('click', async () => {
  const card = document.getElementById('aiOutputCard');
  document.getElementById('aiOutputTitle').textContent = 'Idées d\'événements';
  document.getElementById('aiOutput').textContent = 'Génération en cours…';
  card.classList.remove('d-none');
  try {
    document.getElementById('aiOutput').textContent = await suggestIdeas();
  } catch (err) {
    document.getElementById('aiOutput').textContent = '⚠️ ' + err.message;
  }
});

document.getElementById('copyOutput').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('aiOutput').textContent)
    .then(() => showToast('Copié'));
});

// ── Paramètres (clé API) ───────────────────────────────────────────────────
document.getElementById('settingsBtn').addEventListener('click', () => {
  const key = getApiKey();
  document.getElementById('apiKeyInput').value = key;
  document.getElementById('apiKeyStatus').innerHTML = key
    ? '<div class="alert alert-success py-1 small mb-0"><i class="bi bi-check-circle me-1"></i>Clé configurée</div>'
    : '<div class="alert alert-warning py-1 small mb-0"><i class="bi bi-exclamation-triangle me-1"></i>Aucune clé — fonctions IA désactivées</div>';
  bsModal('settingsModal').show();
});

document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (key && !key.startsWith('sk-')) {
    showToast('La clé doit commencer par sk-', 'error'); return;
  }
  saveApiKey(key);
  bsModal('settingsModal').hide();
  showToast(key ? 'Clé API enregistrée' : 'Clé API supprimée', key ? 'success' : 'info');
});

// ── Chat ────────────────────────────────────────────────────────────────────
initChat();

// ── Init ────────────────────────────────────────────────────────────────────
setView('dashboard');

// Afficher un indicateur si la clé API n'est pas configurée
if (!getApiKey()) {
  showToast('Configurez votre clé OpenAI via "Clé API" pour activer l\'assistant IA', 'info');
}
