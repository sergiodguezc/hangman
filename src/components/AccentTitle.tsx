/** Lovable-style display heading: the last word in the italic accent colour. The text content is unchanged. */
export function AccentTitle({ text }: { text: string }) {
  const split = text.lastIndexOf(' ')
  if (split < 0) return <em>{text}</em>
  return <>{text.slice(0, split + 1)}<em>{text.slice(split + 1)}</em></>
}
