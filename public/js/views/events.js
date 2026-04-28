import { fmt, fmtNum, fmtEur, typeBadgeCls, statusBadgeCls } from '../utils.js';

export function renderEvents(events, { onDetail, onEdit, onDelete }) {
  const container = document.getElementById('eventsList');
  if (!events.length) {
    container.innerHTML = `<div class="col-12"><div class="empty-state">
      <i class="bi bi-search fs-1 d-block mb-2"></i>Aucun événement trouvé</div></div>`;
    return;
  }
  container.innerHTML = events.map(e => eventCard(e)).join('');

  container.querySelectorAll('.event-card').forEach(card => {
    card.addEventListener('click', () => onDetail(card.dataset.id));
  });
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); onEdit(btn.dataset.id); });
  });
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); onDelete(btn.dataset.id); });
  });
}

function eventCard(e) {
  const multiDay = e.endDate && e.endDate !== e.date;
  return `
  <div class="col-sm-6 col-xl-4">
    <div class="card event-card h-100" data-id="${e.id}">
      <div class="card-header d-flex align-items-start gap-2 border-bottom">
        <span class="badge ${typeBadgeCls(e.type)} mt-1 text-nowrap">${e.type}</span>
        <span class="fw-semibold small flex-grow-1">${e.title}</span>
      </div>
      <div class="card-body small">
        <div class="d-flex flex-column gap-1 text-muted mb-2">
          <div><i class="bi bi-calendar-date me-1"></i>${fmt(e.date)}${multiDay ? ' → ' + fmt(e.endDate) : ''}</div>
          ${e.location  ? `<div><i class="bi bi-geo-alt me-1"></i>${e.location}</div>` : ''}
          ${e.organizer ? `<div><i class="bi bi-person me-1"></i>${e.organizer}</div>` : ''}
          ${e.laboratory? `<div><i class="bi bi-flask me-1"></i>${e.laboratory}</div>` : ''}
        </div>
        <div class="d-flex flex-wrap gap-1">
          ${(e.domains || []).slice(0, 3).map(d =>
            `<span class="badge bg-primary-subtle text-primary">${d}</span>`
          ).join('')}
        </div>
      </div>
      <div class="card-footer d-flex align-items-center justify-content-between">
        <span class="badge ${statusBadgeCls(e.status)}">${e.status}</span>
        <div class="d-flex align-items-center gap-3 text-muted small">
          <span><i class="bi bi-people me-1"></i>${fmtNum(e.participants)}</span>
          <span><i class="bi bi-cash me-1"></i>${fmtEur(e.budget)}</span>
          <button class="btn btn-sm btn-link p-0 text-secondary btn-edit" data-id="${e.id}" title="Modifier">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-link p-0 text-danger btn-delete" data-id="${e.id}" title="Supprimer">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>
  </div>`;
}
