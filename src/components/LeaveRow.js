import { Constants, formatDay, relativeTime } from '../api/leaveRequests'
import { StatusBadge } from './StatusBadge'

export function LeaveRow({ req, active, onClick }) {
  const sameDay = formatDay(req.start_date) === formatDay(req.end_date)
  return (
    <button
      type="button"
      className={'row' + (active ? ' is-active' : '')}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="row-main">
        <span className="row-title">{req.student_name}</span>
        <span className="row-meta">
          {req.course} · {Constants.TYPE_LABEL[req.request_type] || req.request_type}
        </span>
        <span className="row-meta">
          {sameDay ? formatDay(req.start_date) : `${formatDay(req.start_date)} – ${formatDay(req.end_date)}`}
          {' · '}
          {req.applicant?.name}
        </span>
      </span>
      <span className="row-side">
        <StatusBadge status={req.status} />
        <span className="row-time">{relativeTime(req.created_at)}</span>
      </span>
    </button>
  )
}
