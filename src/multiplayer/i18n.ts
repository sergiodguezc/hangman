import type { Language } from '../../shared/game'

const es = {
  title: 'Penjat', subtitle: 'El clásico juego de palabras, ahora para dos', name: 'Tu nombre',
  namePlaceholder: 'Escribe tu nombre', language: 'Idioma', create: 'Crear partida', join: 'Unirse a partida',
  roomCode: 'Código de sala', codePlaceholder: 'ABCDE', waiting: 'Esperando al otro jugador…', copy: 'Copiar código', copied: 'Copiado',
  players: 'Jugadores', round: 'Ronda', ranking: 'Clasificación', choosing: 'elige la palabra', guessing: 'adivina',
  chooseWord: 'Elige la palabra secreta', secretPlaceholder: 'Palabra o frase secreta', wordPrivacy: 'El otro jugador no verá la palabra.', startRound: 'Empezar ronda',
  rivalChoosing: 'está eligiendo una palabra…', yourGuess: 'Te toca adivinar', youChose: 'Has elegido la palabra',
  incorrect: 'Letras incorrectas', none: 'Ninguna todavía', errors: 'Errores', next: 'Siguiente ronda',
  winner: 'ha ganado la ronda', wordWas: 'La palabra era', disconnected: 'El otro jugador se ha desconectado',
  home: 'Volver al inicio', leave: 'Salir', invalidWord: 'Introduce una palabra válida de hasta 50 caracteres.',
  roomNotFound: 'La sala no existe.', roomFull: 'La sala ya tiene dos jugadores.', invalidDetails: 'Revisa el nombre y el código.',
  connectionError: 'No se pudo conectar con el servidor. Comprueba que “npm run dev” sigue activo.', keyboard: 'Teclado de letras', share: 'Comparte este código',
  finalErrorSetter: 'Tu rival ha cometido el último error.', forgivenessQuestion: '¿Quieres perdonarle la vida?',
  forgive: 'Perdonar la vida', doNotForgive: 'No perdonar', finalErrorGuesser: 'Has llegado al último error.',
  waitingForgiveness: 'Esperando a que tu rival decida si te perdona la vida…',
  chatTitle: 'Chat', chatPlaceholder: 'Escribe un mensaje…', chatSend: 'Enviar', chatEmpty: 'Todavía no hay mensajes.',
  reactionHeart: 'Reaccionar con corazón', reactionLaugh: 'Reaccionar con risa', reactionSkull: 'Reaccionar con calavera',
  reactionFailed: 'No se pudo actualizar la reacción.',
  chatTooLong: 'El mensaje es demasiado largo.', chatFailed: 'No se pudo enviar el mensaje.',
  opponentReconnecting: 'Tu rival ha perdido la conexión. Esperando a que vuelva…', opponentReconnected: 'Tu rival se ha reconectado.',
  resumeRejected: 'No se pudo recuperar la partida. La sala ya no está disponible.',
  matchTarget: 'Objetivo de la partida', points: '{target} puntos', unlimited: 'Sin límite', matchObjective: 'Objetivo: {target}',
  matchTargetExplanation: 'Cuando un jugador alcance el objetivo, se completará la pareja de rondas para que ambos tengan los mismos turnos. Después se comparará la puntuación y la partida podrá terminar en empate.',
  targetReached: '{player} ha alcanzado el objetivo, pero queda una ronda para que ambos tengáis los mismos turnos.',
  opponentReachedFinalRound: 'Tu rival ha alcanzado el objetivo. Esta es la última ronda de la partida.',
  matchWon: 'Has ganado la partida', matchLost: 'Has perdido la partida', finalScore: 'Resultado final', rematch: 'Revancha',
  draw: 'Empate', matchDraw: 'La partida ha terminado en empate.',
  waitingRematch: 'Esperando a que tu rival acepte la revancha…', opponentWantsRematch: 'Tu rival quiere una revancha',
  youStart: 'Empiezas eligiendo la palabra.', playerStarts: '{player} empieza eligiendo la palabra.',
  typing: '{player} está escribiendo…',
  multiplayer: 'Multijugador', learnCatalan: 'Aprèn català', chooseMode: 'Elige un modo de juego', back: 'Volver',
}

const ca: typeof es = {
  title: 'Penjat', subtitle: 'El joc de paraules de sempre, ara per a dos', name: 'El teu nom',
  namePlaceholder: 'Escriu el teu nom', language: 'Llengua', create: 'Crea una partida', join: "Uneix-te a una partida",
  roomCode: 'Codi de sala', codePlaceholder: 'ABCDE', waiting: "Esperant l'altre jugador…", copy: 'Copia el codi', copied: 'Codi copiat!',
  players: 'Jugadors', round: 'Ronda', ranking: 'Classificació', choosing: 'tria la paraula', guessing: 'endevina',
  chooseWord: 'Tria la paraula secreta', secretPlaceholder: 'Escriu una paraula o una frase', wordPrivacy: "L'altre jugador no veurà la paraula.", startRound: 'Comença la ronda',
  rivalChoosing: 'està triant una paraula…', yourGuess: 'Et toca endevinar', youChose: 'Has triat la paraula',
  incorrect: 'Lletres incorrectes', none: 'Cap encara', errors: 'Errors', next: 'Ronda següent',
  winner: 'ha guanyat la ronda', wordWas: 'La paraula era', disconnected: "L'altre jugador s'ha desconnectat",
  home: "Torna a l'inici", leave: 'Surt', invalidWord: 'Escriu una paraula vàlida de 50 caràcters com a màxim.',
  roomNotFound: 'La sala no existeix.', roomFull: 'La sala ja té dos jugadors.', invalidDetails: 'Revisa el nom i el codi.',
  connectionError: "No s'ha pogut establir la connexió amb el servidor. Comprova que «npm run dev» continua en execució.", keyboard: 'Teclat de lletres', share: 'Comparteix aquest codi',
  finalErrorSetter: "El teu rival ha arribat a l'últim error.", forgivenessQuestion: 'Vols perdonar-li la vida?',
  forgive: 'Perdonar la vida', doNotForgive: 'No perdonar', finalErrorGuesser: "Has arribat a l'últim error.",
  waitingForgiveness: 'Esperant que el teu rival decideixi si et perdona la vida…',
  chatTitle: 'Xat', chatPlaceholder: 'Escriu un missatge…', chatSend: 'Envia', chatEmpty: 'Encara no hi ha missatges.',
  reactionHeart: 'Reaccionar amb un cor', reactionLaugh: 'Reaccionar amb una rialla', reactionSkull: 'Reaccionar amb una calavera',
  reactionFailed: "No s'ha pogut actualitzar la reacció.",
  chatTooLong: 'El missatge és massa llarg.', chatFailed: "No s'ha pogut enviar el missatge.",
  opponentReconnecting: 'El teu rival ha perdut la connexió. Esperant que torni…', opponentReconnected: "El teu rival s'ha tornat a connectar.",
  resumeRejected: "No s'ha pogut recuperar la partida. La sala ja no està disponible.",
  matchTarget: 'Objectiu de la partida', points: '{target} punts', unlimited: 'Sense límit', matchObjective: 'Objectiu: {target}',
  matchTargetExplanation: "Quan un jugador arribi a l'objectiu, es completarà la parella de rondes perquè tots dos tinguin els mateixos torns. Després es compararà la puntuació i la partida podrà acabar en empat.",
  targetReached: "{player} ha arribat a l'objectiu, però queda una ronda perquè tots dos tingueu els mateixos torns.",
  opponentReachedFinalRound: "El teu rival ha arribat a l'objectiu. Aquesta és l'última ronda de la partida.",
  matchWon: 'Has guanyat la partida', matchLost: 'Has perdut la partida', finalScore: 'Resultat final', rematch: 'Revenja',
  draw: 'Empat', matchDraw: 'La partida ha acabat en empat.',
  waitingRematch: 'Esperant que el teu rival accepti la revenja…', opponentWantsRematch: 'El teu rival vol una revenja',
  youStart: 'Comences triant la paraula.', playerStarts: '{player} comença triant la paraula.',
  typing: '{player} està escrivint…',
  multiplayer: 'Multijugador', learnCatalan: 'Aprèn català', chooseMode: 'Tria un mode de joc', back: 'Torna',
}

export const multiplayerTranslations = { es, ca } satisfies Record<Language, typeof es>
export type MultiplayerTranslations = typeof es

export function errorMessage(code: string, t: MultiplayerTranslations) {
  const messages: Record<string, string> = {
    'room-not-found': t.roomNotFound, 'room-full': t.roomFull, 'invalid-details': t.invalidDetails,
    'invalid-word': t.invalidWord, 'connect_error': t.connectionError,
    'chat-message-too-long': t.chatTooLong, 'empty-chat-message': t.chatFailed,
    'invalid-chat-message': t.chatFailed, 'not-room-member': t.chatFailed,
    'invalid-reaction': t.reactionFailed, 'chat-message-not-found': t.reactionFailed,
    'resume-rejected': t.resumeRejected, 'opponent-reconnecting': t.opponentReconnecting,
  }
  return messages[code] ?? t.connectionError
}
