import type { Language } from '../../shared/game'

type Props = {
  language: Language
}

const copy = {
  ca: {
    title: 'Com es juga a Penjat?',
    intro: 'Penjat és el joc de paraules clàssic en què has d’endevinar una paraula lletra a lletra abans que s’acabin els errors.',
    rules: {
      title: 'Regles',
      items: ['Endevina lletres.', 'Les lletres correctes es revelen automàticament.', 'Les errònies fan avançar el penjat.', 'Guanyes si completes la paraula i perds si esgotas els intents permesos.'],
    },
    multiplayer: {
      title: 'Multijugador',
      items: ['Crea una sala o uneix-te amb un codi de sala.', 'Una persona tria la paraula secreta i l’altra l’endevina.', 'Cada encert mostra lletres; cada error afegeix una part del penjat.', 'La ronda acaba quan es completa la paraula o s’esgoten els errors.'],
    },
    learn: {
      title: 'Aprèn català',
      items: ['Es juga en solitari.', 'Ajuda a practicar vocabulari català.', 'Et proposem paraules reals i n’has d’endevinar la forma correcta.', 'Quan acabes, veus la paraula, el significat i la traducció en castellà.'],
    },
  },
  es: {
    title: '¿Cómo se juega a Penjat?',
    intro: 'Penjat es el clásico juego de palabras en el que debes adivinar una palabra letra a letra antes de que se acaben los errores.',
    rules: {
      title: 'Reglas',
      items: ['Adivina letras.', 'Las letras correctas se revelan automáticamente.', 'Las erróneas hacen avanzar al ahorcado.', 'Ganas si completas la palabra y pierdes si agotas los intentos permitidos.'],
    },
    multiplayer: {
      title: 'Multijugador',
      items: ['Crea una sala o únete con un código de sala.', 'Una persona elige la palabra secreta y la otra la adivina.', 'Cada acierto revela letras; cada error añade una parte del ahorcado.', 'La ronda termina cuando se completa la palabra o se agotan los errores.'],
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
            <h2>{t.learn.title}</h2>
            <ul>{t.learn.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
      </article>
    </section>
  </main>
}
