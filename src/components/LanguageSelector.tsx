import { languages, type Language } from '../game/languages'

type Props = { language: Language; label: string; onChange: (language: Language) => void }

export function LanguageSelector({ language, label, onChange }: Props) {
  return (
    <fieldset className="language-selector">
      <legend>{label}</legend>
      <div className="language-options">
        {(['ca', 'es'] as Language[]).map((code) => (
          <button key={code} type="button" className={`${language === code ? 'active' : ''}${code === 'es' ? ' secondary' : ''}`}
            aria-pressed={language === code} lang={code} onClick={() => onChange(code)}>
            {languages[code].name}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
