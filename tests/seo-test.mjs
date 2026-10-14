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

  assert.equal([...home.matchAll(/<meta name="description"/g)].length, 1)
  assert.ok(home.includes('content="Juga al Penjat online en català. Endevina paraules, juga amb amics i aprèn vocabulari català de manera divertida."'))
  assert.ok(home.includes('<meta property="og:url" content="https://penjat.cat/"'))

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

  // Vocabulary learning: thematic units, one canonical URL with or without the trailing slash, no CEFR wording.
  const learningTitle = 'Aprèn vocabulari català jugant al penjat | Penjat'
  const learningDescription = 'Aprèn vocabulari català jugant al penjat. Paraules per temes (natura, animals, menjar, casa, ciutat, emocions) amb definicions, exemples i traducció al castellà.'
  for (const path of ['/aprendre/', '/aprendre']) {
    const learning = await fetchText(`http://127.0.0.1:${port}${path}`)
    assert.ok(learning.includes(`<title>${learningTitle}</title>`), path)
    assert.equal([...learning.matchAll(/<meta name="description"/g)].length, 1)
    assert.ok(learning.includes(`<meta name="description" content="${learningDescription}" />`))
    assert.ok(learning.includes('<link rel="canonical" href="https://penjat.cat/aprendre" />'))
    assert.ok(learning.includes(`<meta property="og:title" content="${learningTitle}" />`) && learning.includes(`<meta property="og:description" content="${learningDescription}" />`))
    assert.ok(learning.includes('<meta property="og:url" content="https://penjat.cat/aprendre" />') && learning.includes(`<meta name="twitter:title" content="${learningTitle}" />`))
    assert.doesNotMatch(learning, /CEFR|A1|B1|C1|noindex|hreflang/)
  }
  assert.equal((await fetch(`http://127.0.0.1:${port}/aprendre/`, { method: 'HEAD' })).status, 200)
  // The sitemap lists exactly the canonical URL of each page, and robots.txt allows crawling and points to it.
  for (const path of ['/', '/multijugador/', '/aprendre/', '/paraula-del-dia/', '/com-es-juga/']) {
    const canonical = (await fetchText(`http://127.0.0.1:${port}${path}`)).match(/<link rel="canonical" href="([^"]+)" \/>/)[1]
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), `sitemap lists ${canonical}`)
  }
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, 5)
  const robots = await fetchText(`http://127.0.0.1:${port}/robots.txt`)
  assert.match(robots, /User-agent: \*\nAllow: \//)
  assert.doesNotMatch(robots, /Disallow/)
  assert.match(robots, /Sitemap: https:\/\/penjat\.cat\/sitemap\.xml/)
} finally {
  server.kill('SIGTERM')
}

console.log('SEO route tests passed.')

async function fetchText(url) {
  const response = await fetch(url)
  assert.equal(response.status, 200)
  return response.text()
}
