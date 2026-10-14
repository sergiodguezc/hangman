import type { Language } from '../../shared/game'

const ca = {
  title: 'Aprèn vocabulari', lede: 'Paraules catalanes per temes, amb una pista en castellà. El progrés es desa en aquest navegador.',
  units: 'Unitats', noUnits: 'Encara no hi ha cap unitat disponible. Torna-hi aviat.', draft: 'Esborrany',
  unitLabel: (position: number, title: string) => `Unitat ${position} · ${title}`,
  unitCaption: (title: string) => `Unitat «${title}»`,
  wordOf: (position: number, total: number) => `Paraula ${position} de ${total}`,
  reviewOf: (position: number, total: number) => `Repàs: paraula ${position} de ${total}`,
  discoveredLine: (discovered: number, total: number, percent: number) => `${discovered} de ${total} descobertes · ${percent}%`,
  stripLabel: (discovered: number, total: number) => `${discovered} de ${total} paraules descobertes`,
  start: 'Comença', continue: 'Continua', revisit: 'Revisa',
  hint: 'Pista en castellà', errors: 'Lletres incorrectes', incorrect: 'Lletres incorrectes', none: 'Cap encara',
  keyboard: 'Teclat de lletres catalanes', progress: 'Progrés de la paraula catalana',
  won: 'Has encertat la paraula', lost: 'La paraula era…',
  listen: 'Escolta la pronunciació', definition: 'Definició', example: 'Exemple', spanish: 'En castellà', expression: 'Expressió', note: 'Curiositat',
  grammar: { noun: 'nom', verb: 'verb', adjective: 'adjectiu', adverb: 'adverbi', other: '' }, gender: { m: 'masculí', f: 'femení' },
  next: 'Següent paraula', finish: 'Veure el resum', bookmark: 'Desa la paraula',
  yourProgress: 'El teu progrés', discovered: 'Descobertes', correct: 'Encertades', failed: 'Per repassar', saved: 'Desades',
  unitWords: "Paraules d'aquesta unitat", noWordsYet: 'Les paraules que descobreixis apareixeran aquí.',
  summaryTitle: 'Resum de la unitat', complete: 'Unitat completada',
  reviewFailed: 'Repassa les fallades', replay: 'Torna a jugar la unitat', otherUnits: 'Altres unitats', close: 'Tanca',
}

const es: typeof ca = {
  title: 'Aprende vocabulario', lede: 'Palabras catalanas por temas, con una pista en español. El progreso se guarda en este navegador.',
  units: 'Unidades', noUnits: 'Todavía no hay ninguna unidad disponible. Vuelve pronto.', draft: 'Borrador',
  unitLabel: (position, title) => `Unidad ${position} · ${title}`,
  unitCaption: (title) => `Unidad «${title}»`,
  wordOf: (position, total) => `Palabra ${position} de ${total}`,
  reviewOf: (position, total) => `Repaso: palabra ${position} de ${total}`,
  discoveredLine: (discovered, total, percent) => `${discovered} de ${total} descubiertas · ${percent}%`,
  stripLabel: (discovered, total) => `${discovered} de ${total} palabras descubiertas`,
  start: 'Empezar', continue: 'Continuar', revisit: 'Revisar',
  hint: 'Pista en español', errors: 'Letras incorrectas', incorrect: 'Letras incorrectas', none: 'Ninguna todavía',
  keyboard: 'Teclado de letras catalanas', progress: 'Progreso de la palabra catalana',
  won: 'Has acertado la palabra', lost: 'La palabra era…',
  listen: 'Escucha la pronunciación', definition: 'Definición', example: 'Ejemplo', spanish: 'En español', expression: 'Expresión', note: 'Curiosidad',
  grammar: { noun: 'sustantivo', verb: 'verbo', adjective: 'adjetivo', adverb: 'adverbio', other: '' }, gender: { m: 'masculino', f: 'femenino' },
  next: 'Siguiente palabra', finish: 'Ver el resumen', bookmark: 'Guardar la palabra',
  yourProgress: 'Tu progreso', discovered: 'Descubiertas', correct: 'Acertadas', failed: 'Por repasar', saved: 'Guardadas',
  unitWords: 'Palabras de esta unidad', noWordsYet: 'Las palabras que descubras aparecerán aquí.',
  summaryTitle: 'Resumen de la unidad', complete: 'Unidad completada',
  reviewFailed: 'Repasa las falladas', replay: 'Vuelve a jugar la unidad', otherUnits: 'Otras unidades', close: 'Cerrar',
}

export const learningTranslations = { es, ca } satisfies Record<Language, typeof ca>
