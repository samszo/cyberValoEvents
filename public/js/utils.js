// Helpers partagés entre modules

export const fmt    = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtNum = n => Number(n || 0).toLocaleString('fr-FR');
export const fmtEur = n => Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const TYPE_CLASSES = {
  'colloque':       'badge-colloque',
  'conférence':     'badge-conference',
  'séminaire':      'badge-seminaire',
  'workshop':       'badge-workshop',
  "journée d'étude":'badge-journee',
  'exposition':     'badge-exposition',
};
export const typeBadgeCls   = t => TYPE_CLASSES[t] || 'badge-autre';
export const statusBadgeCls = s => `badge-${s.replace(' ', '-')}`;

export function showToast(msg, type = 'success') {
  const icons = { success: 'check-circle-fill', error: 'x-circle-fill', info: 'info-circle-fill' };
  const colors = { success: 'text-success', error: 'text-danger', info: 'text-primary' };
  const id = `toast-${Date.now()}`;
  const html = `
    <div id="${id}" class="toast align-items-center border-0 shadow" role="alert">
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi bi-${icons[type] || icons.info} ${colors[type] || colors.info}"></i>${msg}
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`;
  document.getElementById('toastContainer').insertAdjacentHTML('beforeend', html);
  const el = document.getElementById(id);
  new bootstrap.Toast(el, { delay: 3500 }).show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

export function generateId() {
  return 'evt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
