import type { Language } from '../../shared/game'

const es = {
  title: 'Aprèn català', audience: 'Catalán para hispanohablantes', setupTitle: 'Elige el nivel y empieza', difficulty: 'Dificultad', cefr: 'Nivel', allLevels: 'Todos',
  levelGroups: { basic: 'Básico', intermediate: 'Intermedio', advanced: 'Avanzado', all: 'Todos' },
  easy: 'Fácil', medium: 'Media', hard: 'Difícil', difficultyHelp: 'Elige un nivel CEFR o practica con todo el vocabulario.',
  emptySelection: 'No hay palabras disponibles para este nivel. Elige otro nivel.', nextLevel: 'Siguiente palabra', practicedLevels: 'Niveles practicados', unknownLevel: 'Sin clasificar',
  start: 'Empezar', hint: 'Pista en español', errors: 'Letras incorrectas', incorrect: 'Letras incorrectas', none: 'Ninguna todavía',
  keyboard: 'Teclado de letras catalanas', progress: 'Progreso de la palabra catalana', won: '¡Has acertado la palabra!',
  lost: 'La palabra era…', reviewLater: 'La volveremos a practicar más adelante en esta sesión.', spanish: 'Español', definition: 'Definición', example: 'Ejemplo', next: 'Siguiente palabra',
  also: 'También',
  mistakesSummary: (count: number) => count === 0 ? 'Ninguna letra incorrecta' : `${count} ${count === 1 ? 'letra incorrecta' : 'letras incorrectas'}`,
  changeDifficulty: 'Cambiar nivel', home: 'Volver al inicio', currentDifficulty: 'Nivel',
  sessionProgress: 'Progreso de la sesión', history: 'Historial', showAll: 'Ver todo', showLess: 'Ver menos',
  noHistory: 'Aún no hay palabras completadas.', summaryTitle: 'Resumen de la sesión',
  emptySummary: 'No has completado ninguna palabra en esta sesión.', wordsPlayed: 'Palabras jugadas',
  correctAttempts: 'Palabras acertadas', failedAttempts: 'Palabras no acertadas', accuracy: 'Porcentaje de palabras acertadas', uniqueWords: 'Palabras diferentes',
  returnToMenu: 'Volver al menú', cancel: 'Cancelar',
  statsLine: (total: number, correct: number, failed: number, accuracy: number, unique: number) => `${total} ${total === 1 ? 'palabra' : 'palabras'} · ${correct} ${correct === 1 ? 'acertada' : 'acertadas'} · ${failed} ${failed === 1 ? 'no acertada' : 'no acertadas'} · ${accuracy}% de acierto · ${unique} ${unique === 1 ? 'única' : 'únicas'}`,
}

const ca: typeof es = {
  title: 'Aprèn català', audience: 'Català per a castellanoparlants', setupTitle: 'Tria el nivell i comença', difficulty: 'Dificultat', cefr: 'Nivell', allLevels: 'Tots',
  levelGroups: { basic: 'Bàsic', intermediate: 'Intermedi', advanced: 'Avançat', all: 'Tots' },
  easy: 'Fàcil', medium: 'Mitjana', hard: 'Difícil', difficultyHelp: 'Tria un nivell CEFR o practica amb tot el vocabulari.',
  emptySelection: 'No hi ha paraules disponibles per a aquest nivell. Tria un altre nivell.', nextLevel: 'Paraula següent', practicedLevels: 'Nivells practicats', unknownLevel: 'Sense classificar',
  start: 'Comença', hint: 'Pista en castellà', errors: 'Lletres incorrectes', incorrect: 'Lletres incorrectes', none: 'Cap encara',
  keyboard: 'Teclat de lletres catalanes', progress: 'Progrés de la paraula catalana', won: 'Has encertat la paraula!',
  lost: 'La paraula era…', reviewLater: 'La tornarem a practicar més endavant en aquesta sessió.', spanish: 'Castellà', definition: 'Definició', example: 'Exemple', next: 'Paraula següent',
  also: 'També',
  mistakesSummary: (count) => count === 0 ? 'Cap lletra incorrecta' : `${count} ${count === 1 ? 'lletra incorrecta' : 'lletres incorrectes'}`,
  changeDifficulty: 'Canviar el nivell', home: "Torna a l'inici", currentDifficulty: 'Nivell',
  sessionProgress: 'Progrés de la sessió', history: 'Historial', showAll: 'Veure tot', showLess: 'Veure menys',
  noHistory: 'Encara no hi ha paraules completades.', summaryTitle: 'Resum de la sessió',
  emptySummary: 'No has completat cap paraula en aquesta sessió.', wordsPlayed: 'Paraules jugades',
  correctAttempts: 'Paraules encertades', failedAttempts: 'Paraules no encertades', accuracy: 'Percentatge de paraules encertades', uniqueWords: 'Paraules diferents',
  returnToMenu: 'Torna al menú', cancel: 'Cancel·la',
  statsLine: (total, correct, failed, accuracy, unique) => `${total} ${total === 1 ? 'paraula' : 'paraules'} · ${correct} ${correct === 1 ? 'encertada' : 'encertades'} · ${failed} ${failed === 1 ? 'no encertada' : 'no encertades'} · ${accuracy}% d’encert · ${unique} ${unique === 1 ? 'única' : 'úniques'}`,
}

export const learningTranslations = { es, ca } satisfies Record<Language, typeof es>
