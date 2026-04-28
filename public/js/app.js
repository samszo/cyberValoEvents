/* ─── CyberValoEvents — Paris 8 ─── */
const API = '';

// ── State ──────────────────────────────────────────
let allEvents = [];
let currentEventId = null;
let calYear, calMonth;
let chatHistory = [];
let generatedDescription = '';

// ── Utils ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtNum = n => Number(n || 0).toLocaleString('fr-FR');
const fmtEur = n => Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function typeBadgeClass(type) {
  const map = {
    'colloque': 'badge-colloque', 'conférence': 'badge-conférence',
    'séminaire': 'badge-séminaire', 'workshop': 'badge-workshop',
    "journée d'étude": 'badge-journée', 'exposition': 'badge-exposition'
  };
  return map[type] || 'badge-autre';
}

function statusClass(s) { return 'status-' + s.replace(' ', '-'); }

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  $('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(err.error || 'Erreur');
  }
  return res.json();
}

// ── Navigation ────────────────────────────────────
function setView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const view = $('view-' + name);
  if (view) view.classList.add('active');
  const navItem = document.querySelector(`[data-view="${name}"]`);
  if (navItem) navItem.classList.add('active');
  const titles = { dashboard: 'Tableau de bord', events: 'Événements', calendar: 'Calendrier', ai: 'Assistant IA' };
  $('topbarTitle').textContent = titles[name] || name;
  if (name === 'dashboard') loadDashboard();
  if (name === 'events') loadEventsList();
  if (name === 'calendar') renderCalendar();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    setView(item.dataset.view);
    if (window.innerWidth < 768) $('sidebar').classList.remove('open');
  });
});
document.querySelectorAll('.card-link').forEach(link => {
  link.addEventListener('click', e => { e.preventDefault(); setView(link.dataset.view); });
});
$('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));

// ── Dashboard ─────────────────────────────────────
async function loadDashboard() {
  try {
    const [stats, events] = await Promise.all([apiFetch('/api/stats'), apiFetch('/api/events')]);
    allEvents = events;

    $('statTotal').textContent = stats.total;
    $('statUpcoming').textContent = stats.upcoming;
    $('statDone').textContent = stats.terminé;
    $('statParticipants').textContent = fmtNum(stats.totalParticipants);
    $('statBudget').textContent = fmtEur(stats.totalBudget);

    // Upcoming
    const upcoming = events.filter(e => new Date(e.date) >= new Date() && e.status !== 'annulé')
      .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 5);
    $('upcomingList').innerHTML = upcoming.length ? upcoming.map(eventItemHtml).join('') :
      '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">Aucun événement à venir</div></div>';

    // Ongoing
    const ongoing = events.filter(e => e.status === 'en cours').slice(0, 4);
    $('ongoingList').innerHTML = ongoing.length ? ongoing.map(eventItemHtml).join('') :
      '<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-text">Aucun événement en cours</div></div>';

    // Type chart
    const total = stats.total || 1;
    $('typeChart').innerHTML = Object.entries(stats.byType).map(([type, count]) => `
      <div class="type-bar-row">
        <div class="type-bar-label">${type}</div>
        <div class="type-bar-track"><div class="type-bar-fill" style="width:${Math.round(count / total * 100)}%"></div></div>
        <div class="type-bar-count">${count}</div>
      </div>`).join('');

    // Domains
    const domains = Object.entries(stats.byDomain).sort((a, b) => b[1] - a[1]).slice(0, 14);
    $('domainTags').innerHTML = domains.map(([d, c]) =>
      `<span class="tag tag-domain">${d} <span class="tag-count">${c}</span></span>`).join('');

    attachEventItemListeners();
  } catch (err) { showToast('Erreur de chargement: ' + err.message, 'error'); }
}

function eventItemHtml(e) {
  return `<div class="event-item status-${e.status.replace(' ', '-')}" data-id="${e.id}">
    <div class="event-item-info">
      <div class="event-item-title">${e.title}</div>
      <div class="event-item-meta">${e.laboratory || e.organizer || ''}</div>
    </div>
    <div class="event-item-date">${fmt(e.date)}</div>
  </div>`;
}

function attachEventItemListeners() {
  document.querySelectorAll('.event-item').forEach(el => {
    el.addEventListener('click', () => openDetail(el.dataset.id));
  });
}

// ── Events List ───────────────────────────────────
async function loadEventsList() {
  const search = $('searchInput').value;
  const status = $('filterStatus').value;
  const type = $('filterType').value;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  try {
    const events = await apiFetch('/api/events?' + params);
    allEvents = events;
    renderEventCards(events);
  } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
}

function renderEventCards(events) {
  if (!events.length) {
    $('eventsList').innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">🔍</div>
      <div class="empty-state-text">Aucun événement trouvé</div></div>`;
    return;
  }
  $('eventsList').innerHTML = events.map(e => `
    <div class="event-card" data-id="${e.id}">
      <div class="event-card-top">
        <span class="event-type-badge ${typeBadgeClass(e.type)}">${e.type}</span>
        <div class="event-card-title">${e.title}</div>
      </div>
      <div class="event-card-body">
        <div class="event-card-meta">
          <div class="event-meta-row"><span class="event-meta-icon">📅</span>${fmt(e.date)}${e.endDate && e.endDate !== e.date ? ' → ' + fmt(e.endDate) : ''}</div>
          ${e.location ? `<div class="event-meta-row"><span class="event-meta-icon">📍</span>${e.location}</div>` : ''}
          ${e.organizer ? `<div class="event-meta-row"><span class="event-meta-icon">👤</span>${e.organizer}</div>` : ''}
          ${e.laboratory ? `<div class="event-meta-row"><span class="event-meta-icon">🔬</span>${e.laboratory}</div>` : ''}
        </div>
        <div class="detail-tags">
          ${(e.domains || []).slice(0, 3).map(d => `<span class="tag tag-domain">${d}</span>`).join('')}
        </div>
      </div>
      <div class="event-card-footer">
        <span class="status-badge ${statusClass(e.status)}">${e.status}</span>
        <div class="event-card-actions">
          <span class="event-meta-row" style="margin-right:8px"><span class="event-meta-icon">👥</span>${fmtNum(e.participants)}</span>
          <button class="btn-icon edit-btn" data-id="${e.id}" title="Modifier">✏️</button>
          <button class="btn-icon delete-btn" data-id="${e.id}" title="Supprimer">🗑️</button>
        </div>
      </div>
    </div>`).join('');

  document.querySelectorAll('.event-card').forEach(c => {
    c.addEventListener('click', () => openDetail(c.dataset.id));
  });
  document.querySelectorAll('.edit-btn').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); openEdit(b.dataset.id); });
  });
  document.querySelectorAll('.delete-btn').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); deleteEvent(b.dataset.id); });
  });
}

let searchTimer;
$('searchInput').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadEventsList, 300); });
$('filterStatus').addEventListener('change', loadEventsList);
$('filterType').addEventListener('change', loadEventsList);

// ── Event Form ────────────────────────────────────
function openCreate() {
  $('eventForm').reset();
  $('eventId').value = '';
  $('modalTitle').textContent = 'Nouvel événement';
  $('eventModal').classList.add('open');
}

function openEdit(id) {
  const ev = allEvents.find(e => e.id === id);
  if (!ev) return;
  $('eventId').value = ev.id;
  $('fTitle').value = ev.title || '';
  $('fType').value = ev.type || '';
  $('fStatus').value = ev.status || 'planifié';
  $('fDate').value = ev.date || '';
  $('fEndDate').value = ev.endDate || '';
  $('fLocation').value = ev.location || '';
  $('fOrganizer').value = ev.organizer || '';
  $('fLaboratory').value = ev.laboratory || '';
  $('fParticipants').value = ev.participants || '';
  $('fBudget').value = ev.budget || '';
  $('fDomains').value = (ev.domains || []).join(', ');
  $('fObjectives').value = ev.objectives || '';
  $('fDescription').value = ev.description || '';
  $('modalTitle').textContent = 'Modifier l\'événement';
  $('eventModal').classList.add('open');
}

function closeModal(id) { $(id).classList.remove('open'); }

$('newEventBtn').addEventListener('click', openCreate);
$('modalClose').addEventListener('click', () => closeModal('eventModal'));
$('cancelBtn').addEventListener('click', () => closeModal('eventModal'));
$('eventModal').addEventListener('click', e => { if (e.target === $('eventModal')) closeModal('eventModal'); });

$('saveEventBtn').addEventListener('click', async () => {
  const id = $('eventId').value;
  const payload = {
    title: $('fTitle').value.trim(),
    type: $('fType').value,
    status: $('fStatus').value,
    date: $('fDate').value,
    endDate: $('fEndDate').value,
    location: $('fLocation').value.trim(),
    organizer: $('fOrganizer').value.trim(),
    laboratory: $('fLaboratory').value.trim(),
    participants: Number($('fParticipants').value) || 0,
    budget: Number($('fBudget').value) || 0,
    domains: $('fDomains').value.split(',').map(s => s.trim()).filter(Boolean),
    objectives: $('fObjectives').value.trim(),
    description: $('fDescription').value.trim()
  };
  if (!payload.title || !payload.type || !payload.date) {
    showToast('Veuillez remplir les champs obligatoires', 'error'); return;
  }
  try {
    if (id) {
      await apiFetch('/api/events/' + id, { method: 'PUT', body: payload });
      showToast('Événement mis à jour');
    } else {
      await apiFetch('/api/events', { method: 'POST', body: payload });
      showToast('Événement créé');
    }
    closeModal('eventModal');
    loadEventsList();
    loadDashboard();
  } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
});

async function deleteEvent(id) {
  if (!confirm('Supprimer cet événement ?')) return;
  try {
    await apiFetch('/api/events/' + id, { method: 'DELETE' });
    showToast('Événement supprimé', 'info');
    allEvents = allEvents.filter(e => e.id !== id);
    renderEventCards(allEvents);
    loadDashboard();
  } catch (err) { showToast('Erreur: ' + err.message, 'error'); }
}

// ── Detail Modal ──────────────────────────────────
function openDetail(id) {
  const ev = allEvents.find(e => e.id === id);
  if (!ev) return;
  currentEventId = id;
  $('detailTitle').textContent = ev.title;
  $('detailBody').innerHTML = `
    <div class="detail-grid">
      <div>
        <div class="detail-label">Type</div>
        <div class="detail-value"><span class="event-type-badge ${typeBadgeClass(ev.type)}">${ev.type}</span></div>
      </div>
      <div>
        <div class="detail-label">Statut</div>
        <div class="detail-value"><span class="status-badge ${statusClass(ev.status)}">${ev.status}</span></div>
      </div>
      <div>
        <div class="detail-label">Date</div>
        <div class="detail-value">${fmt(ev.date)}${ev.endDate && ev.endDate !== ev.date ? ' → ' + fmt(ev.endDate) : ''}</div>
      </div>
      <div>
        <div class="detail-label">Lieu</div>
        <div class="detail-value">${ev.location || '—'}</div>
      </div>
      <div>
        <div class="detail-label">Organisateur</div>
        <div class="detail-value">${ev.organizer || '—'}</div>
      </div>
      <div>
        <div class="detail-label">Laboratoire</div>
        <div class="detail-value">${ev.laboratory || '—'}</div>
      </div>
      <div>
        <div class="detail-label">Participants</div>
        <div class="detail-value">${fmtNum(ev.participants)}</div>
      </div>
      <div>
        <div class="detail-label">Budget</div>
        <div class="detail-value">${fmtEur(ev.budget)}</div>
      </div>
      ${ev.domains?.length ? `<div class="detail-full">
        <div class="detail-label">Domaines</div>
        <div class="detail-tags">${ev.domains.map(d => `<span class="tag tag-domain">${d}</span>`).join('')}</div>
      </div>` : ''}
      ${ev.objectives ? `<div class="detail-full">
        <div class="detail-label">Objectifs</div>
        <div class="detail-value">${ev.objectives}</div>
      </div>` : ''}
      ${ev.description ? `<div class="detail-full">
        <div class="detail-label">Description</div>
        <div class="detail-desc">${ev.description}</div>
      </div>` : ''}
    </div>`;
  $('detailModal').classList.add('open');
}

$('detailClose').addEventListener('click', () => closeModal('detailModal'));
$('detailClose2').addEventListener('click', () => closeModal('detailModal'));
$('detailModal').addEventListener('click', e => { if (e.target === $('detailModal')) closeModal('detailModal'); });
$('detailEdit').addEventListener('click', () => { closeModal('detailModal'); openEdit(currentEventId); });
$('detailReport').addEventListener('click', () => generateReport(currentEventId));

// ── Calendar ──────────────────────────────────────
function renderCalendar() {
  const now = new Date();
  if (!calYear) { calYear = now.getFullYear(); calMonth = now.getMonth(); }

  const title = new Date(calYear, calMonth, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  $('calTitle').textContent = title.charAt(0).toUpperCase() + title.slice(1);

  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  let startDow = firstDay.getDay() - 1; if (startDow < 0) startDow = 6;

  let html = days.map(d => `<div class="cal-day-header">${d}</div>`).join('');
  for (let i = 0; i < startDow; i++) {
    const d = new Date(firstDay); d.setDate(d.getDate() - (startDow - i));
    html += `<div class="cal-day other-month"><div class="cal-day-num">${d.getDate()}</div></div>`;
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const todayStr = now.toISOString().slice(0, 10);
    const dayEvents = allEvents.filter(e => e.date === dateStr || (e.date <= dateStr && e.endDate >= dateStr));
    html += `<div class="cal-day${dateStr === todayStr ? ' today' : ''}" data-date="${dateStr}">
      <div class="cal-day-num">${d}</div>
      <div class="cal-day-events">${dayEvents.map(e => `<div class="cal-event-dot" title="${e.title}">${e.title}</div>`).join('')}</div>
    </div>`;
  }
  $('calendarGrid').innerHTML = html;

  const monthEvents = allEvents.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === calYear && d.getMonth() === calMonth;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  $('calEventList').innerHTML = monthEvents.length
    ? monthEvents.map(e => `<div class="cal-event-entry" data-id="${e.id}">
        <span class="event-type-badge ${typeBadgeClass(e.type)}">${e.type}</span>
        <div style="flex:1">
          <div class="event-item-title">${e.title}</div>
          <div class="event-item-meta">${fmt(e.date)}</div>
        </div>
        <span class="status-badge ${statusClass(e.status)}">${e.status}</span>
      </div>`).join('')
    : '<div class="empty-state"><div class="empty-state-text">Aucun événement ce mois-ci</div></div>';

  document.querySelectorAll('.cal-event-entry').forEach(el => {
    el.addEventListener('click', () => openDetail(el.dataset.id));
  });
}

$('calPrev').addEventListener('click', () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar();
});
$('calNext').addEventListener('click', () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar();
});

// ── AI Generate Description ───────────────────────
$('generateDescBtn').addEventListener('click', async () => {
  const title = $('fTitle').value.trim();
  const type = $('fType').value;
  if (!title || !type) { showToast('Renseignez le titre et le type pour générer une description', 'error'); return; }

  $('aiDescOutput').textContent = 'Génération en cours...';
  $('aiDescModal').classList.add('open');
  try {
    const res = await apiFetch('/api/ai/generate-description', {
      method: 'POST',
      body: { title, type, domains: $('fDomains').value.split(',').map(s => s.trim()).filter(Boolean), objectives: $('fObjectives').value }
    });
    generatedDescription = res.description;
    $('aiDescOutput').textContent = res.description;
  } catch (err) {
    $('aiDescOutput').textContent = 'Erreur: ' + err.message;
  }
});

$('aiDescClose').addEventListener('click', () => closeModal('aiDescModal'));
$('aiDescClose2').addEventListener('click', () => closeModal('aiDescModal'));
$('aiDescUse').addEventListener('click', () => { $('fDescription').value = generatedDescription; closeModal('aiDescModal'); });

// ── AI Report ─────────────────────────────────────
async function generateReport(id) {
  $('reportOutput').textContent = 'Génération du rapport en cours...';
  $('reportModal').classList.add('open');
  closeModal('detailModal');
  try {
    const res = await apiFetch('/api/ai/generate-report', { method: 'POST', body: { eventId: id } });
    $('reportOutput').textContent = res.report;
  } catch (err) {
    $('reportOutput').textContent = 'Erreur: ' + err.message;
  }
}

$('reportClose').addEventListener('click', () => closeModal('reportModal'));
$('reportClose2').addEventListener('click', () => closeModal('reportModal'));
$('reportCopy').addEventListener('click', () => {
  navigator.clipboard.writeText($('reportOutput').textContent).then(() => showToast('Rapport copié'));
});

// ── AI Tools Panel ────────────────────────────────
$('toolGenerateDesc').addEventListener('click', () => {
  setView('events');
  setTimeout(() => openCreate(), 100);
  showToast('Créez un événement puis cliquez sur "Générer avec IA"', 'info');
});

$('toolGenerateReport').addEventListener('click', async () => {
  const finished = allEvents.filter(e => e.status === 'terminé');
  if (!finished.length) { showToast('Aucun événement terminé pour générer un bilan', 'error'); return; }
  $('aiOutputTitle').textContent = 'Choisissez un événement';
  $('aiOutput').innerHTML = finished.map(e =>
    `<button class="tool-btn" style="margin-bottom:6px" onclick="generateReport('${e.id}')">
      <span class="tool-icon">📄</span><div><div class="tool-name">${e.title}</div><div class="tool-desc">${fmt(e.date)}</div></div>
    </button>`).join('');
  $('aiOutputCard').style.display = 'block';
});

$('toolSuggestIdeas').addEventListener('click', async () => {
  $('aiOutputTitle').textContent = 'Idées d\'événements IA';
  $('aiOutput').textContent = 'Génération en cours...';
  $('aiOutputCard').style.display = 'block';
  try {
    const res = await apiFetch('/api/ai/suggest', {
      method: 'POST',
      body: { prompt: "Propose 5 idées d'événements innovants de valorisation de la recherche adaptés à une université pluridisciplinaire comme Paris 8, en précisant le format, les thématiques, le public cible et des pistes de financement possibles." }
    });
    $('aiOutput').textContent = res.suggestion;
  } catch (err) { $('aiOutput').textContent = 'Erreur: ' + err.message; }
});

$('copyOutput').addEventListener('click', () => {
  navigator.clipboard.writeText($('aiOutput').textContent).then(() => showToast('Copié'));
});

// ── Chat ──────────────────────────────────────────
function addChatMessage(role, content, loading = false) {
  const el = document.createElement('div');
  el.className = `chat-message ${role}`;
  const avatarContent = role === 'user' ? 'Vous' : '⚡';
  el.innerHTML = `<div class="chat-avatar">${avatarContent}</div>
    <div class="chat-bubble${loading ? ' loading' : ''}">${loading ? '<div class="dot"></div><div class="dot"></div><div class="dot"></div>' : content}</div>`;
  $('chatMessages').appendChild(el);
  $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  return el;
}

async function sendChat(msg) {
  if (!msg.trim()) return;
  chatHistory.push({ role: 'user', content: msg });
  addChatMessage('user', msg);
  $('chatInput').value = '';
  const loader = addChatMessage('assistant', '', true);
  try {
    const stats = await apiFetch('/api/stats').catch(() => null);
    const res = await apiFetch('/api/ai/chat', {
      method: 'POST',
      body: { messages: chatHistory, context: stats }
    });
    loader.remove();
    chatHistory.push({ role: 'assistant', content: res.reply });
    addChatMessage('assistant', res.reply.replace(/\n/g, '<br>'));
  } catch (err) {
    loader.remove();
    addChatMessage('assistant', `Erreur : ${err.message}. Vérifiez que votre clé API OpenAI est configurée dans le fichier .env.`);
  }
}

$('chatSend').addEventListener('click', () => sendChat($('chatInput').value));
$('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat($('chatInput').value); } });
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => sendChat(btn.dataset.msg));
});

// ── Init ──────────────────────────────────────────
async function init() {
  try {
    allEvents = await apiFetch('/api/events');
  } catch (e) { /* handled per view */ }
  loadDashboard();
}
init();
