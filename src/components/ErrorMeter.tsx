import { MAX_ERRORS } from '../../shared/game'

/** Lovable's remaining-lives diamonds. Decorative: the adjacent "n / 6" count is the accessible value. */
export function ErrorMeter({ errors }: { errors: number }) {
  return <span className="error-meter" aria-hidden="true">
    {Array.from({ length: MAX_ERRORS }, (_, index) => <i key={index} className={index < MAX_ERRORS - errors ? 'left' : undefined} />)}
  </span>
}
