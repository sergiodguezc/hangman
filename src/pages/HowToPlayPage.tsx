import type { Language } from '../../shared/game'

type Props = {
  language: Language
}

const copy = {
  ca: {
    title: 'Com es juga al Penjat?',
    intro: 'Endevina la paraula lletra a lletra abans d’arribar als sis errors.',
    rules: {
      title: 'Regles',
      items: ['Endevina lletres per revelar la paraula.', 'Les lletres correctes es mostren i les incorrectes compten com un error.', 'Completa la paraula per resoldre-la.', 'En arribar als sis errors, quedes fora, tret que et perdonin.'],
    },
    multiplayer: {
      title: 'Multijugador',
      items: ['Crea una sala o uneix-t’hi amb un codi.', 'A cada torn, un jugador tria la paraula secreta i la resta intenten endevinar-la.', 'Qui l’ha triada pot observar el progrés de cada jugador, però no juga aquella paraula.', 'La ronda acaba quan tots els qui endevinen han resolt la paraula o han quedat fora.'],
    },
    rotation: {
      title: 'Voltes i torns',
      items: ['Una volta inclou el torn de triar de cada jugador que continua a la sala.', 'El torn passa al jugador següent segons l’ordre de la partida; si algú marxa, s’omet.', 'Amb 1, 3 o 5 voltes, la partida acaba quan s’han completat els torns previstos.'],
    },
    scoring: {
      title: 'Puntuació',
      items: ['Només puntuen els jugadors que resolen la paraula; qui l’ha triada rep +0.', 'Els resolts van davant dels no resolts. Entre els resolts, menys errors és millor i el temps resol els empats.', 'Els punts depenen del nombre de jugadors que endevinen: amb 3, el millor rep +3, el segon +2 i el tercer +1. Els no resolts reben +0.', 'Un jugador perdonat que resol la paraula encara pot puntuar; si queda eliminat, rep +0. La classificació mostra els punts acumulats de la partida.'],
    },
    forgiveness: {
      title: 'Perdó',
      items: ['En arribar al sisè error, s’envia una petició de perdó a qui ha triat la paraula.', 'La pot concedir o denegar.', 'Si la concedeix, continues amb els errors que ja tens; un altre error t’elimina.', 'Si resols la paraula després del perdó, puntues segons la classificació.'],
    },
    leaving: {
      title: 'Si marxes de la sala',
      items: ['No participes en els torns futurs.', 'Els punts acumulats es conserven i apareixen a «Ja no són a la sala».', 'No formes part de la classificació activa.'],
    },
    learn: {
      title: 'Aprèn català',
      items: ['Es juga en solitari.', 'Ajuda a practicar vocabulari català.', 'Et proposem paraules reals i n’has d’endevinar la forma correcta.', 'Quan acabes, veus la paraula, el significat i la traducció en castellà.'],
    },
  },
  es: {
    title: '¿Cómo se juega a Penjat?',
    intro: 'Adivina la palabra letra a letra antes de llegar a seis errores.',
    rules: {
      title: 'Reglas',
      items: ['Adivina letras para revelar la palabra.', 'Las letras correctas se muestran y las incorrectas cuentan como un error.', 'Completa la palabra para resolverla.', 'Al llegar a seis errores, quedas fuera, salvo que te perdonen.'],
    },
    multiplayer: {
      title: 'Multijugador',
      items: ['Crea una sala o únete con un código.', 'En cada turno, un jugador elige la palabra secreta y los demás intentan adivinarla.', 'Quien la ha elegido puede observar el progreso de cada jugador, pero no juega esa palabra.', 'La ronda termina cuando todos los que adivinan han resuelto la palabra o han quedado fuera.'],
    },
    rotation: {
      title: 'Vueltas y turnos',
      items: ['Una vuelta incluye el turno de elegir de cada jugador que continúa en la sala.', 'El turno pasa al siguiente jugador según el orden de la partida; si alguien se va, se omite.', 'Con 1, 3 o 5 vueltas, la partida termina al completar los turnos previstos.'],
    },
    scoring: {
      title: 'Puntuación',
      items: ['Solo puntúan quienes resuelven la palabra; quien la ha elegido recibe +0.', 'Los jugadores que la resuelven van delante de quienes no lo hacen. Entre los primeros, menos errores es mejor y el tiempo resuelve los empates.', 'Los puntos dependen del número de jugadores que adivinan: con 3, el mejor recibe +3, el segundo +2 y el tercero +1. Quienes no la resuelven reciben +0.', 'Un jugador perdonado que resuelve la palabra aún puede puntuar; si queda eliminado, recibe +0. La clasificación muestra los puntos acumulados de la partida.'],
    },
    forgiveness: {
      title: 'Perdón',
      items: ['Al llegar al sexto error, se envía una petición de perdón a quien ha elegido la palabra.', 'Puede concederla o denegarla.', 'Si la concede, continúas con los errores que ya tienes; otro error te elimina.', 'Si resuelves la palabra después del perdón, puntúas según la clasificación.'],
    },
    leaving: {
      title: 'Si sales de la sala',
      items: ['No participas en los turnos futuros.', 'Conservas los puntos acumulados, que aparecen en «Ya no están en la sala».', 'No formas parte de la clasificación activa.'],
    },
    learn: {
      title: 'Aprender catalán',
      items: ['Se juega en solitario.', 'Sirve para practicar vocabulario catalán.', 'Te proponemos palabras reales y debes adivinar su forma correcta.', 'Al terminar, ves la palabra, el significado y la traducción al castellano.'],
    },
  },
} satisfies Record<Language, {
  title: string
  intro: string
  rules: { title: string; items: string[] }
  multiplayer: { title: string; items: string[] }
  rotation: { title: string; items: string[] }
  scoring: { title: string; items: string[] }
  forgiveness: { title: string; items: string[] }
  leaving: { title: string; items: string[] }
  learn: { title: string; items: string[] }
}>

export function HowToPlayPage({ language }: Props) {
  const t = copy[language]

  return <main className="howto-page" lang={language}>
    <section className="howto-shell">
      <header className="howto-header">
        <div className="brand compact"><span className="brand-mark">P</span><h1>{t.title}</h1></div>
      </header>

      <article className="howto-card">
        <p className="howto-intro">{t.intro}</p>
        <div className="howto-grid">
          <section className="howto-section howto-section--full">
            <h2>{t.rules.title}</h2>
            <ul>{t.rules.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="howto-section">
            <h2>{t.multiplayer.title}</h2>
            <ul>{t.multiplayer.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="howto-section">
            <h2>{t.rotation.title}</h2>
            <ul>{t.rotation.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="howto-section">
            <h2>{t.scoring.title}</h2>
            <ul>{t.scoring.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="howto-section">
            <h2>{t.forgiveness.title}</h2>
            <ul>{t.forgiveness.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="howto-section">
            <h2>{t.leaving.title}</h2>
            <ul>{t.leaving.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="howto-section">
            <h2>{t.learn.title}</h2>
            <ul>{t.learn.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
      </article>
    </section>
  </main>
}
