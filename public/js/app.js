/* ===== State ===== */
const state = {
  events: [],
  currentTags: [],
  editingId: null,
  chatHistory: []
};

/* ===== Type → CSS class ===== */
const TYPE_CLASS = {
  'Conférence': 'type-conf',
  'Séminaire': 'type-semi',
  'Publication': 'type-pub',
  'Brevet': 'type-brev',
  'Prix / Distinction': 'type-prix',
  'Contrat de recherche': 'type-cont',
  'Partenariat industriel': 'type-part',
  'Exposition / Médiation': 'type-expo',
  'Création d\'entreprise': 'type-entr',
  'Autre': 'type-autr'
};

/* ===== API helpers ===== */
const API = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async del(path) {
    const r = await fetch(path, { method: 'DELETE' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
};

/* ===== Toast ===== */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

/* ===== Navigation ===== */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const view = item.dataset.view;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`view-${view}`).classList.add('active');
    document.getElementById('viewTitle').textContent = item.textContent.trim();
    if (view === 'dashboard') loadDashboard();
    if (view === 'events') loadEvents();
    if (view === 'report') populateReportYears();
    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
  });
});

document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

/* ===== Dashboard ===== */
async function loadDashboard() {
  try {
    const [stats, events] = await Promise.all([
      API.get('/api/stats'),
      API.get('/api/events')
    ]);
    state.events = events;

    document.getElementById('statTotal').textContent = stats.total;
    const currentYear = new Date().getFullYear().toString();
    document.getElementById('statAnnee').textContent = stats.par_annee[currentYear] || 0;
    document.getElementById('statLabo').textContent = Object.keys(stats.par_laboratoire).length;
    document.getElementById('statTypes').textContent = Object.keys(stats.par_type).length;

    renderBarChart('chartTypes', stats.par_type, 5);
    renderBarChart('chartAnnees', stats.par_annee, 5);
    renderRecentEvents(events.slice(0, 5));
  } catch (err) {
    console.error(err);
  }
}

function renderBarChart(containerId, data, maxItems) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, maxItems);
  if (!sorted.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Aucune donnée</p>';
    return;
  }
  const max = sorted[0][1];
  sorted.forEach(([label, count]) => {
    const pct = Math.round((count / max) * 100);
    container.innerHTML += `
      <div class="bar-item">
        <span class="bar-label" title="${label}">${label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <span class="bar-count">${count}</span>
      </div>`;
  });
}

function renderRecentEvents(events) {
  const container = document.getElementById('recentEvents');
  if (!events.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Aucun événement encore enregistré.</p>';
    return;
  }
  container.innerHTML = events.map(e => `
    <div class="recent-item">
      <span class="badge recent-badge ${TYPE_CLASS[e.type] || 'type-autr'}">${e.type}</span>
      <div class="recent-info">
        <div class="recent-title">${e.titre}</div>
        <div class="recent-meta">${e.chercheur || '—'} · ${e.laboratoire || '—'} · ${formatDate(e.date)}</div>
      </div>
    </div>`).join('');
}

/* ===== Events List ===== */
async function loadEvents(params = {}) {
  try {
    const qs = new URLSearchParams(params).toString();
    const events = await API.get(`/api/events${qs ? '?' + qs : ''}`);
    state.events = events;
    renderEventsList(events);
    populateYearFilter(events);
  } catch (err) {
    showToast('Erreur lors du chargement des événements', 'error');
  }
}

function populateYearFilter(events) {
  const years = [...new Set(events.map(e => e.date?.substring(0, 4)).filter(Boolean))].sort().reverse();
  const sel = document.getElementById('filterAnnee');
  const current = sel.value;
  sel.innerHTML = '<option value="">Toutes les années</option>';
  years.forEach(y => sel.innerHTML += `<option value="${y}" ${y === current ? 'selected' : ''}>${y}</option>`);
}

function renderEventsList(events) {
  const container = document.getElementById('eventsList');
  if (!events.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">Aucun événement trouvé</div>
        <div class="empty-sub">Ajoutez votre premier événement de valorisation</div>
      </div>`;
    return;
  }
  container.innerHTML = events.map(e => `
    <div class="event-card" data-id="${e.id}">
      <div class="event-card-header">
        <div class="event-card-title">${e.titre}</div>
        <div class="event-card-actions">
          <button class="icon-btn" title="Modifier" onclick="event.stopPropagation(); openEditModal('${e.id}')">✏️</button>
          <button class="icon-btn" title="Supprimer" onclick="event.stopPropagation(); deleteEvent('${e.id}')">🗑️</button>
        </div>
      </div>
      <span class="badge ${TYPE_CLASS[e.type] || 'type-autr'}">${e.type}</span>
      <div class="event-card-meta">
        ${e.chercheur ? `<span>👤 ${e.chercheur}</span>` : ''}
        ${e.laboratoire ? `<span>🏛️ ${e.laboratoire}</span>` : ''}
        ${e.date ? `<span>📅 ${formatDate(e.date)}</span>` : ''}
        ${e.lieu ? `<span>📍 ${e.lieu}</span>` : ''}
      </div>
      ${e.description ? `<div class="event-card-desc">${e.description}</div>` : ''}
      ${e.mots_cles?.length ? `
        <div class="tags-list">
          ${e.mots_cles.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>` : ''}
    </div>`).join('');
}

/* ===== Search / Filter ===== */
let searchTimer;
document.getElementById('searchInput').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilters, 300);
});
document.getElementById('filterType').addEventListener('change', applyFilters);
document.getElementById('filterAnnee').addEventListener('change', applyFilters);

function applyFilters() {
  const params = {};
  const search = document.getElementById('searchInput').value.trim();
  const type = document.getElementById('filterType').value;
  const annee = document.getElementById('filterAnnee').value;
  if (search) params.search = search;
  if (type) params.type = type;
  if (annee) params.annee = annee;
  loadEvents(params);
}

/* ===== Modal ===== */
document.getElementById('btnNewEvent').addEventListener('click', openNewModal);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('btnCancelModal').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

function openNewModal() {
  state.editingId = null;
  state.currentTags = [];
  document.getElementById('modalTitle').textContent = 'Nouvel événement';
  document.getElementById('eventId').value = '';
  clearForm();
  openModal();
}

async function openEditModal(id) {
  try {
    const event = await API.get(`/api/events/${id}`);
    state.editingId = id;
    state.currentTags = event.mots_cles || [];
    document.getElementById('modalTitle').textContent = 'Modifier l\'événement';
    document.getElementById('eventId').value = id;
    document.getElementById('eventTitre').value = event.titre || '';
    document.getElementById('eventType').value = event.type || '';
    document.getElementById('eventDate').value = event.date || '';
    document.getElementById('eventChercheur').value = event.chercheur || '';
    document.getElementById('eventLaboratoire').value = event.laboratoire || '';
    document.getElementById('eventLieu').value = event.lieu || '';
    document.getElementById('eventUrl').value = event.url || '';
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventImpact').value = event.impact || '';
    renderTags();
    openModal();
  } catch (err) {
    showToast('Erreur lors du chargement', 'error');
  }
}

function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('eventTitre').focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function clearForm() {
  ['eventTitre','eventType','eventDate','eventChercheur','eventLaboratoire',
   'eventLieu','eventUrl','eventDescription','eventImpact'].forEach(id => {
    document.getElementById(id).value = '';
  });
  renderTags();
}

/* ===== Save Event ===== */
document.getElementById('btnSaveEvent').addEventListener('click', async () => {
  const titre = document.getElementById('eventTitre').value.trim();
  const type = document.getElementById('eventType').value;
  const date = document.getElementById('eventDate').value;

  if (!titre || !type || !date) {
    showToast('Veuillez remplir les champs obligatoires (titre, type, date)', 'error');
    return;
  }

  const payload = {
    titre,
    type,
    date,
    chercheur: document.getElementById('eventChercheur').value.trim(),
    laboratoire: document.getElementById('eventLaboratoire').value.trim(),
    lieu: document.getElementById('eventLieu').value.trim(),
    url: document.getElementById('eventUrl').value.trim(),
    description: document.getElementById('eventDescription').value.trim(),
    impact: document.getElementById('eventImpact').value.trim(),
    mots_cles: state.currentTags
  };

  const btn = document.getElementById('btnSaveEvent');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> Enregistrement...';

  try {
    if (state.editingId) {
      await API.put(`/api/events/${state.editingId}`, payload);
      showToast('Événement mis à jour', 'success');
    } else {
      await API.post('/api/events', payload);
      showToast('Événement créé', 'success');
    }
    closeModal();
    loadEvents();
  } catch (err) {
    showToast('Erreur lors de l\'enregistrement', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Enregistrer';
  }
});

/* ===== Delete Event ===== */
async function deleteEvent(id) {
  if (!confirm('Supprimer cet événement ?')) return;
  try {
    await API.del(`/api/events/${id}`);
    showToast('Événement supprimé', 'success');
    loadEvents();
    loadDashboard();
  } catch (err) {
    showToast('Erreur lors de la suppression', 'error');
  }
}

/* ===== Tags ===== */
document.getElementById('tagInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addTag(e.target.value.trim());
    e.target.value = '';
  }
});

function addTag(tag) {
  if (!tag || state.currentTags.includes(tag)) return;
  state.currentTags.push(tag);
  renderTags();
}

function removeTag(tag) {
  state.currentTags = state.currentTags.filter(t => t !== tag);
  renderTags();
}

function renderTags() {
  const container = document.getElementById('tagsContainer');
  container.innerHTML = state.currentTags.map(t => `
    <span class="tag-chip">
      ${t}
      <button class="tag-chip-remove" onclick="removeTag('${t}')">×</button>
    </span>`).join('');
}

/* ===== AI: Generate Description ===== */
document.getElementById('btnGenerateDesc').addEventListener('click', async () => {
  const titre = document.getElementById('eventTitre').value.trim();
  const type = document.getElementById('eventType').value;
  if (!titre || !type) {
    showToast('Remplissez d\'abord le titre et le type', 'error');
    return;
  }
  const btn = document.getElementById('btnGenerateDesc');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading dark"></span> Génération...';
  try {
    const data = await API.post('/api/ai/generate-description', {
      titre,
      type,
      chercheur: document.getElementById('eventChercheur').value.trim(),
      laboratoire: document.getElementById('eventLaboratoire').value.trim(),
      date: document.getElementById('eventDate').value,
      mots_cles: state.currentTags.join(', ')
    });
    document.getElementById('eventDescription').value = data.description;
    showToast('Description générée par l\'IA', 'success');
  } catch (err) {
    showToast('Erreur IA : ' + (err.message || 'Vérifiez votre clé API'), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ Générer avec l\'IA';
  }
});

/* ===== AI: Suggest Tags ===== */
document.getElementById('btnSuggestTags').addEventListener('click', async () => {
  const titre = document.getElementById('eventTitre').value.trim();
  const type = document.getElementById('eventType').value;
  if (!titre) {
    showToast('Remplissez d\'abord le titre', 'error');
    return;
  }
  const btn = document.getElementById('btnSuggestTags');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading dark"></span> Suggestions...';
  try {
    const data = await API.post('/api/ai/suggest-tags', {
      titre,
      type,
      description: document.getElementById('eventDescription').value.trim()
    });
    data.tags.forEach(t => addTag(t));
    showToast(`${data.tags.length} tags suggérés`, 'success');
  } catch (err) {
    showToast('Erreur IA : ' + (err.message || 'Vérifiez votre clé API'), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ Suggérer des tags avec l\'IA';
  }
});

/* ===== Report ===== */
function populateReportYears() {
  const events = state.events;
  const years = [...new Set(events.map(e => e.date?.substring(0, 4)).filter(Boolean))].sort().reverse();
  const sel = document.getElementById('reportAnnee');
  sel.innerHTML = '<option value="">Tous les événements</option>';
  years.forEach(y => sel.innerHTML += `<option value="${y}">${y}</option>`);
}

document.getElementById('btnGenerateReport').addEventListener('click', async () => {
  const periode = document.getElementById('reportPeriode').value.trim() || 'toute la période';
  const format = document.getElementById('reportFormat').value;
  const annee = document.getElementById('reportAnnee').value;

  let eventsToUse = state.events;
  if (annee) eventsToUse = eventsToUse.filter(e => e.date?.startsWith(annee));

  if (!eventsToUse.length) {
    showToast('Aucun événement à synthétiser pour cette période', 'error');
    return;
  }

  const btn = document.getElementById('btnGenerateReport');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> Génération en cours...';

  try {
    const data = await API.post('/api/ai/generate-report', { events: eventsToUse, periode, format });
    document.getElementById('reportContent').textContent = data.rapport;
    document.getElementById('reportResult').style.display = 'block';
    document.getElementById('reportResult').scrollIntoView({ behavior: 'smooth' });
    showToast('Rapport généré', 'success');
  } catch (err) {
    showToast('Erreur IA : ' + (err.message || 'Vérifiez votre clé API'), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ Générer avec l\'IA';
  }
});

document.getElementById('btnCopyReport').addEventListener('click', () => {
  const text = document.getElementById('reportContent').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('Rapport copié dans le presse-papiers', 'success'));
});

/* ===== Chat ===== */
document.getElementById('btnSendChat').addEventListener('click', sendChat);
document.getElementById('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

function appendChatMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const avatar = role === 'user' ? '👤' : '🤖';
  const div = document.createElement('div');
  div.className = `chat-message ${role}`;
  div.innerHTML = `
    <div class="chat-avatar">${avatar}</div>
    <div class="chat-bubble">${text.replace(/\n/g, '<br>')}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  appendChatMessage('user', text);

  state.chatHistory.push({ role: 'user', content: text });

  const typingDiv = appendChatMessage('assistant', '');
  typingDiv.querySelector('.chat-bubble').classList.add('typing');

  const btn = document.getElementById('btnSendChat');
  btn.disabled = true;

  try {
    const data = await API.post('/api/ai/chat', {
      messages: state.chatHistory,
      context: `L'application contient ${state.events.length} événements de valorisation.`
    });
    typingDiv.querySelector('.chat-bubble').classList.remove('typing');
    typingDiv.querySelector('.chat-bubble').innerHTML = data.message.replace(/\n/g, '<br>');
    state.chatHistory.push({ role: 'assistant', content: data.message });
  } catch (err) {
    typingDiv.querySelector('.chat-bubble').classList.remove('typing');
    typingDiv.querySelector('.chat-bubble').innerHTML =
      '<span style="color:var(--danger)">Erreur : ' + (err.message || 'Vérifiez votre clé API OpenAI') + '</span>';
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

/* ===== Auto-resize textarea ===== */
document.getElementById('chatInput').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

/* ===== Utils ===== */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

/* ===== API Status Check ===== */
async function checkApiStatus() {
  const dot = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  try {
    const r = await fetch('/api/stats');
    if (r.ok) {
      dot.classList.add('ok');
      text.textContent = 'Connecté';
    }
  } catch {
    dot.classList.add('error');
    text.textContent = 'Hors ligne';
  }
}

/* ===== Init ===== */
async function init() {
  await loadDashboard();
  checkApiStatus();
  // Load events in background for report years
  const evts = await API.get('/api/events').catch(() => []);
  state.events = evts;
  populateYearFilter(evts);
}

init();
