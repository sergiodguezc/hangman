import type { Language } from '../../shared/game'
import type { VocabularyEntry } from '../learning/types'
import { dailyWordPool } from './words'
import type { DailyResult } from './game'

export const DAILY_CHALLENGE_EPOCH = '2026-08-16'
export const DAILY_CHALLENGE_TIME_ZONE = 'Europe/Madrid'
export const DAILY_CHALLENGE_ROUTE = '/paraula-del-dia/'
export const DAILY_CHALLENGE_PUBLIC_PATH = '/paraula-del-dia'

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DAILY_CHALLENGE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const displayDateFormatters: Record<Language, Intl.DateTimeFormat> = {
  ca: new Intl.DateTimeFormat('ca-ES', { timeZone: DAILY_CHALLENGE_TIME_ZONE, day: 'numeric', month: 'long' }),
  es: new Intl.DateTimeFormat('es-ES', { timeZone: DAILY_CHALLENGE_TIME_ZONE, day: 'numeric', month: 'long' }),
}

export type DailyChallenge = {
  id: string
  number: number
  dateKey: string
  displayDate: Record<Language, string>
  entry: VocabularyEntry
}

export function getMadridDateKey(date = new Date()): string {
  return dateFormatter.format(date)
}

export function daysBetweenDateKeys(startKey: string, endKey: string): number {
  return dateKeyToUtcDay(endKey) - dateKeyToUtcDay(startKey)
}

export function getDailyChallenge(date = new Date(), pool: readonly VocabularyEntry[] = dailyWordPool): DailyChallenge {
  if (!pool.length) throw new Error('Daily challenge word pool is empty.')
  const dateKey = getMadridDateKey(date)
  const dayIndex = daysBetweenDateKeys(DAILY_CHALLENGE_EPOCH, dateKey)
  const normalizedIndex = modulo(dayIndex, pool.length)
  return {
    id: dateKey,
    number: dayIndex + 1,
    dateKey,
    displayDate: {
      ca: displayDateFormatters.ca.format(date),
      es: displayDateFormatters.es.format(date),
    },
    entry: pool[normalizedIndex],
  }
}

export function getDailyChallengeUrl(origin: string): string {
  return new URL(DAILY_CHALLENGE_PUBLIC_PATH, origin).href
}

export function formatDailyShareText(input: {
  language: Language
  challengeNumber: number
  result: DailyResult
  errors: number
  url: string
}): string {
  const won = input.result === 'win'
  const title = input.language === 'ca'
    ? `PENJAT - Paraula del dia #${input.challengeNumber}`
    : `PENJAT - Palabra del día #${input.challengeNumber}`
  const result = input.language === 'ca'
    ? `${won ? '🟩 Victòria' : '💀 Derrota'}`
    : `${won ? '🟩 Victoria' : '💀 Derrota'}`
  const errors = input.language === 'ca'
    ? `❌ ${input.errors} ${input.errors === 1 ? 'error' : 'errors'}`
    : `❌ ${input.errors} ${input.errors === 1 ? 'error' : 'errores'}`
  return `${title}\n\n${result}\n${errors}\n\n${input.url}`
}

export function formatDailyShareData(input: Parameters<typeof formatDailyShareText>[0]): ShareData {
  const title = input.language === 'ca'
    ? `Paraula del dia #${input.challengeNumber}`
    : `Palabra del día #${input.challengeNumber}`
  return {
    title,
    text: formatDailyShareText(input),
  }
}

function dateKeyToUtcDay(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return Math.trunc(Date.UTC(year, month - 1, day) / 86_400_000)
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}
