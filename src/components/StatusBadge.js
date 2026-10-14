import { STATUS_LABEL } from '../api/leaveRequests'

export function StatusBadge({ status }) {
  return (
    <span className="badge" data-status={status === 'pre_approved' ? 'pending' : status}>
      <span className="pip" aria-hidden="true" />
      {STATUS_LABEL[status] || status}
    </span>
  )
}
