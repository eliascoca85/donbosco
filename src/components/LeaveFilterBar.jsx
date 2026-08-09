import { Constants } from '../api/leaveRequests'

export function LeaveFilterBar({ filters, onChange, totalCount, visibleCount }) {
  const set = (patch) => onChange({ ...filters, ...patch })

  return (
    <div className="toolbar">
      <div className="field">
        <label>Estado</label>
        <select
          value={filters.status}
          onChange={(e) => set({ status: e.target.value })}
        >
          <option value="all">Todos</option>
          {Constants.STATUS.map((s) => (
            <option key={s} value={s}>
              {labelFor(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Tipo</label>
        <select
          value={filters.request_type}
          onChange={(e) => set({ request_type: e.target.value })}
        >
          <option value="all">Todos</option>
          {Object.entries(Constants.TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Curso / Area</label>
        <select
          value={filters.course}
          onChange={(e) => set({ course: e.target.value })}
        >
          <option value="all">Todos</option>
          {Constants.COURSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Desde</label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Hasta</label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => set({ to: e.target.value })}
        />
      </div>

      <div className="spacer" />

      <div className="search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          placeholder="Buscar por codigo, nombre..."
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
        />
      </div>

      <button
        className="btn ghost"
        onClick={() =>
          onChange({ status: 'all', request_type: 'all', course: 'all', from: '', to: '', q: '' })
        }
        title="Limpiar filtros"
      >
        Limpiar
      </button>

      <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
        {visibleCount} de {totalCount} solicitudes
      </span>
    </div>
  )
}

function labelFor(s) {
  return {
    pending: 'Pendiente',
    pre_approved: 'Pre-aprobado',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    info_required: 'Requiere info',
    cancelled: 'Cancelada',
  }[s] || s
}
