import type { Language } from '../../shared/game'

const es = {
  title: 'Aprèn català', setupTitle: 'Aprender catalán', difficulty: 'Dificultad',
  easy: 'Fácil', medium: 'Media', hard: 'Difícil', difficultyHelp: 'Agrupación de juego basada en frecuencia y longitud; no es un nivel oficial.',
  start: 'Empezar', hint: 'Pista en español', errors: 'Errores', incorrect: 'Letras incorrectas', none: 'Ninguna todavía',
  keyboard: 'Teclado de letras catalanas', progress: 'Progreso de la palabra catalana', won: '¡Has acertado la palabra!',
  lost: 'La palabra era…', spanish: 'Español', example: 'Ejemplo', next: 'Siguiente palabra',
  changeDifficulty: 'Cambiar dificultad', home: 'Volver al inicio', currentDifficulty: 'Dificultad',
}

const ca: typeof es = {
  title: 'Aprèn català', setupTitle: 'Aprèn català', difficulty: 'Dificultat',
  easy: 'Fàcil', medium: 'Mitjana', hard: 'Difícil', difficultyHelp: 'Agrupació de joc basada en la freqüència i la longitud; no és un nivell oficial.',
  start: 'Comença', hint: 'Pista en castellà', errors: 'Errors', incorrect: 'Lletres incorrectes', none: 'Cap encara',
  keyboard: 'Teclat de lletres catalanes', progress: 'Progrés de la paraula catalana', won: 'Has encertat la paraula!',
  lost: 'La paraula era…', spanish: 'Castellà', example: 'Exemple', next: 'Paraula següent',
  changeDifficulty: 'Canviar la dificultat', home: "Torna a l'inici", currentDifficulty: 'Dificultat',
}

export const learningTranslations = { es, ca } satisfies Record<Language, typeof es>
