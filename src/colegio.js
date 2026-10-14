// Datos institucionales en un solo lugar.
// Las fotos son de Wikimedia Commons (licencias libres, requieren citar autor y licencia).
// Para usar fotos propias del colegio: copia los archivos a public/img/,
// cambia aquí `src` y `alt`, y deja `credito` en null si la foto es del colegio.

const img = (file) => `${import.meta.env.BASE_URL}img/${file}`

export const COLEGIO = {
  nombre: 'Don Bosco Colcapirhua',
  nombreCompleto: 'Unidad Educativa Don Bosco Colcapirhua',
  municipio: 'Colcapirhua',
  departamento: 'Cochabamba',
  direccion: 'Colcapirhua, Cochabamba, Bolivia',
  // Completa con los datos oficiales; si quedan vacíos no se muestran.
  telefono: '',
  correo: '',
  horario: 'Lunes a viernes, de 07:30 a 16:30',
}

export const IMAGENES = {
  tunari: {
    src: img('tunari.jpg'),
    width: 1280,
    height: 999,
    alt: 'El cerro Tunari al atardecer sobre la ciudad de Cochabamba',
    credito: {
      autor: 'Rolando Claure',
      licencia: 'CC BY-SA 4.0',
      licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      fuente: 'https://commons.wikimedia.org/wiki/File:Panorama_urbano_con_el_Cerro_Tunari,_Cochabamba.jpg',
    },
  },
  plaza: {
    src: img('plaza.jpg'),
    width: 1280,
    height: 1166,
    alt: 'Plaza 15 de Abril de Colcapirhua, con su jardín y el nombre del municipio',
    credito: {
      autor: 'RonnySb',
      licencia: 'CC BY-SA 4.0',
      licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      fuente: 'https://commons.wikimedia.org/wiki/File:Plaza_15_De_Abril.jpg',
    },
  },
  aula: {
    src: img('aula.jpg'),
    width: 1280,
    height: 835,
    alt: 'Maestra y estudiantes sonrientes en un aula rural de Bolivia',
    credito: {
      autor: 'Surubí del Chaco',
      licencia: 'CC BY-SA 4.0',
      licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      fuente: 'https://commons.wikimedia.org/wiki/File:Aula_con_estudiantes_Weenhayek_en_Bolivia.jpg',
    },
  },
  estudiantes: {
    src: img('estudiantes.jpg'),
    width: 1280,
    height: 853,
    alt: 'Niños bolivianos con buzos escolares azul y amarillo durante una salida educativa en Sucre',
    credito: {
      autor: 'Murray Foubister',
      licencia: 'CC BY-SA 2.0',
      licenciaUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      fuente: 'https://commons.wikimedia.org/wiki/File:Sucre,_Bolivia_-_school_chilrens_tour_-_(24840353365).jpg',
    },
  },
  parroquia: {
    src: img('parroquia.jpg'),
    width: 1280,
    height: 960,
    alt: 'Templo de la parroquia San Lorenzo de Colcapirhua',
    credito: {
      autor: 'Ronaldofloresgon',
      licencia: 'CC BY-SA 4.0',
      licenciaUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      fuente: 'https://commons.wikimedia.org/wiki/File:TEMPLO_DE_SAN_LORENZO_COLCAPIRHUA_1.jpg',
    },
  },
}
