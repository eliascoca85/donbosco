import { useEffect, useId, useRef } from 'react'

// Escudo institucional: partido en azul y amarillo con el monograma DB.
export function Crest({ size = 40, className = '' }) {
  return (
    <svg
      className={'crest ' + className}
      width={size}
      height={size * 1.15}
      viewBox="0 0 40 46"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 1.5 37.5 7v15.5C37.5 34 29.5 41.5 20 44.5 10.5 41.5 2.5 34 2.5 22.5V7z" fill="var(--azul-900)" />
      <path d="M20 4.5 34.5 9.2v13.3c0 9.6-6.6 16.1-14.5 18.9z" fill="var(--amarillo)" />
      <path d="M20 4.5 5.5 9.2v13.3c0 9.6 6.6 16.1 14.5 18.9z" fill="var(--azul-700)" />
      <text
        x="20"
        y="28"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="700"
        fontSize="15"
        fill="#fff"
        stroke="var(--azul-900)"
        strokeWidth="0.6"
        paintOrder="stroke"
      >
        DB
      </text>
    </svg>
  )
}

// Sello redondo del colegio, como el que se estampa en las papeletas.
export function Seal({ size = 120, className = '' }) {
  const ring = 'seal-' + useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg
      className={'seal ' + className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <path id={ring} d="M60 60m-41 0a41 41 0 1 1 82 0a41 41 0 1 1 -82 0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="60" cy="60" r="31" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <text fontFamily="var(--font-mono)" fontWeight="700" fontSize="9.4" letterSpacing="1.6" fill="currentColor">
        <textPath href={`#${ring}`} startOffset="0">
          U.E. DON BOSCO ★ COLCAPIRHUA ★ COCHABAMBA ★
        </textPath>
      </text>
      <text
        x="60"
        y="67"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="800"
        fontSize="22"
        fill="currentColor"
      >
        DB
      </text>
    </svg>
  )
}

export function Field({ label, required, optional, hint, error, className = '', children }) {
  return (
    <label className={'field ' + className}>
      <span className="field-label">
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
        {optional && <span className="opt"> (opcional)</span>}
      </span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

export function Alert({ tone = 'info', children }) {
  if (!children) return null
  return (
    <div className="alert" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

export function PageBanner({ eyebrow, title, children, actions }) {
  return (
    <section className="banner">
      <div className="banner-inner container">
        <div>
          {eyebrow && <span className="pennant">{eyebrow}</span>}
          <h1>{title}</h1>
          {children && <p>{children}</p>}
        </div>
        {actions && <div className="banner-actions">{actions}</div>}
      </div>
    </section>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <Crest size={34} className="empty-crest" />
      <p className="empty-title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className="toast" data-tone={toast.tone}>
        {toast.message}
      </div>
    </div>
  )
}

// Dialogo accesible: cierra con Escape y devuelve el foco al cerrar.
export function Modal({ title, onClose, children, footer, wide = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const first = ref.current?.querySelector('textarea, input, select, button:not(.icon-btn)')
    first?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={ref}
        className={'modal' + (wide ? ' wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
