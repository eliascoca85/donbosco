import { Link } from '../components/Link'

const FEATURES = [
  {
    icon: 'M12 2v20M2 12h20',
    title: 'Gestion de licencias',
    text: 'Solicita y acompana permisos escolares en linea, con seguimiento por codigo y estado en tiempo real.',
  },
  {
    icon: 'M9 12l2 2 4-4',
    title: 'Flujo de aprobaciones',
    text: 'Pre-dictamen de tutores y decision final de direccion, con trazabilidad de cada actor y fecha.',
  },
  {
    icon: 'M12 2l3 6 6 1-4 4 1 7-6-3-6 3 1-7-4-4 6-1z',
    title: 'Evidencia y auditoria',
    text: 'Adjunta certificados y comprobantes; todo queda registrado en un historial auditable.',
  },
]

const STEPS = [
  { n: 1, title: 'Completa el formulario', text: 'Indica el tipo de permiso, fechas y motivo.' },
  { n: 2, title: 'Adjunta evidencia', text: 'Sube certificados o respaldos (PDF / imagen).' },
  { n: 3, title: 'Recibe tu codigo', text: 'Obten un codigo de seguimiento unico (LIC-...).' },
  { n: 4, title: 'Acompana el estado', text: 'Consulta el avance hasta la decision final.' },
]

export function LandingPage() {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-eyebrow">Unidad Educativa · Mariscal Santa Cruz</span>
            <h1 className="hero-title">
              Sistema de <span className="grad">permisos y licencias</span> escolares
            </h1>
            <p className="hero-sub">
              Solicita, gestiona y aprueba permisos de inasistencia de forma
              rapida, trazable y con respaldo documental para estudiantes,
              padres, docentes y direccion.
            </p>
            <div className="hero-cta">
              <Link to="/permisos" className="btn primary lg">
                Solicitar un permiso
              </Link>
              <Link to="/login" className="btn lg">
                Iniciar sesion
              </Link>
            </div>
            <div className="hero-stats">
              <div>
                <strong>4</strong>
                <span>tipos de permiso</span>
              </div>
              <div>
                <strong>24/7</strong>
                <span>disponibilidad</span>
              </div>
              <div>
                <strong>100%</strong>
                <span>trazable</span>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-card-head">
              <span className="badge" data-status="approved">
                <span className="pip" /> Aprobada
              </span>
              <span className="mono">LIC-2026-0007</span>
            </div>
            <div className="hero-card-body">
              <KV k="Solicitante" v="M. Quispe Mamani" />
              <KV k="Tipo" v="Medica" />
              <KV k="Periodo" v="03 mar — 05 mar" />
              <KV k="Horas" v="~24 h" />
            </div>
            <div className="hero-card-foot">
              <div className="mini-tl">
                <span className="dot created" /> Solicitud creada
              </div>
              <div className="mini-tl">
                <span className="dot pre" /> Pre-dictamen favorable
              </div>
              <div className="mini-tl">
                <span className="dot ok" /> Licencia aprobada
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="servicios" className="features">
        <div className="section-head">
          <h2>Servicios destacados</h2>
          <p>Una plataforma disenada para toda la comunidad educativa.</p>
        </div>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature-card">
              <span className="feature-ico">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={f.icon} />
                </svg>
              </span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="steps">
        <div className="section-head">
          <h2>Como funciona</h2>
          <p>En cuatro pasos tu solicitud queda registrada y lista para revision.</p>
        </div>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div key={s.n} className="step-card">
              <span className="step-num">{s.n}</span>
              <h4>{s.title}</h4>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/permisos" className="btn primary lg">
            Comenzar solicitud
          </Link>
        </div>
      </section>

      <section id="contacto" className="contact">
        <div className="contact-card">
          <div>
            <h2>Conecta con nosotros</h2>
            <p>
              Av. Educacion 1234 · La Paz, Bolivia
              <br />
              Tel.: +591 (2) 222-3344 · administracion@colegio.edu
            </p>
          </div>
          <div className="contact-cta">
            <Link to="/login" className="btn primary">
              Acceso a personal
            </Link>
            <Link to="/permisos" className="btn">
              Solicitar permiso
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div>
          <span className="crest">U</span> U.E. Mariscal Santa Cruz — {new Date().getFullYear()}
        </div>
        <div className="footer-links">
          <a href="#/">Inicio</a>
          <a href="#/#servicios">Servicios</a>
          <a href="#/#contacto">Contacto</a>
        </div>
      </footer>
    </div>
  )
}

function KV({ k, v }) {
  return (
    <div className="hero-kv">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  )
}
