import type { Language } from '../../shared/game'
import { navigationTranslations } from '../navigation/i18n'
import { LanguageSelector } from './LanguageSelector'

type Props = {
  language: Language
  onChange: (language: Language) => void
  className?: string
}

export function InterfaceLanguageSelector({ language, onChange, className = 'interface-language-toggle' }: Props) {
  const label = navigationTranslations[language].interfaceLanguage
  return (
    <div className={className}>
      <LanguageSelector language={language} label={label} onChange={onChange} variant="codes" />
    </div>
  )
}
