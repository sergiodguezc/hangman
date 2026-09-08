import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { once } from 'node:events'
import { spawn } from 'node:child_process'

const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8')
assert.equal([...sitemap.matchAll(/https:\/\/penjat\.cat\/paraula-del-dia/g)].length, 1)

const port = 3205
const server = spawn(process.execPath, ['dist-server/server/server.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})

try {
  await once(server.stdout, 'data')
  const home = await fetchText(`http://127.0.0.1:${port}/`)
  assert.match(home, /<title>Penjat — Joc del penjat online en català<\/title>/)
  assert.match(home, /<link rel="canonical" href="https:\/\/penjat\.cat\/" \/>/)

  const daily = await fetchText(`http://127.0.0.1:${port}/paraula-del-dia`)
  assert.match(daily, /<title>El penjat del dia: endevina una paraula en català \| Penjat<\/title>/)
  assert.equal([...daily.matchAll(/<meta name="description"/g)].length, 1)
  assert.match(daily, /<meta name="description" content="Juga al penjat del dia en català\. Cada dia hi ha una nova paraula, la mateixa per a tothom\. Endevina-la i comparteix el resultat\." \/>/)
  assert.match(daily, /<link rel="canonical" href="https:\/\/penjat\.cat\/paraula-del-dia" \/>/)
  assert.match(daily, /<meta property="og:title" content="Paraula del dia \| Penjat" \/>/)
  assert.match(daily, /<meta property="og:description" content="Endevina la paraula catalana del dia jugant al Penjat i comparteix el resultat sense revelar-la\." \/>/)
  assert.match(daily, /<meta property="og:url" content="https:\/\/penjat\.cat\/paraula-del-dia" \/>/)
  assert.match(daily, /<meta name="twitter:title" content="Paraula del dia \| Penjat" \/>/)
  assert.doesNotMatch(daily, /Juga al Penjat online en català\. Endevina paraules/)
} finally {
  server.kill('SIGTERM')
}

console.log('SEO route tests passed.')

async function fetchText(url) {
  const response = await fetch(url)
  assert.equal(response.status, 200)
  return response.text()
}
