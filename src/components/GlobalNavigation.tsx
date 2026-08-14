type Props = {
  showBack: boolean
  backLabel: string
  onBack: () => void
}

export function GlobalNavigation({ showBack, backLabel, onBack }: Props) {
  return (
    <div className="global-navigation" aria-hidden="false">
      {showBack ? (
        <button type="button" className="global-back-button" aria-label={backLabel} title={backLabel} onClick={onBack}>
          <span aria-hidden="true">←</span>
        </button>
      ) : <span className="global-navigation-spacer" aria-hidden="true" />}
    </div>
  )
}
