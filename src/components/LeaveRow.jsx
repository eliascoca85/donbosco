import { formatDay, relativeTime, Constants } from '../api/leaveRequests'
import { StatusBadge } from './StatusBadge'

export function LeaveRow({ req, active, onClick }) {
  return (
    <div
      className={'list-item' + (active ? ' active' : '')}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="avatar" title={req.applicant.name}>
        {req.initials}
      </div>
      <div className="main">
        <div className="row1">
          <span>{req.applicant.name}</span>
          <span className="code">{req.tracking_code}</span>
        </div>
        <div className="meta">
          <span className="type-pill">
            {Constants.TYPE_LABEL[req.request_type] || req.request_type}
          </span>
          <span>{req.course}</span>
          <span>·</span>
          <span>{formatDay(req.start_date)} – {formatDay(req.end_date)}</span>
        </div>
      </div>
      <div className="right">
        <StatusBadge status={req.status} />
        <div className="when">{relativeTime(req.created_at)}</div>
      </div>
    </div>
  )
}
