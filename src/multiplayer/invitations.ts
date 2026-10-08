const ROOM_CODE_PATTERN = /^[A-Z2-9]{5}$/

// null means no invitation; an empty string is an invalid invitation and must
// still show its error instead of silently restoring an unrelated room.
export function shouldResumeRoomSession(roomCode: string, invitationCode: string | null): boolean {
  return invitationCode === null || invitationCode === roomCode
}

export function normalizeInvitationCode(value: string | null) {
  const code = value?.trim().toUpperCase().replace(/[^A-Z2-9]/g, '') ?? ''
  return ROOM_CODE_PATTERN.test(code) ? code : ''
}

export function invitationUrl(origin: string, roomCode: string) {
  const code = normalizeInvitationCode(roomCode)
  const url = new URL('/multijugador/', origin)
  if (code) url.searchParams.set('sala', code)
  return url.href
}
