import { Link } from '../components/Link'

const PILLARS = [
  {
    icon: 'M12 2l2.4 7.4H22l-6 4.4 2.3 7.4L12 17l-6.3 4.2L8 13.8 2 9.4h7.6z',
    title: 'Mision',
    text: 'Formar buenas cristianas y honestos ciudadanos mediante un proyecto educativo evangelizador que integra fe, razon y tecnologia, al estilo del Sistema Preventivo de Don Bosco.',
  },
  {
    icon: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z',
    title: 'Vision',
    text: 'Ser una comunidad educativa salesiana referente en Bolivia por la calidad humana, academica y tecnica de sus estudiantes, con corazon abierto a los jovenes mas necesitados.',
  },
  {
    icon: 'M3 21h18M5 21V8l7-4 7 4v13M9 9h6M9 13h6M9 17h6',
    title: 'Sistema Preventivo',
    text: 'Razon, Religion y Amoridad: acompanamos a cada estudiante desde la confianza y el dialogo, previniendo el error antes que reprimiendolo.',
  },
]

const ORG = [
  { area: 'Direccion', who: 'Rector / Director', desc: 'Conduccion pedagogica y pastoral del establecimiento.' },
  { area: 'Inspectoria', who: 'Inspector general', desc: 'Convivencia, disciplina y acompanamiento de cursos.' },
  { area: 'Coordinacion academica', who: 'Coordinadores de nivel', desc: 'Plan de estudios, evaluacion y desarrollo curricular.' },
  { area: 'Pastoral juvenil', who: 'Animador salesiano', desc: 'Catequesis, oratorios y experiencias de fe.' },
  { area: 'Secretaria academica', who: 'Secretaria', desc: 'Matriculas, records, certificados y tramites.' },
  { area: 'Asociacion de padres', who: 'Junta escolar', desc: 'Vinculo entre familias y la institucion educativa.' },
]

const HISTORY = [
  { year: '1859', text: 'San Juan Bosco funda la Congregacion Salesiana en Torino, Italia, con mision hacia la juventud obrera.' },
  { year: 'S. XIX', text: 'Los salesianos llegan a America Latina y expanden su obra educativa por el continente.' },
  { year: 'Bolivia', text: 'Se instalan en Bolivia abriendo colegios, talleres y parroquias al servicio de la juventud.' },
  { year: 'Hoy', text: 'La U.E. Don Bosco continua el carisma salesiano: formacion integral, tecnica y humana para todos.' },
]

export function HomePage() {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-eyebrow">Unidad Educativa · Don Bosco</span>
            <h1 className="hero-title">
              Formando <span className="grad">buenos cristianos</span> y honestos ciudadanos
            </h1>
            <p className="hero-sub">
              Una institucion salesiana que educa el corazon, la mente y las manos
              al estilo de Don Bosco, acompanando a cada estudiante en su proyecto
              de vida con razon, religion y amoridad.
            </p>
            <div className="hero-cta">
              <Link to="/servicios" className="btn primary lg">
                Ver servicios
              </Link>
              <a href="#/#contacto" className="btn lg">
                Contactanos
              </a>
            </div>
            <div className="hero-stats">
              <div>
                <strong>+</strong>
                <span>1 siglo de tradicion</span>
              </div>
              <div>
                <strong>3</strong>
                <span>niveles educativos</span>
              </div>
              <div>
                <strong>SDB</strong>
                <span>espiritualidad salesiana</span>
              </div>
            </div>
          </div>
          <div className="hero-card hero-card-institutional">
            <div className="hero-card-head">
              <span className="crest-lg">DB</span>
              <span className="mono">U.E. Don Bosco</span>
            </div>
            <div className="hero-card-body hero-card-body-quote">
              <p className="quote">
                &laquo;Da me las almas, Quedate con lo demas.&raquo;
              </p>
              <span className="quote-author">— San Juan Bosco</span>
            </div>
            <div className="hero-card-foot">
              <div className="mini-tl">
                <span className="dot created" /> Educacion integral
              </div>
              <div className="mini-tl">
                <span className="dot pre" /> Espiritualidad salesiana
              </div>
              <div className="mini-tl">
                <span className="dot ok" /> Servicio a los jovenes
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="mision" className="features">
        <div className="section-head">
          <h2>Mision, Vision y Carisma</h2>
          <p>Los pilares que orientan nuestra labor educativa al estilo de Don Bosco.</p>
        </div>
        <div className="features-grid">
          {PILLARS.map((p) => (
            <article key={p.title} className="feature-card">
              <span className="feature-ico">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <path d={p.icon} />
                </svg>
              </span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="historia" className="steps">
        <div className="section-head">
          <h2>Nuestra Historia</h2>
          <p>Un recorrido por el legado salesiano que hoy continua en nuestra unidad educativa.</p>
        </div>
        <div className="timeline-h">
          {HISTORY.map((h) => (
            <div key={h.year} className="tl-h-item">
              <span className="tl-h-year">{h.year}</span>
              <span className="tl-h-dot" />
              <p className="tl-h-text">{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="organizacion" className="features">
        <div className="section-head">
          <h2>Organizacion</h2>
          <p>Las areas que sostienen la vida academica y pastoral de la institucion.</p>
        </div>
        <div className="org-grid">
          {ORG.map((o) => (
            <article key={o.area} className="org-card">
              <span className="org-area">{o.area}</span>
              <h3>{o.who}</h3>
              <p>{o.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="contacto" className="contact">
        <div className="contact-card">
          <div>
            <h2>Contacto</h2>
            <p>
              Av. Don Bosco s/n · La Paz, Bolivia
              <br />
              Tel.: +591 (2) 222-3344 · administracion@donbosco.edu
              <br />
              Horario de atencion: Lunes a Viernes, 07:30 — 16:30
            </p>
          </div>
          <div className="contact-cta">
            <Link to="/servicios" className="btn">
              Servicios
            </Link>
            <Link to="/login" className="btn primary">
              Acceso a personal
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div>
          <span className="crest">DB</span> U.E. Don Bosco &middot; {new Date().getFullYear()}
        </div>
        <div className="footer-links">
          <Link to="/">Inicio</Link>
          <Link to="/servicios">Servicios</Link>
          <a href="#/#contacto">Contacto</a>
        </div>
      </footer>
    </div>
  )
}
