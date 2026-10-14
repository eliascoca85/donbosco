// Atribución obligatoria para fotos con licencia Creative Commons.
export function PhotoCredit({ credito, className = '' }) {
  if (!credito) return null
  return (
    <small className={`photo-credit ${className}`.trim()}>
      Foto:{' '}
      <a href={credito.fuente} target="_blank" rel="noreferrer">
        {credito.autor}
      </a>{' '}
      ·{' '}
      <a href={credito.licenciaUrl} target="_blank" rel="noreferrer">
        {credito.licencia}
      </a>
    </small>
  )
}
