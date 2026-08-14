import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { ALPHABETS, normalizeGuess } from '../../shared/game'
import type { Ack, ChatMessage, PlayerGameView } from '../../shared/protocol'
import { HangmanDrawing } from '../components/HangmanDrawing'
import { Keyboard } from '../components/Keyboard'
import { Scoreboard } from '../components/Scoreboard'
import { RoomChat } from '../components/RoomChat'
import { getLanguageConfig } from '../game/languages'
import { errorMessage, multiplayerTranslations } from '../multiplayer/i18n'
import { socket } from '../multiplayer/socket'

type Props = { state: PlayerGameView; interfaceLanguage: 'ca' | 'es'; messages: ChatMessage[]; playerId: string; typingPlayer: { playerId: string; playerName: string } | null }

function groupDisplayWord(characters: string[]) {
  const words: { start: number; characters: string[] }[] = []
  let start = 0
  let current: string[] = []
  characters.forEach((character, index) => {
    if (character === ' ') {
      if (current.length) words.push({ start, characters: current })
      current = []
      start = index + 1
    } else {
      if (!current.length) start = index
      current.push(character)
    }
  })
  if (current.length) words.push({ start, characters: current })
  return words
}

export function GamePage({ state, interfaceLanguage, messages, playerId, typingPlayer }: Props) {
  const [word, setWord] = useState('')
  const [error, setError] = useState('')
  const t = multiplayerTranslations[interfaceLanguage]
  const config = getLanguageConfig(state.gameLanguage)
  const isSetter = state.wordSetterId === playerId
  const isGuesser = state.guesserId === playerId
  const playersById = new Map(state.players.map((player) => [player.id, player]))
  const setter = state.wordSetterId ? playersById.get(state.wordSetterId) : undefined
  const winner = state.roundWinnerId ? playersById.get(state.roundWinnerId) : undefined
  const matchWinner = state.matchWinnerId ? playersById.get(state.matchWinnerId) : undefined
  const targetReachedPlayer = state.targetReachedPlayerId ? playersById.get(state.targetReachedPlayerId) : undefined
  const rematchRequested = state.rematchReadyPlayerIds.includes(playerId)
  const opponentRequested = state.rematchReadyPlayerIds.some((id) => id !== playerId)
  const guessed = new Set(state.guessedLetters)
  const wrong = new Set(state.wrongLetters)
  const displayWords = groupDisplayWord(state.displayWord)
  const wordSizing = { '--longest-word': Math.max(1, ...displayWords.map(({ characters }) => characters.length)) } as CSSProperties

  const handleAck = useCallback((response: Parameters<Ack>[0]) => {
    if (!response.ok) setError(errorMessage(response.error, t))
  }, [t])
  const guess = useCallback((letter: string) => {
    if (!isGuesser || state.phase !== 'guessing') return
    socket.emit('game:guess', { letter }, handleAck)
  }, [handleAck, isGuesser, state.phase])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return
      const target = event.target
      if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return
      const normalized = normalizeGuess(event.key, state.gameLanguage)
      if (normalized) guess(normalized)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [guess, state.gameLanguage])

  const submitWord = (event: FormEvent) => {
    event.preventDefault(); setError('')
    socket.emit('round:set-word', { word }, (response) => { handleAck(response); if (response.ok) setWord('') })
  }

  if (state.phase === 'disconnected') return <main className="disconnect-page"><section>
    <span className="disconnect-icon">!</span><h1>{t.disconnected}</h1><p>{state.disconnectedPlayerName}</p>
  </section></main>

  const reconnectingOpponent = state.players.find((player) => player.id !== playerId && player.connectionState === 'reconnecting')

  return <main className="match-page" lang={interfaceLanguage}>
    <header className="match-header">
      <div className="brand compact"><span className="brand-mark">P</span><h1>{t.title}</h1></div>
      <div className="match-meta"><span>{t.roomCode} <b>{state.code}</b></span><span>{t.round} <b>{state.roundNumber}</b></span><span>{t.matchObjective.replace('{target}', state.matchTarget === null ? t.unlimited.toLocaleLowerCase(interfaceLanguage) : t.points.replace('{target}', String(state.matchTarget)))}</span><span>{config.name}</span></div>
    </header>
    <div className="match-layout">
      <Scoreboard players={state.players} setterId={state.wordSetterId} guesserId={state.guesserId} currentId={playerId} t={t} />
      <section className="multiplayer-game">
        {reconnectingOpponent && <div className="form-error" role="status">{t.opponentReconnecting}</div>}
        {!reconnectingOpponent && state.reconnectedPlayerName && state.reconnectedPlayerName !== playersById.get(playerId)?.name && <div className="role-line" role="status">{t.opponentReconnected}</div>}
        {state.matchEndingPending && <div className="role-line" role="status">{targetReachedPlayer?.id === playerId ? t.targetReached.replace('{player}', targetReachedPlayer.name) : t.opponentReachedFinalRound}</div>}
        {state.phase === 'choosing-word' && <>{state.roundNumber === 1 && <div className="role-line" role="status">{isSetter ? t.youStart : t.playerStarts.replace('{player}', setter?.name ?? '')}</div>}{isSetter ? <form className="word-form" onSubmit={submitWord}>
          <span className="role-badge setter">✎ {t.chooseWord}</span>
          <input type="text" autoFocus maxLength={50} value={word} placeholder={t.secretPlaceholder}
            autoComplete="off" spellCheck={false} onChange={(e) => setWord(e.target.value)} />
          <p className="word-privacy">{t.wordPrivacy}</p>
          <button className="primary-action">{t.startRound}</button>
        </form> : <div className="phase-message"><div className="thinking">•••</div><h2>{setter?.name} {t.rivalChoosing}</h2></div>}</>}

        {(state.phase === 'guessing' || state.phase === 'forgiveness-pending' || state.phase === 'round-over') && <>
          <div className="role-line">{state.phase === 'round-over' ? `${winner?.name} ${t.winner}` : state.phase === 'forgiveness-pending' ? (isSetter ? t.finalErrorSetter : t.finalErrorGuesser) : isGuesser ? t.yourGuess : t.youChose}</div>
          <div className="game-columns"><div className="drawing-panel"><HangmanDrawing errors={state.errors} label={t.errors} />
            <div className="error-copy"><span>{t.errors}</span><strong>{state.errors} / 6</strong></div></div>
            <div className="guess-area">
              <div className="multiplayer-word-scroll" tabIndex={0} style={wordSizing} aria-label={config.translations.progressLabel}>
                <div className="multiplayer-word">{displayWords.map(({ start, characters }) =>
                  <span className="multiplayer-word-group" key={start}>{characters.map((character, offset) =>
                    <span key={start + offset} className={character === '_' ? 'blank' : normalizeGuess(character, state.gameLanguage) ? 'letter' : 'punctuation'}>{character === '_' ? '\u00a0' : character}</span>)}</span>)}</div>
              </div>
              {isSetter && state.phase === 'guessing' && <p className="setter-secret">{t.youChose}: <strong>{state.privateWord}</strong></p>}
              {state.phase === 'forgiveness-pending' && isSetter && <div className="forgiveness-panel" role="group" aria-label={t.forgivenessQuestion}>
                <strong>{t.forgivenessQuestion}</strong>
                <div><button className="forgive-action" onClick={() => socket.emit('round:forgiveness', { forgive: true }, handleAck)}>{t.forgive}</button>
                  <button className="deny-action" onClick={() => socket.emit('round:forgiveness', { forgive: false }, handleAck)}>{t.doNotForgive}</button></div>
              </div>}
              {state.phase === 'forgiveness-pending' && isGuesser && <div className="forgiveness-wait" role="status">
                <strong>{t.finalErrorGuesser}</strong><span>{t.waitingForgiveness}</span>
              </div>}
              {state.phase === 'round-over' && <div className="round-result"><strong>{winner?.name} {t.winner}</strong><span>{t.wordWas}: {state.privateWord}</span></div>}
              <div className="incorrect-list"><span>{t.incorrect}</span><strong>{state.wrongLetters.length ? state.wrongLetters.join(' · ') : t.none}</strong></div>
              <Keyboard alphabet={ALPHABETS[state.gameLanguage]} guesses={guessed} incorrect={wrong} disabled={!isGuesser || state.phase !== 'guessing'} label={t.keyboard} onGuess={guess} />
              {state.phase === 'round-over' && isGuesser && <button className="primary-action" onClick={() => socket.emit('round:continue', handleAck)}>{t.next}</button>}
              {state.phase === 'round-over' && !isGuesser && <p className="continue-note">{playersById.get(state.guesserId ?? '')?.name} · {t.next}</p>}
            </div></div>
        </>}
        {state.phase === 'match-over' && <div className="match-result">
          <span className="role-badge">{state.matchResult?.kind === 'draw' ? t.draw : matchWinner?.id === playerId ? t.matchWon : t.matchLost}</span>
          <h2>{state.matchResult?.kind === 'draw' ? t.matchDraw : matchWinner?.name}</h2><strong>{t.finalScore}</strong>
          <div className="final-scores">{[...state.players].sort((a, b) => b.score - a.score).map((player) => <span key={player.id}>{player.name}<b>{player.score}</b></span>)}</div>
          {!rematchRequested && <button className="primary-action" onClick={() => socket.emit('match:rematch', handleAck)}>{t.rematch}</button>}
          {rematchRequested && <p>{t.waitingRematch}</p>}
          {opponentRequested && !rematchRequested && <p>{t.opponentWantsRematch}</p>}
        </div>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
      <RoomChat messages={messages} currentPlayerId={playerId} typingPlayer={typingPlayer} t={t} />
    </div>
  </main>
}
