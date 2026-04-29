import { typeBadgeCls, statusBadgeCls, fmt } from '../utils.js';

const DAYS   = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

let year, month;

export function initCalendar() {
  const now = new Date();
  year  = now.getFullYear();
  month = now.getMonth();
}

export function renderCalendar(events, onEventClick) {
  document.getElementById('calTitle').textContent = `${MONTHS[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  // Build grid HTML
  let html = `<div class="cal-grid mb-3">`;
  // Day headers
  html += DAYS.map(d => `<div class="cal-header-cell">${d}</div>`).join('');

  // Padding cells (previous month)
  for (let i = 0; i < startDow; i++) {
    const d = new Date(firstDay);
    d.setDate(d.getDate() - (startDow - i));
    html += calDayHtml(d, events, true);
  }
  // Current month cells
  for (let d = 1; d <= lastDay.getDate(); d++) {
    html += calDayHtml(new Date(year, month, d), events, false);
  }
  html += `</div>`;

  // Month event list
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthEvents = events
    .filter(e => e.date.startsWith(monthStr))
    .sort((a, b) => a.date.localeCompare(b.date));

  html += monthEvents.length
    ? `<div class="list-group list-group-flush">${monthEvents.map(e => `
        <div class="list-group-item list-group-item-action d-flex align-items-center gap-2 cal-event-entry" data-id="${e.id}">
          <span class="badge ${typeBadgeCls(e.type)}">${e.type}</span>
          <div class="flex-grow-1">
            <div class="small fw-semibold">${e.title}</div>
            <div class="text-muted" style="font-size:.72rem">${fmt(e.date)}${e.endDate && e.endDate !== e.date ? ' → ' + fmt(e.endDate) : ''}</div>
          </div>
          <span class="badge ${statusBadgeCls(e.status)}">${e.status}</span>
        </div>`).join('')}</div>`
    : `<div class="text-muted small text-center py-3">Aucun événement ce mois-ci</div>`;

  const el = document.getElementById('calGrid');
  el.innerHTML = html;
  document.getElementById('calEventList').innerHTML = '';

  el.querySelectorAll('.cal-event-entry').forEach(row =>
    row.addEventListener('click', () => onEventClick(row.dataset.id))
  );
  document.querySelectorAll('.cal-event-entry').forEach(row =>
    row.addEventListener('click', () => onEventClick(row.dataset.id))
  );
}

function calDayHtml(date, events, otherMonth) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const dateStr  = date.toISOString().slice(0, 10);
  const isToday  = dateStr === todayStr;
  const dayEvents = events.filter(e => e.date === dateStr || (e.date <= dateStr && (e.endDate || e.date) >= dateStr));

  return `<div class="cal-day${otherMonth ? ' other-month' : ''}${isToday ? ' today' : ''}">
    <div class="cal-day-num">${date.getDate()}</div>
    ${dayEvents.slice(0, 2).map(e => `<div class="cal-evt-dot" title="${e.title}">${e.title}</div>`).join('')}
    ${dayEvents.length > 2 ? `<div class="cal-evt-dot text-muted">+${dayEvents.length - 2}</div>` : ''}
  </div>`;
}

export function calPrev(events, onEventClick) {
  month--; if (month < 0) { month = 11; year--; }
  renderCalendar(events, onEventClick);
}

export function calNext(events, onEventClick) {
  month++; if (month > 11) { month = 0; year++; }
  renderCalendar(events, onEventClick);
}
