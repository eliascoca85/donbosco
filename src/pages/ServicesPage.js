import { Link } from '../components/Link'
import { useAuth } from '../components/router'
import { PageBanner } from '../components/ui'

// Es una secuencia real: cada paso depende del anterior.
const STEPS = [
  {
    who: 'Dirección o Inspectoría',
    title: 'Registra a la familia',
    text: 'Crea la cuenta del padre, madre o tutor con su CI y le entrega usuario y contraseña.',
  },
  {
    who: 'Docente del curso',
    title: 'Vincula al estudiante',
    text: 'Registra a cada estudiante de su aula y lo vincula con su padre, madre o tutor.',
  },
  {
    who: 'Padre de familia',
    title: 'Solicita el permiso',
    text: 'Indica las fechas, el motivo y adjunta un respaldo (certificado médico, comprobante) si lo tiene.',
  },
  {
    who: 'Dirección o Inspectoría',
    title: 'Revisa y responde',
    text: 'Aprueba, rechaza con un motivo o pide una corrección. Si se aprueba, las faltas quedan justificadas.',
  },
]

const TYPES = [
  { title: 'Salud', text: 'Consultas, tratamientos o reposo. Adjunta el certificado médico.' },
  { title: 'Calamidad doméstica', text: 'Fallecimiento o emergencia grave en la familia.' },
  { title: 'Personal', text: 'Trámites o compromisos familiares que no pueden postergarse.' },
  { title: 'Actividad institucional', text: 'Representación del colegio en eventos deportivos, culturales o pastorales.' },
]

export function ServicesPage() {
  const { user } = useAuth()
  const isParent = user?.role === 'parent'

  return (
    <>
      <PageBanner
        eyebrow="Permisos escolares"
        title="Cómo se pide un permiso de inasistencia"
        actions={
          isParent ? (
            <Link to="/permisos" className="btn btn-accent btn-lg">
              Solicitar permiso
            </Link>
          ) : !user ? (
            <Link to="/login" className="btn btn-accent btn-lg">
              Ingresar
            </Link>
          ) : null
        }
      >
        Solo los padres, madres o tutores registrados por el colegio pueden solicitar permisos para sus hijos.
      </PageBanner>

      <div className="container page">
        <section className="section-plain" aria-labelledby="pasos">
          <h2 id="pasos">El recorrido de una solicitud</h2>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="step">
                <span className="step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="step-who">{s.who}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="services-split">
          <section className="card" aria-labelledby="tipos">
            <h2 id="tipos">Tipos de permiso</h2>
            <dl className="type-list">
              {TYPES.map((t) => (
                <div key={t.title}>
                  <dt>{t.title}</dt>
                  <dd>{t.text}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card card-accent" aria-labelledby="estados">
            <h2 id="estados">Qué significa cada estado</h2>
            <ul className="state-list">
              <li>
                <span className="badge" data-status="pending">
                  <span className="pip" />
                  Pendiente
                </span>
                El colegio todavía no revisó la solicitud.
              </li>
              <li>
                <span className="badge" data-status="info_required">
                  <span className="pip" />
                  Corrección solicitada
                </span>
                Lee el comentario, corrige y reenvía desde «Mis solicitudes».
              </li>
              <li>
                <span className="badge" data-status="approved">
                  <span className="pip" />
                  Aprobado
                </span>
                Las faltas de esos días quedan justificadas.
              </li>
              <li>
                <span className="badge" data-status="rejected">
                  <span className="pip" />
                  Rechazado
                </span>
                El colegio explica el motivo. Las faltas no se justifican.
              </li>
            </ul>
            <p className="muted">
              Pide el permiso con anticipación siempre que sea posible. En emergencias, envíalo a más tardar el día
              en que tu hijo se reincorpora.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
