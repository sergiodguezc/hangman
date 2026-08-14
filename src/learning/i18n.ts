import type { Language } from '../../shared/game'

const es = {
  title: 'Aprèn català', setupTitle: 'Aprender catalán', difficulty: 'Dificultad',
  easy: 'Fácil', medium: 'Media', hard: 'Difícil', difficultyHelp: 'Agrupación de juego basada en frecuencia y longitud; no es un nivel oficial.',
  start: 'Empezar', hint: 'Pista en español', errors: 'Errores', incorrect: 'Letras incorrectas', none: 'Ninguna todavía',
  keyboard: 'Teclado de letras catalanas', progress: 'Progreso de la palabra catalana', won: '¡Has acertado la palabra!',
  lost: 'La palabra era…', spanish: 'Español', example: 'Ejemplo', next: 'Siguiente palabra',
  also: 'También',
  changeDifficulty: 'Cambiar dificultad', home: 'Volver al inicio', currentDifficulty: 'Dificultad',
  sessionProgress: 'Progreso de la sesión', history: 'Historial', showAll: 'Ver todo', showLess: 'Ver menos',
  noHistory: 'Aún no hay palabras completadas.', summaryTitle: 'Resumen de la sesión',
  emptySummary: 'No has completado ninguna palabra en esta sesión.', wordsPlayed: 'Palabras jugadas',
  correctAttempts: 'Correctas', failedAttempts: 'Errores', accuracy: 'Precisión', uniqueWords: 'Palabras diferentes',
  returnToMenu: 'Volver al menú',
  statsLine: (total: number, correct: number, failed: number, accuracy: number, unique: number) => `${total} ${total === 1 ? 'palabra' : 'palabras'} · ${correct} correctas · ${failed} errores · ${accuracy}% · ${unique} únicas`,
}

const ca: typeof es = {
  title: 'Aprèn català', setupTitle: 'Aprèn català', difficulty: 'Dificultat',
  easy: 'Fàcil', medium: 'Mitjana', hard: 'Difícil', difficultyHelp: 'Agrupació de joc basada en la freqüència i la longitud; no és un nivell oficial.',
  start: 'Comença', hint: 'Pista en castellà', errors: 'Errors', incorrect: 'Lletres incorrectes', none: 'Cap encara',
  keyboard: 'Teclat de lletres catalanes', progress: 'Progrés de la paraula catalana', won: 'Has encertat la paraula!',
  lost: 'La paraula era…', spanish: 'Castellà', example: 'Exemple', next: 'Paraula següent',
  also: 'També',
  changeDifficulty: 'Canviar la dificultat', home: "Torna a l'inici", currentDifficulty: 'Dificultat',
  sessionProgress: 'Progrés de la sessió', history: 'Historial', showAll: 'Veure tot', showLess: 'Veure menys',
  noHistory: 'Encara no hi ha paraules completades.', summaryTitle: 'Resum de la sessió',
  emptySummary: 'No has completat cap paraula en aquesta sessió.', wordsPlayed: 'Paraules jugades',
  correctAttempts: 'Correctes', failedAttempts: 'Errors', accuracy: 'Precisió', uniqueWords: 'Paraules diferents',
  returnToMenu: 'Torna al menú',
  statsLine: (total, correct, failed, accuracy, unique) => `${total} ${total === 1 ? 'paraula' : 'paraules'} · ${correct} correctes · ${failed} errors · ${accuracy}% · ${unique} úniques`,
}

export const learningTranslations = { es, ca } satisfies Record<Language, typeof es>
