import { fmt, fmtNum, fmtEur, typeBadgeCls, statusBadgeCls } from '../utils.js';

export function renderDashboard(events, onEventClick) {
  renderStats(events);
  renderUpcoming(events, onEventClick);
  renderTypeChart(events);
  renderDomainTags(events);
}

function renderStats(events) {
  const now = new Date();
  const total        = events.length;
  const upcoming     = events.filter(e => new Date(e.date) > now && e.status !== 'annulé').length;
  const done         = events.filter(e => e.status === 'terminé').length;
  const ongoing      = events.filter(e => e.status === 'en cours').length;
  const participants = events.reduce((s, e) => s + (Number(e.participants) || 0), 0);
  const budget       = events.reduce((s, e) => s + (Number(e.budget) || 0), 0);

  document.getElementById('statsRow').innerHTML = [
    statCard('bi-calendar3',          total,              'Événements',     'bg-white'),
    statCard('bi-arrow-up-right',     upcoming,           'À venir',        'border-primary'),
    statCard('bi-hourglass-split',    ongoing,            'En cours',       'border-warning'),
    statCard('bi-check-circle',       done,               'Terminés',       'border-success'),
    statCard('bi-people',             fmtNum(participants),'Participants',   'border-info'),
    statCard('bi-cash-coin',          fmtEur(budget),     'Budget total',   'border-secondary'),
  ].map(h => `<div class="col-6 col-md-4 col-xl-2">${h}</div>`).join('');
}

function statCard(icon, value, label, borderClass) {
  return `<div class="card stat-card ${borderClass} border-2 h-100 text-center p-3">
    <i class="bi ${icon} fs-4 text-primary mb-1"></i>
    <div class="stat-value text-dark">${value}</div>
    <div class="small text-secondary mt-1">${label}</div>
  </div>`;
}

function renderUpcoming(events, onEventClick) {
  const now = new Date();
  const list = events
    .filter(e => new Date(e.date) >= now && e.status !== 'annulé')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 6);

  const el = document.getElementById('upcomingList');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-calendar-x fs-1 d-block mb-2"></i>Aucun événement à venir</div>';
    return;
  }
  el.innerHTML = list.map(e => `
    <div class="d-flex align-items-center gap-3 px-3 py-2 border-bottom event-row" data-id="${e.id}" style="cursor:pointer">
      <span class="badge ${typeBadgeCls(e.type)} text-nowrap">${e.type}</span>
      <div class="flex-grow-1 overflow-hidden">
        <div class="fw-semibold small text-truncate">${e.title}</div>
        <div class="text-muted" style="font-size:.72rem">${e.laboratory || e.organizer || ''}</div>
      </div>
      <span class="text-muted small text-nowrap">${fmt(e.date)}</span>
    </div>`).join('');

  el.querySelectorAll('.event-row').forEach(row =>
    row.addEventListener('click', () => onEventClick(row.dataset.id))
  );
}

function renderTypeChart(events) {
  const counts = events.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {});
  const max = Math.max(...Object.values(counts), 1);
  const el = document.getElementById('typeChart');
  if (!Object.keys(counts).length) { el.innerHTML = '<div class="text-muted small">Aucune donnée</div>'; return; }
  el.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `
      <div class="type-row">
        <div class="type-label">${type}</div>
        <div class="flex-grow-1">
          <div class="progress" style="height:8px">
            <div class="progress-bar" style="width:${Math.round(count / max * 100)}%"></div>
          </div>
        </div>
        <div class="small fw-semibold" style="min-width:18px">${count}</div>
      </div>`).join('');
}

function renderDomainTags(events) {
  const counts = events.reduce((acc, e) => {
    (e.domains || []).forEach(d => { acc[d] = (acc[d] || 0) + 1; });
    return acc;
  }, {});
  const el = document.getElementById('domainTags');
  if (!Object.keys(counts).length) { el.innerHTML = '<div class="text-muted small">Aucun domaine renseigné</div>'; return; }
  el.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]).slice(0, 16)
    .map(([d, c]) => `<span class="badge bg-primary-subtle text-primary me-1 mb-1">${d} <span class="badge bg-primary ms-1">${c}</span></span>`)
    .join('');
}
