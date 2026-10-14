import { useEffect } from 'react'
import { Link } from '../components/Link'
import { Seal } from '../components/ui'
import { useAuth, useRouter } from '../components/router'
import { COLEGIO, IMAGENES } from '../colegio'
import { PhotoCredit } from '../components/PhotoCredit'

const IDENTIDAD = [
  {
    label: 'Misión',
    text: 'Formar buenos cristianos y honrados ciudadanos con un proyecto educativo evangelizador que integra fe, razón, ciencia y trabajo, al estilo de Don Bosco.',
  },
  {
    label: 'Visión',
    text: 'Ser una comunidad educativa salesiana de referencia en Bolivia por la calidad humana, académica y técnica de sus estudiantes, con el corazón abierto a los jóvenes que más lo necesitan.',
  },
]

// Los tres pilares del Sistema Preventivo de Don Bosco.
const PREVENTIVO = [
  { word: 'Razón', text: 'Normas claras que se explican y se entienden. Nada se impone sin diálogo.' },
  { word: 'Religión', text: 'La fe como horizonte de vida, celebrada en comunidad y en la parroquia.' },
  { word: 'Amabilidad', text: 'Educadores presentes en el aula y en el patio, que se hacen querer.' },
]

const HISTORY = [
  { year: '1859', text: 'San Juan Bosco funda la Congregación Salesiana en Turín, Italia, para educar a la juventud obrera.' },
  { year: '1875', text: 'Parten los primeros misioneros salesianos hacia América del Sur.' },
  { year: '1896', text: 'Los salesianos llegan a Bolivia y abren colegios, talleres y oratorios.' },
  { year: 'Hoy', text: 'En Colcapirhua, Cochabamba, la U.E. Don Bosco continúa el carisma salesiano con una formación integral, técnica y humana.' },
]

const GALLERY = [
  { img: IMAGENES.aula, title: 'En el aula', text: 'Docentes que acompañan a cada curso y conocen a sus estudiantes por su nombre.' },
  { img: IMAGENES.estudiantes, title: 'Fuera del aula', text: 'Salidas, deporte y el juego del oratorio: aprender también es encontrarse.' },
  { img: IMAGENES.parroquia, title: 'En la parroquia', text: 'Celebraciones, catequesis y la Buenas Noches salesiana, junto a la comunidad de Colcapirhua.' },
]

const ORG = [
  { area: 'Dirección', who: 'Directora', desc: 'Conduce la vida pedagógica y pastoral, y decide sobre los permisos de los estudiantes.' },
  { area: 'Inspectoría', who: 'Inspectora general', desc: 'Cuida la convivencia y la asistencia; gestiona permisos junto a Dirección.' },
  { area: 'Plantel docente', who: 'Profesores de curso', desc: 'Acompañan a cada curso, registran a sus estudiantes y los vinculan con sus familias.' },
  { area: 'Pastoral juvenil', who: 'Animador salesiano', desc: 'Catequesis, oratorio y experiencias de fe para toda la comunidad.' },
  { area: 'Secretaría académica', who: 'Secretaría', desc: 'Inscripciones, libretas, certificados y trámites.' },
  { area: 'Padres de familia', who: 'Junta escolar', desc: 'El vínculo entre las familias y la vida del colegio.' },
]

export function HomePage() {
  const { user } = useAuth()
  const { path } = useRouter()

  // Los enlaces "#/#contacto" llevan a la seccion de contacto de esta pagina.
  useEffect(() => {
    const anchor = path.split('#')[1]
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' })
  }, [path])

  return (
    <div className="landing">
      <section className="hero">
        <img
          className="hero-bg"
          src={IMAGENES.tunari.src}
          alt=""
          width={IMAGENES.tunari.width}
          height={IMAGENES.tunari.height}
          fetchPriority="high"
        />
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow on-dark">
              Obra salesiana · {COLEGIO.municipio}, {COLEGIO.departamento}
            </span>
            <h1 className="hero-title">
              Formamos <em>buenos cristianos</em> y honrados ciudadanos
            </h1>
            <p className="hero-lead">
              Educamos la mente, el corazón y las manos al estilo de Don Bosco, al pie del Tunari.
            </p>
            <div className="hero-actions">
              {user?.role === 'parent' ? (
                <Link to="/permisos" className="btn btn-accent btn-lg">
                  Solicitar un permiso
                </Link>
              ) : (
                <Link to="/servicios" className="btn btn-accent btn-lg">
                  Cómo funcionan los permisos
                </Link>
              )}
              <a href="#/#contacto" className="btn btn-on-dark btn-lg">
                Contactar al colegio
              </a>
            </div>
          </div>

          <figure className="hero-slip">
            <div className="slip" aria-hidden="true">
              <div className="slip-head">
                <span>Papeleta de permiso</span>
                <span>N.º LIC-2026-0142</span>
              </div>
              <dl className="slip-fields">
                <div>
                  <dt>Estudiante</dt>
                  <dd>Mariana Rojas Q.</dd>
                </div>
                <div>
                  <dt>Curso</dt>
                  <dd>4.º de secundaria «A»</dd>
                </div>
                <div>
                  <dt>Fechas</dt>
                  <dd>14 y 15 de octubre</dd>
                </div>
                <div>
                  <dt>Motivo</dt>
                  <dd>Control médico en la ciudad</dd>
                </div>
              </dl>
              <span className="badge badge-lg" data-status="approved">
                Aprobado
              </span>
            </div>
            <figcaption>
              Ejemplo: la papeleta que el padre de familia envía desde el celular y el sello con que responde
              Dirección.
            </figcaption>
          </figure>
        </div>
        <div className="container hero-credit">
          <span>{IMAGENES.tunari.alt}.</span> <PhotoCredit credito={IMAGENES.tunari.credito} className="on-dark" />
        </div>
      </section>

      <section className="section container" aria-labelledby="mision-title">
        <div className="identity">
          <div className="identity-text">
            <span className="eyebrow">Nuestra identidad</span>
            <h2 id="mision-title">Casa que acoge, escuela que prepara para la vida</h2>
            {IDENTIDAD.map((i) => (
              <p key={i.label}>
                <strong>{i.label}.</strong> {i.text}
              </p>
            ))}
          </div>
          <blockquote className="motto">
            <p>«Dame almas y llévate lo demás.»</p>
            <footer>Da mihi animas, cetera tolle — San Juan Bosco</footer>
          </blockquote>
        </div>

        <div className="preventivo">
          <h3 className="preventivo-title">El Sistema Preventivo descansa en tres palabras</h3>
          <ol className="preventivo-list">
            {PREVENTIVO.map((p) => (
              <li key={p.word}>
                <span className="preventivo-word">{p.word}</span>
                <p>{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-tint" aria-labelledby="vida-title">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Vida en el colegio</span>
            <h2 id="vida-title">Casa, escuela, parroquia y patio</h2>
          </div>
          <div className="gallery">
            {GALLERY.map((g) => (
              <figure key={g.title} className="photo-card">
                <img src={g.img.src} alt={g.img.alt} width={g.img.width} height={g.img.height} loading="lazy" />
                <figcaption>
                  <strong>{g.title}</strong>
                  <span>{g.text}</span>
                  <PhotoCredit credito={g.img.credito} />
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="section container" aria-labelledby="historia-title">
        <div className="section-head">
          <span className="eyebrow">Historia</span>
          <h2 id="historia-title">Un legado que llegó a Bolivia hace más de un siglo</h2>
        </div>
        <ol className="history">
          {HISTORY.map((h) => (
            <li key={h.year} className="history-item">
              <span className="history-year">{h.year}</span>
              <p>{h.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section container" aria-labelledby="org-title">
        <div className="section-head">
          <span className="eyebrow">Organización</span>
          <h2 id="org-title">Quién acompaña a tu hijo en el colegio</h2>
        </div>
        <dl className="org-grid">
          {ORG.map((o) => (
            <div key={o.area} className="org-card">
              <dt>
                <span className="org-area">{o.area}</span>
                <span className="org-who">{o.who}</span>
              </dt>
              <dd>{o.desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="contacto" className="contact" aria-labelledby="contacto-title">
        <div className="container contact-inner">
          <Seal size={150} className="contact-seal" />
          <div className="contact-text">
            <span className="eyebrow on-dark">Secretaría</span>
            <h2 id="contacto-title">Contacto</h2>
            <address>
              {COLEGIO.nombreCompleto}
              <br />
              {COLEGIO.direccion}
              {COLEGIO.telefono && (
                <>
                  <br />
                  Tel.: {COLEGIO.telefono}
                </>
              )}
              {COLEGIO.correo && (
                <>
                  <br />
                  {COLEGIO.correo}
                </>
              )}
              <br />
              Atención: {COLEGIO.horario.toLowerCase()}
            </address>
          </div>
          <div className="contact-actions">
            {user ? null : (
              <Link to="/login" className="btn btn-accent btn-lg">
                Ingresar al sistema
              </Link>
            )}
            <Link to="/servicios" className="btn btn-on-dark btn-lg">
              Permisos escolares
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
