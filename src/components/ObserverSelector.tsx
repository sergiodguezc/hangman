import { useEffect, useRef } from 'react'
import type { PublicPlayer } from '../../shared/protocol'
import type { MultiplayerTranslations } from '../multiplayer/i18n'

type Props = {
  players: PublicPlayer[]
  selectedPlayerId: string | null
  t: MultiplayerTranslations
  onSelect: (playerId: string) => void
}

export function ObserverSelector({ players, selectedPlayerId, t, onSelect }: Props) {
  const tabsRef = useRef<HTMLDivElement>(null)
  const selectablePlayers = players.filter((player) => player.active)

  useEffect(() => {
    if (!selectedPlayerId) return
    const selectedTab = tabsRef.current?.querySelector<HTMLButtonElement>(`[data-player-id="${CSS.escape(selectedPlayerId)}"]`)
    selectedTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selectedPlayerId])

  if (!selectablePlayers.length) return null

  const moveSelection = (index: number) => {
    const player = selectablePlayers[index]
    if (!player) return
    onSelect(player.id)
    tabsRef.current?.querySelector<HTMLButtonElement>(`[data-player-id="${CSS.escape(player.id)}"]`)?.focus()
  }

  return <nav className="observer-selector" aria-label={t.selectPlayer}>
    <div className="observer-tabs" ref={tabsRef} role="tablist">
      {selectablePlayers.map((player) => <button
        type="button"
        role="tab"
        key={player.id}
        data-player-id={player.id}
        aria-selected={selectedPlayerId === player.id}
        aria-label={player.name}
        title={player.name}
        tabIndex={selectedPlayerId === player.id ? 0 : -1}
        className={selectedPlayerId === player.id ? 'active' : ''}
        onKeyDown={(event) => {
          const currentIndex = selectablePlayers.findIndex((candidate) => candidate.id === player.id)
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault(); moveSelection((currentIndex + 1) % selectablePlayers.length)
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault(); moveSelection((currentIndex - 1 + selectablePlayers.length) % selectablePlayers.length)
          } else if (event.key === 'Home') {
            event.preventDefault(); moveSelection(0)
          } else if (event.key === 'End') {
            event.preventDefault(); moveSelection(selectablePlayers.length - 1)
          }
        }}
        onClick={() => onSelect(player.id)}
      >{player.name}</button>)}
    </div>
  </nav>
}
