import { Constants, STATUS_LABEL } from '../api/leaveRequests'

export const EMPTY_FILTERS = {
  status: 'all',
  request_type: 'all',
  course: 'all',
  from: '',
  to: '',
  q: '',
}

export function LeaveFilterBar({ filters, onChange, courses = [], totalCount, visibleCount }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value })
  const dirty = Object.keys(EMPTY_FILTERS).some((k) => filters[k] !== EMPTY_FILTERS[k])

  return (
    <div className="filters" role="search">
      <label className="filter filter-search">
        <span className="filter-label">Buscar</span>
        <input
          type="search"
          placeholder="Estudiante, solicitante o código"
          value={filters.q}
          onChange={set('q')}
        />
      </label>

      <label className="filter">
        <span className="filter-label">Estado</span>
        <select value={filters.status} onChange={set('status')}>
          <option value="all">Todos</option>
          {Constants.STATUS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="filter">
        <span className="filter-label">Tipo</span>
        <select value={filters.request_type} onChange={set('request_type')}>
          <option value="all">Todos</option>
          {Object.entries(Constants.TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="filter">
        <span className="filter-label">Curso</span>
        <select value={filters.course} onChange={set('course')}>
          <option value="all">Todos</option>
          {courses.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="filter">
        <span className="filter-label">Desde</span>
        <input type="date" value={filters.from} onChange={set('from')} />
      </label>

      <label className="filter">
        <span className="filter-label">Hasta</span>
        <input type="date" value={filters.to} onChange={set('to')} />
      </label>

      <div className="filter-meta">
        <span>
          {visibleCount} de {totalCount}
        </span>
        {dirty && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(EMPTY_FILTERS)}>
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}
