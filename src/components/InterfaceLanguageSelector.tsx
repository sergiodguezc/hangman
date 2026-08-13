import type { Language } from '../../shared/game'
import { LanguageSelector } from './LanguageSelector'

type Props = {
  language: Language
  onChange: (language: Language) => void
}

export function InterfaceLanguageSelector({ language, onChange }: Props) {
  return (
    <div className="interface-language-toggle" aria-label="Interface language">
      <LanguageSelector language={language} label="Interface language" onChange={onChange} variant="codes" />
    </div>
  )
}
