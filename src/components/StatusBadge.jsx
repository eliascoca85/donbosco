export function StatusBadge({ status }) {
  const label = {
    pending: 'Pendiente',
    pre_approved: 'Pre-aprobado',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    info_required: 'Requiere info',
    cancelled: 'Cancelada',
  }[status] || status
  return (
    <span className="badge" data-status={status}>
      <span className="pip" />
      {label}
    </span>
  )
}
