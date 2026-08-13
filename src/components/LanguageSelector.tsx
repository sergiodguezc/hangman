import { languages, type Language } from '../game/languages'

type Props = { language: Language; label: string; onChange: (language: Language) => void; variant?: 'names' | 'codes' }

export function LanguageSelector({ language, label, onChange, variant = 'names' }: Props) {
  const codes: Language[] = ['ca', 'es']
  return (
    <fieldset className={`language-selector language-selector--${variant}`}>
      <legend className="sr-only">{label}</legend>
      <div className="language-options">
        {codes.map((code, index) => (
          <span key={code} className="language-option-wrap">
            {index > 0 && variant === 'codes' && <span className="language-separator" aria-hidden="true">/</span>}
            <button type="button" className={`${language === code ? 'active' : ''}${code === 'es' ? ' secondary' : ''}`}
              aria-pressed={language === code} lang={code} onClick={() => onChange(code)}>
              {variant === 'codes' ? code.toUpperCase() : languages[code].name}
            </button>
          </span>
        ))}
      </div>
    </fieldset>
  )
}
