# Auditoría y plan de refactorización del multijugador N-player

## Alcance y conclusión

Esta auditoría cubre el protocolo compartido, el servidor Socket.IO, el cliente React, la gestión de sesiones y las suites de pruebas del multijugador. No se han realizado cambios funcionales en esta fase.

La implementación actual es una arquitectura 1v1 razonablemente pequeña y coherente, pero el dominio de juego está modelado como un único duelo global. El principal obstáculo para N jugadores no es Socket.IO ni React: es que `GameRoom` tiene una sola palabra, un único conjunto de letras, un contador de errores y un único jugador que adivina. La refactorización debe convertir esos datos en estado de ronda + estado individual por jugador y mantener una única máquina para `N = 2` y para cualquier `N > 2`.

Hay dos decisiones de producto que conviene fijar durante Fase 2 antes de abrir la sala a N jugadores:

1. El número máximo de jugadores y cómo empieza una sala con menos del máximo. La propuesta de este documento es un `maxPlayers` configurable, mínimo 2, con inicio explícito del anfitrión.
2. La puntuación acumulada de la partida. La propuesta compatible con el 1v1 actual aparece en [Puntuación y ranking](#puntuación-y-ranking). La duración deja de depender de una puntuación objetivo y pasa a depender exclusivamente de `voltes`.

## 1. Arquitectura actual

El despliegue es un único proceso Node.js que sirve la aplicación React compilada y aloja Socket.IO sobre el mismo servidor HTTP. El estado es exclusivamente memoria del proceso: `GameManager` conserva un `Map` de salas, un índice jugador-sala y un índice socket-jugador ([`server/game/GameManager.ts`](../server/game/GameManager.ts), líneas 8-12). Por tanto, un reinicio pierde salas, partidas, puntuaciones y chat; tampoco hay soporte para varias réplicas.

El flujo actual es:

1. `room:create` valida nombre, idioma y `matchTarget`, crea una sala y devuelve `RoomEntry` con vista y token de reconexión.
2. `room:join` busca el código, añade un segundo jugador y arranca inmediatamente el match.
3. `broadcast` no envía una vista única a todos: recorre los jugadores conectados y llama a `room.viewFor(player.id)` para cada socket ([`server/server.ts`](../server/server.ts), líneas 132-142). Esta decisión es reutilizable para privacidad N-player.
4. El cliente guarda `RoomSession` en `sessionStorage`, se reconecta al evento `connect` y reanuda usando el token ([`src/App.tsx`](../src/App.tsx), líneas 100-124; [`src/multiplayer/socket.ts`](../src/multiplayer/socket.ts), líneas 12-20).
5. Socket.IO delega las mutaciones a `GameRoom`: elegir palabra, adivinar, decidir perdón, continuar, revancha y chat ([`server/server.ts`](../server/server.ts), líneas 191-265).

La frontera de seguridad correcta ya existe conceptualmente: el servidor obtiene la identidad desde el socket, no desde un `playerId` enviado por el cliente, valida la acción y vuelve a construir la vista. Debe conservarse, pero con vistas privadas más específicas.

## 2. Acoplamientos concretos a dos jugadores

### Protocolo compartido

[`shared/protocol.ts`](../shared/protocol.ts) contiene los siguientes acoplamientos:

- `MatchTarget` solo acepta `3 | 5 | 10 | null` (línea 3), y representa puntos objetivo, no duración en vueltas.
- `GamePhase` es una fase global que mezcla sala, turno, perdón, final de ronda y desconexión (línea 4).
- `PlayerGameView` expone un único `wordSetterId`, un único `guesserId`, un único `roundWinnerId`, una única palabra y un único conjunto de `guessedLetters`, `wrongLetters` y `errors` (líneas 16-39).
- `round:forgiveness` solo transporta un booleano. No hay `requestId` ni `playerId` de la solicitud (línea 49).
- `round:continue` presupone que existe un solo jugador que debe continuar; `match:rematch` solo tiene el estado implícito del socket (líneas 50 y 54).
- `RoomPreview` solo comunica el número actual de jugadores, sin capacidad máxima ni estado de admisión (línea 9).

### Servidor y dominio

Los acoplamientos más importantes están en [`server/game/GameRoom.ts`](../server/game/GameRoom.ts):

- `players` se limita con `this.players.length >= 2` y la partida comienza exactamente cuando llega el segundo jugador (líneas 32-37).
- El estado de la palabra es global: `secretWord`, `guesses` y `errorCount` (líneas 23-25). No puede representar dos adivinanzas simultáneas con errores diferentes.
- El turno tiene exactamente dos roles y se valida con `playerId !== this.guesserId` (líneas 64-92).
- `forgiveness-pending` es una fase de toda la sala. Solo puede existir una solicitud y solo el setter puede decidirla; perdonar resta un error, lo que borra parcialmente la evidencia del error (líneas 94-106).
- `continue` intercambia dos identificadores (`wordSetterId` y `guesserId`) y autoriza únicamente al antiguo guesser (líneas 108-120).
- `requestRematch` arranca al alcanzar `rematchReady.size === 2` (líneas 122-128).
- La resolución de match desestructura `[first, second]` y compara solo esos dos jugadores (líneas 211-224).
- `startMatch` genera un índice binario, asigna setter y guesser complementarios y solo opera si `players.length === 2` (líneas 226-243).
- `assertPlayable` bloquea toda la sala si cualquier jugador está reconectando (líneas 60-62). Además de ser un acoplamiento 1v1, impediría que los demás jugadores siguieran jugando durante la reconexión de uno.
- Al expirar la gracia, `disconnect` elimina al jugador y deja al resto en fase global `disconnected` (líneas 130-136). No existe una política de salida compatible con una ronda cuyo orden de turnos debe ser estable.

[`server/server.ts`](../server/server.ts) repite la capacidad `2` en `roomPreview` (líneas 124-130), y la UI de invitación deja de estar disponible cuando hay dos jugadores.

### Cliente React

- [`src/pages/HomePage.tsx`](../src/pages/HomePage.tsx), líneas 40 y 130-145, crea con `matchTarget` y no ofrece `voltes`.
- [`src/pages/LobbyPage.tsx`](../src/pages/LobbyPage.tsx), líneas 30 y 40, muestra `players.length / 2` y permite invitar solo mientras haya menos de dos.
- [`src/pages/GamePage.tsx`](../src/pages/GamePage.tsx), líneas 37-57, deriva `isSetter` e `isGuesser` de los dos identificadores singleton. La vista tiene un único tablero, un único teclado, una única lista de errores y un único panel de perdón (líneas 101-125).
- El setter sigue viendo el teclado, aunque está deshabilitado mediante `Keyboard`; esto debe eliminarse al crear la vista de observación N-player, no mantenerse como control inerte.
- [`src/components/Scoreboard.tsx`](../src/components/Scoreboard.tsx), líneas 4-17, solo puede rotular un setter y un guesser. El ranking ordena por `score`, no por resultado, errores y tiempo de resolución.
- [`src/App.tsx`](../src/App.tsx), líneas 81 y 108, guarda un único `typingPlayer`; varios jugadores escribiendo se pisan entre sí. Las notificaciones de reconexión también hablan de un único rival ([`src/pages/GamePage.tsx`](../src/pages/GamePage.tsx), líneas 80-91).
- Las traducciones están redactadas para “el otro jugador”, “tu rival” y “la pareja de rondas” ([`src/multiplayer/i18n.ts`](../src/multiplayer/i18n.ts), líneas 3-40 y 58-95). No es un problema de dominio, pero sí una dependencia visible de la UX 1v1.

## 3. Representación actual de cada concepto

| Concepto | Representación actual | Consecuencia para N jugadores |
|---|---|---|
| Sala | `GameRoom` en `GameManager.rooms`, identificada por código de 5 caracteres; estado en memoria. | Reutilizable como contenedor, pero necesita capacidad, propietario, orden estable y estado separado de la ronda. |
| Player | `RoomPlayer = Player + socketId + reconnectToken`; `Player` solo tiene id, nombre, score y conexión. | Debe añadir identidad de sala/host y mantener el estado de ronda en otra estructura, no en el jugador global. |
| Turn | `roundNumber`, `wordSetterId`, `guesserId`; el setter inicial es aleatorio y los dos IDs se intercambian. | Sustituir por `turnOrder`, `turnIndex`, `voltaNumber` y `nextSetterId`. |
| Word setter | Un `wordSetterId` global; su palabra se guarda en `secretWord` y se le devuelve `privateWord`. | Mantener un único setter por turno, pero con `guesserIds = todos menos el setter`. |
| Guesser | Un `guesserId`; sus letras y errores son globales. | Un `PlayerRoundState` independiente por cada jugador no setter. |
| Score | `Player.score` aumenta 1 para el guesser que resuelve o para el setter si rechaza el perdón. | Separar puntos acumulados de ranking de la ronda; eliminar el objetivo de puntos como final de partida. |
| Match target | `MatchTarget = 3/5/10/null`; al alcanzar el objetivo se espera al final de la pareja de rondas. | Reemplazar por `voltes`; una vuelta contiene exactamente un turno de cada jugador. |
| Forgiveness | Fase global, un `errorCount`, booleano implícito en la resta `6 -> 5`; no se conserva que se perdonó. | Colección de solicitudes por jugador, estado individual `forgiven` y errores monotónicos. |
| Reconnect/disconnect | Se marca un jugador `reconnecting`; `assertPlayable` congela toda acción; tras 25 s se elimina y la sala pasa a `disconnected`. | Conectividad ortogonal al juego; un jugador puede congelarse sin filtrar sus datos ni detener a los demás. |
| Rematch | `Set<string>` y arranque al alcanzar tamaño 2; se resetean scores y estado. | Arrancar cuando todos los miembros elegibles de la sala confirmen, no cuando el conjunto tenga tamaño literal 2. |

## 4. Qué reutilizar, generalizar y reemplazar

### Reutilizar casi intacto

- Las funciones puras de [`shared/game.ts`](../shared/game.ts): normalización, validación, detección de aciertos, máscara de palabra y finalización.
- El formato de ACK `{ ok, data }` y el patrón de autorización basado en `identityForSocket`.
- El generador de códigos, los tokens opacos de reconexión y el almacenamiento en memoria mientras no se requiera persistencia.
- El patrón de `broadcast` por jugador. Es especialmente valioso porque permite que el servidor construya una vista distinta para cada receptor.
- Chat, reacciones, límites de longitud e historial acotado. Solo la colección de typing debe generalizarse de un elemento a varios.
- El concepto de `RoomSession` y la gracia de reconexión de 25 segundos, sujeto a las reglas de ronda descritas más abajo.

### Generalizar

- `Player` para que el score acumulado no sea el único dato relevante y `PlayerGameView` para separar resumen público de estado privado.
- `GameRoom` para usar un estado de match, un estado de ronda y un mapa `playerId -> PlayerRoundState`.
- La rotación de roles mediante una lista de jugadores, no mediante intercambio de dos propiedades.
- La vista y el ranking para aceptar cualquier cantidad de jugadores.
- Reconnect, rematch, preview, typing e invitaciones para usar el conjunto real de miembros.
- Los errores de negocio: `not-word-setter`, `not-guesser`, `cannot-continue` y los mensajes de “rival” deben pasar a mensajes relativos al jugador o a la acción.

### Reemplazar en lugar de parchear

- El estado global `secretWord + guesses + errorCount`. Añadir un segundo mapa paralelo a esos campos conservaría el error conceptual y haría difícil cerrar una ronda de forma atómica.
- La fase global `forgiveness-pending`. Con varias solicitudes simultáneas debe desaparecer como fase de sala; el pending pertenece al jugador y a su solicitud.
- La resolución por parejas basada en `roundNumber % 2` y `[first, second]`. Es una regla específica de 1v1 y de un objetivo de puntos que ya no existe.
- La forma actual de `PlayerGameView`, porque enviar un único tablero a todos sería incompatible con la privacidad competitiva. Conviene introducir un contrato versionado con secciones públicas, propias y observadas.
- La pantalla de partida monolítica de `GamePage` para separar: resumen de sala, tablero propio, panel de observación del setter, bandeja de perdones y chat. No hace falta reescribir los componentes visuales básicos, pero sí cambiar su fuente de datos.

## 5. Modelo de datos propuesto

La siguiente es una propuesta de dominio, no una obligación de conservar estos nombres exactos. La regla importante es no duplicar una implementación especial para dos jugadores.

### Sala y match

```ts
type RoomStatus = 'waiting' | 'active' | 'match-over' | 'aborted' | 'closed'

type RoomConfig = {
  language: Language
  maxPlayers: number       // mínimo 2; capacidad fija al crear la sala
  voltes: number            // entero positivo
}

type RoomPlayer = {
  id: string
  name: string
  score: number             // score acumulado de match, no objetivo de finalización
  socketId: string | null
  reconnectToken: string
  connectionState: 'connected' | 'reconnecting'
  joinedAt: number
}

type MatchState = {
  status: RoomStatus
  ownerId: string
  turnOrder: string[]       // snapshot de jugadores al iniciar el match
  turnIndex: number         // índice del setter actual
  voltaNumber: number       // 1..voltes
  completedTurns: number
  totalTurns: number        // turnOrder.length * voltes
  rematchReadyPlayerIds: string[]
}
```

La sala debe bloquear nuevas entradas cuando pasa de `waiting` a `active`; de otro modo el significado de “cada jugador exactamente una vez por volta” cambiaría a mitad de una partida. Se recomienda que el anfitrión pueda iniciar con entre 2 y `maxPlayers` jugadores y que se pueda ofrecer auto-inicio solo al alcanzar `maxPlayers`.

El valor de `maxPlayers` aún no está fijado por producto. El servidor debe tener un límite superior prudente aunque el valor sea configurable; por ejemplo, 8 es una primera opción operativa, pero no debe codificarse como parte de la lógica del juego.

### Ronda y estado individual

```ts
type RoundStatus = 'choosing-word' | 'guessing' | 'round-over'

type PlayerRoundStatus =
  | 'setter'
  | 'playing'
  | 'awaiting-forgiveness'
  | 'solved'
  | 'failed'
  | 'eliminated'

type PlayerRoundState = {
  playerId: string
  status: PlayerRoundStatus
  guessedLetters: string[]
  wrongLetters: string[]
  errors: number
  forgiven: boolean
  startedAt: number | null
  finishedAt: number | null
  resolutionTimeMs: number | null
  roundRank: number | null
}

type RoundState = {
  id: string
  number: number
  voltaNumber: number
  setterId: string
  secretWord: string | null
  status: RoundStatus
  playerStates: Record<string, PlayerRoundState>
  forgivenessRequests: Record<string, ForgivenessRequest>
  startedAt: number | null
  finishedAt: number | null
  ranking: string[]
}
```

`secretWord` sigue siendo un secreto del servidor. `playerStates` contiene el tablero completo de cada adivinador. El setter tiene una vista observada de uno de ellos, nunca una lista de N tableros completos en la UI.

### Forgiveness request

```ts
type ForgivenessRequest = {
  id: string
  roundId: string
  playerId: string
  setterId: string
  errorsAtRequest: number
  status: 'pending' | 'granted' | 'denied' | 'expired'
  createdAt: number
  decidedAt: number | null
}
```

El `requestId` es obligatorio para que el setter pueda decidir una petición concreta. `forgiven` debe ser permanente dentro de la ronda. Al conceder:

- los errores no disminuyen;
- el estado vuelve a `playing`;
- se permite la oportunidad adicional definida por la regla del producto, propuesta aquí como un máximo efectivo de `MAX_ERRORS + 1`;
- no se crea una segunda petición para el mismo jugador en esa ronda.

Así, un jugador perdonado conserva, por ejemplo, 6 errores y puede terminar con 7, y queda naturalmente detrás de alguien que resolvió con 0-5 errores. Si se quiere permitir más de una vida, debe modelarse como contador explícito, no reutilizando un booleano.

### Puntuación y ranking

El ranking de ronda y el score de match deben ser datos distintos:

1. Todo jugador que resuelve queda por encima de todo jugador que no resuelve.
2. Entre quienes resuelven, se ordena por `errors` ascendente y después `resolutionTimeMs` ascendente.
3. Los empates exactos se rompen con el orden fijo de la sala para obtener una clasificación determinista.
4. Entre quienes no resuelven, se aplica el mismo orden de errores y tiempo; un estado `failed`/`eliminated` puede funcionar como último desempate.

Para preservar el comportamiento numérico del 1v1, la propuesta de score acumulado es por duelo de cada adivinador: cada jugador que resuelve obtiene 1 punto; por cada jugador que termina sin resolver, el setter obtiene 1 punto. En N jugadores eso permite varios puntos en una misma ronda y, cuando N=2, produce exactamente el esquema actual de “gana el guesser o gana el setter”. La partida no termina al alcanzar un score: termina tras `maxPlayers * voltes` turnos.

Si producto prefiere puntos por posición en el ranking, hay que sustituir esta regla antes de implementar el resultado final; no conviene mezclar score de match con `roundRank`.

### Vistas y privacidad

La respuesta de `room:state` debe construirse por socket con, como mínimo, estas secciones:

```ts
type PublicPlayerSummary = {
  id: string
  name: string
  score: number
  connectionState: ConnectionState
  roundStatus: 'setter' | 'playing' | 'solved' | 'awaiting-forgiveness' | 'failed' | 'eliminated'
}

type PrivatePlayerRoundView = PlayerRoundState & {
  displayWord: string[]
}

type PlayerGameView = {
  room: { code: string; language: Language; status: RoomStatus; voltes: number; maxPlayers: number }
  match: MatchState
  round: { id: string; number: number; voltaNumber: number; setterId: string; status: RoundStatus }
  players: PublicPlayerSummary[]
  self: PrivatePlayerRoundView
  observedPlayerId: string | null
  observedPlayer?: PrivatePlayerRoundView
  forgivenessRequests: ForgivenessRequest[]
  privateWord?: string
  result?: { ranking: string[]; matchScores: Record<string, number> }
}
```

Los adivinadores reciben su propio estado completo, los resúmenes públicos y solo la información de perdón que la política de UX haga visible. Nunca reciben `guessedLetters`, `wrongLetters`, `errors`, `displayWord` o `resolutionTimeMs` de otro jugador. El setter puede recibir `observedPlayer` únicamente para el jugador seleccionado, validando que sea un participante distinto y que él sea el setter actual.

El servidor debe conservar el estado observado por socket o por jugador conectado, no como propiedad global de la ronda: dos setters futuros o una reconexión no deben cambiar lo que ve otro socket. La selección no altera el juego.

## 6. Máquinas de estados propuestas

### Sala

```text
waiting --owner starts with >= 2--> active
active --all turns of all voltes resolved--> match-over
active --permanent member departure / explicit abort--> aborted
match-over --all eligible players request rematch--> active
waiting/aborted --no members--> closed
```

`disconnected` no debe ser una fase de sala: es una propiedad de conectividad del jugador. Mientras la sala está `active`, un jugador puede estar `reconnecting` sin hacer que todos los demás pierdan su estado.

### Ronda

```text
active + next setter -> choosing-word
choosing-word --setter submits valid word--> guessing
guessing --each player resolves or is eliminated--> round-over
round-over --next setter continues--> choosing-word
round-over + last turn completed--> match-over
```

La transición a `round-over` debe ser atómica y solo cuando todos los jugadores no setter están en estado terminal (`solved`, `failed` o `eliminated`). El setter no tiene tablero de adivinanza en esa ronda.

### Estado individual

```text
playing --word complete--> solved
playing --MAX_ERRORS reached--> awaiting-forgiveness
awaiting-forgiveness --grant--> playing (forgiven=true, errors unchanged)
awaiting-forgiveness --deny--> failed
playing after grant --extra limit reached--> eliminated
playing/awaiting-forgiveness --permanent leave--> eliminated or match aborted (policy)
```

Una adivinanza solo muta el estado del jugador que la envía. Las letras repetidas son idempotentes para ese jugador y no pueden afectar el contador de otro.

### Solicitud de perdón

```text
none --player reaches limit--> pending
pending --setter grants--> granted
pending --setter denies--> denied
pending --round/member policy timeout--> expired
```

Puede haber cualquier número de solicitudes `pending` en la misma ronda. Una decisión valida el `requestId`, el `roundId`, el setter actual y que la petición siga pendiente. No existe una fase global que impida que los demás jugadores adivinen.

## 7. Eventos Socket.IO

### Eventos que se modifican

- `room:create`: sustituir `matchTarget` por `{ voltes, maxPlayers }`; validar enteros, límites y que el idioma sea válido.
- `room:join`: igual, pero solo mientras la sala esté `waiting` y no haya alcanzado `maxPlayers`.
- `room:resume`: devolver la vista privada reconstruida para ese jugador y su estado individual intacto.
- `round:forgiveness`: cambiar a `{ requestId, forgive }`; el servidor obtiene el setter y el jugador solicitante desde el estado de la ronda.
- `round:continue`: autorizar al `nextSetterId` cuando la ronda esté completa. Esto conserva en N=2 el comportamiento actual del antiguo guesser y evita que N clientes avancen la misma ronda.
- `match:rematch`: añadir la identidad del miembro desde el socket; el match empieza cuando todos los jugadores elegibles hayan confirmado.
- `room:state`: conservar el nombre del evento, pero cambiar el payload por la vista por receptor descrita arriba.
- `RoomPreview`: incluir `voltes`, `maxPlayers`, `players`, estado de sala y si aún admite entradas.

### Eventos nuevos

- `room:start`: acción del anfitrión para cerrar el lobby y comenzar el primer turno.
- `round:observe-player`: `{ playerId: string }`, solo setter; cambia la selección de observación de ese socket.
- Opcionalmente `room:rematch-cancel` si la UI debe permitir retirar una confirmación; si no se necesita, no añadirlo.

El evento de observación puede responder con ACK y una vista privada dirigida a ese socket; no debe emitirse como estado completo a toda la sala. Las actualizaciones de juego sí deben seguir el patrón actual de emitir una vista individual a cada socket conectado.

### Eventos que pueden mantenerse

`round:set-word`, `game:guess`, `chat:send`, `chat:react`, `chat:typing` y `room:leave` pueden conservar sus nombres. Sus validaciones y payloads de chat no necesitan cambiar por N jugadores. `chat:typing` debe representarse en cliente como `Map<playerId, playerName>` en lugar de una sola variable.

No se deben aceptar `playerId` o `setterId` del cliente para autorizar acciones. Esos campos pueden aparecer en una respuesta, pero la fuente de verdad debe ser el socket autenticado y el estado de la sala.

## 8. Estrategia de migración sin romper 1v1

1. **Caracterización.** Añadir tests de contrato para documentar el flujo actual 1v1: roles iniciales, alternancia, privacidad, perdón, reconexión, puntuación, chat y revancha. Ejecutarlos contra la implementación actual antes de mover el dominio.
2. **Tipos y motor puro.** Introducir los tipos de match/ronda/estado individual y extraer funciones puras para crear una ronda, aplicar una adivinanza, resolver un perdón, calcular ranking y avanzar el turno. En esta etapa no cambiar la UX.
3. **Generalizar `GameRoom`.** Sustituir los singleton por el nuevo modelo. La misma ruta con `turnOrder.length === 2` debe producir el 1v1; no crear `GameRoom2` ni una rama de juego distinta. Puede existir un adaptador temporal de vista para que el cliente antiguo compile durante la transición.
4. **Cambiar duración.** Añadir `voltes` y retirar la lógica de objetivo `3/5/10` y de parejas mediante `roundNumber % 2`. Como las salas son volátiles y no se persisten, no hay que migrar datos almacenados en disco. Durante un despliegue coordinado se puede rechazar una sesión antigua con un error de versión y pedir al cliente que vuelva al lobby.
5. **Cambiar contrato de privacidad.** Implementar primero `viewFor` por receptor con `self`, `observedPlayer` y solicitudes. Añadir tests que inspeccionen el objeto serializado, no solo la pantalla, para garantizar que los campos prohibidos no viajan.
6. **Capacidad y lobby.** Añadir `maxPlayers`, anfitrión, `room:start`, cierre de admisión y preview. El cliente podrá seguir mostrando el flujo 1v1 por defecto mientras se incorpora el selector de N.
7. **Cliente N-player.** Reemplazar las condiciones `isSetter/isGuesser` singleton por una vista propia y una vista observada. Mantener `HangmanDrawing`, `HangmanWord`, `Keyboard` y `RoomChat` como componentes reutilizables, pero eliminar el teclado y los controles de guess del setter.
8. **Perdones y bandeja móvil.** Implementar la colección de solicitudes y una bandeja persistente por encima del chat. La bandeja debe ser visible aunque el chat tenga scroll; cada decisión debe apuntar a un request concreto.
9. **Reconexión, salida y rematch.** Aplicar reglas por jugador, probar reconexión simultánea y decidir la política de salida permanente antes de habilitar partidas largas. El rematch debe reiniciar todos los estados de ronda y scores, conservando idioma, `voltes`, chat y roster elegible.
10. **Retirada de compatibilidad.** Cuando cliente y servidor usen el nuevo contrato, eliminar `MatchTarget`, `guesserId`, los campos de tablero globales y los textos 1v1 que ya no tengan uso. Actualizar README, invitaciones y traducciones.

El cambio de `matchTarget` a `voltes` no puede preservar literalmente cuándo terminaba una partida antigua: el producto ha decidido que la duración sea `N * voltes`. Lo que sí debe preservarse en N=2 es el rol alterno, el secreto de la palabra, la autorización, el comportamiento de acierto/error, el chat y la posibilidad de revancha.

## 9. Casos límite a cubrir

- Intentar entrar cuando la sala está llena, ya inició, fue abortada o está en `match-over`.
- Iniciar con menos de 2 jugadores, doble `room:start` y dos jugadores intentando iniciar a la vez.
- `N = 2`, `N = 3` y un valor mayor; `voltes = 1` y varias vueltas; cada combinación debe producir exactamente `N * voltes` palabras.
- El setter inicial elegido aleatoriamente y la rotación circular sin repetir ni saltar jugadores.
- Una palabra con letras acentuadas, `Ñ`, `Ç`, espacios, apóstrofes y guiones, manteniendo la normalización actual por jugador.
- Dos o más jugadores acertando casi simultáneamente; el servidor debe serializar las mutaciones y asignar tiempos/ranking deterministas.
- Un jugador que repite una letra mientras otro jugador comete un error: ningún estado puede cruzarse.
- Varios jugadores alcanzando seis errores en la misma ronda y generando solicitudes de perdón independientes.
- Conceder, denegar, repetir o decidir una solicitud ya resuelta; solicitudes de otra ronda o de otra sala.
- Resolver después de un perdón conservando todos los errores y sin permitir una segunda vida accidental.
- Un setter desconectado mientras se elige palabra, mientras hay solicitudes pendientes o después de que ya se haya fijado la palabra.
- Un adivinador desconectado mientras los demás continúan, reconexión antes de 25 s y expiración después de la gracia.
- Salida voluntaria del setter, salida durante el lobby, transferencia de anfitrión y abandono durante `match-over`.
- Un jugador que intenta observar a otro sin ser setter o intenta observar dos tableros mediante payload manipulado.
- Verificar que un adivinador no recibe letras, progreso, errores ni tiempos de otros jugadores, incluso en eventos de estado posteriores.
- Todos los miembros confirmando rematch, doble click, un miembro que abandona después de confirmar y reset completo de la ronda.
- Historial/chat/reacciones con N jugadores y varios indicadores de typing simultáneos.
- Reconexión con token válido, token ajeno, socket antiguo sustituido y sesión de una sala eliminada.

La política recomendada para una salida permanente durante un match es abortar la partida activa y no adjudicar puntos automáticamente: el roster de una vuelta es un snapshot y continuar quitando jugadores a mitad del ciclo hace ambiguo el requisito de “cada jugador exactamente una vez”. Si producto quiere mantener la partida, debe decidir explícitamente si el jugador saliente cuenta como eliminado y si su turno futuro se salta.

## 10. Tests actuales y tests requeridos

### Cobertura existente

- [`scripts/forgiveness-test.mjs`](../scripts/forgiveness-test.mjs): perdón, errores acumulados durante el flujo actual y privacidad básica.
- [`scripts/lifecycle-test.mjs`](../scripts/lifecycle-test.mjs): marcar reconexión, reanudar, preservar tablero y eliminar al jugador tras la gracia simulada.
- [`scripts/match-features-test.mjs`](../scripts/match-features-test.mjs): roles aleatorios, objetivo, pareja de rondas, empate, adelantamiento, ilimitado y rematch.
- [`scripts/chat-test.mjs`](../scripts/chat-test.mjs): validación, historial limitado, reacciones, reconexión y aislamiento de mensajes.
- [`scripts/e2e.mjs`](../scripts/e2e.mjs): capacidad 2, preview, privacidad de palabra, autorización, ciclo de ronda, perdón, puntuación y cambio de roles por Socket.IO.

Estas pruebas describen bien el contrato 1v1 actual, pero no pueden detectar aislamiento entre adivinadores porque solo crean dos participantes.

### Tests que deben existir antes de Fase 2

- Contrato de `N=2` sobre el motor actual: conservar la regresión antes de modificar `GameRoom`.
- Tests de tipos/protocolo para `voltes`, `maxPlayers`, `room:start`, vistas por receptor y `requestId`.

### Tests de Fase 2

1. **Turnos y duración:** para N=2, 3 y 5, con 1 y 3 vueltas, comprobar exactamente `N * voltes` turnos y que cada jugador sea setter una vez por vuelta.
2. **Adivinanzas aisladas:** misma palabra para todos; letras, errores, progreso, estados, tiempos y terminación independientes.
3. **Ranking:** acertados antes que no acertados; después errores y tiempo; desempate estable; jugador perdonado conserva sus errores y queda en el orden esperado.
4. **Forgiveness:** varias solicitudes pendientes, decisiones en cualquier orden, autorización solo del setter, request duplicado y segunda vida no autorizada.
5. **Privacidad:** comparar `viewFor` para cada miembro y asegurar que solo el setter recibe el jugador observado solicitado; probar también eventos de broadcast y reconexión.
6. **Admisión/lobby:** capacidad, inicio del anfitrión, cierre de entradas al empezar, transferencia o abandono del anfitrión y preview correcto.
7. **Concurrencia/idempotencia:** dos guesses simultáneos, dos decisiones simultáneas, doble continue, doble rematch y mensajes duplicados.
8. **Conectividad:** un adivinador desconectado no bloquea a los demás; setter desconectado aplica la política elegida; resume conserva solo el estado del jugador correcto.
9. **Rematch:** consenso de todos los miembros elegibles, reset de scores/turnos/solicitudes, persistencia de idioma/voltes/chat y nuevo orden de inicio.
10. **Chat:** N remitentes, reacciones, varios typing y ningún evento entre salas distintas.
11. **End-to-end:** levantar un servidor real con al menos cinco clientes y validar que el contenido prohibido nunca aparece en los payloads de los adivinadores.
12. **Propiedades del motor:** para una secuencia arbitraria de acciones válidas, no duplicar letras, no superar el límite sin perdón, no tener dos setters y no avanzar antes de que todos los adivinadores estén terminales.

No se requieren nuevas dependencias para esta estrategia. Las pruebas pueden seguir usando Node/TypeScript, `assert` y los clientes Socket.IO ya presentes.

## Recommended Phase 2 implementation

1. Añadir los tipos de `RoomConfig`, `MatchState`, `RoundState`, `PlayerRoundState` y `ForgivenessRequest` en `shared/protocol.ts`, manteniendo temporalmente un contrato de compatibilidad claramente marcado.
2. Crear un motor puro de ronda con tests para adivinanzas, estados terminales, perdón, ranking, score y avance circular.
3. Refactorizar `GameRoom` para usar el motor y eliminar `secretWord`, `guesses`, `errorCount`, `guesserId` y la fase global de perdón.
4. Cambiar `matchTarget` por `voltes`, introducir `maxPlayers`, `ownerId`, `room:start` y cierre de admisión.
5. Implementar vistas `self`/`observedPlayer` por socket y el evento `round:observe-player`; añadir pruebas explícitas de privacidad.
6. Generalizar `game:guess`, final de ronda y rematch para todos los miembros, conservando el mismo flujo cuando el roster contiene dos jugadores.
7. Rehacer la pantalla de partida alrededor de un tablero propio, un jugador observado, resumen compacto, bandeja persistente de perdones y chat; retirar teclado/controles del setter.
8. Generalizar reconexión, typing, invitaciones y mensajes para N jugadores y aplicar la política de salida permanente acordada.
9. Ejecutar build, lint, todas las suites existentes y las nuevas suites N-player; actualizar README y traducciones.
10. Eliminar los alias temporales 1v1 del protocolo y del cliente cuando el contrato nuevo esté desplegado y cubierto por pruebas.
