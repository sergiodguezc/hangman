import React from 'react'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { HangmanDrawing } from '../src/components/HangmanDrawing'

const parts = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']
for (let errors = 0; errors <= 6; errors++) {
  const html = renderToStaticMarkup(<HangmanDrawing errors={errors} label="Errors" />)
  assert.deepEqual([...html.matchAll(/data-part="([^"]+)"/g)].map((m) => m[1]), parts.slice(0, errors))
  assert.equal(html.includes('data-accessory="hat"'), errors >= 1)
  assert.equal(html.includes('data-accessory="scarf"'), errors >= 2)
  assert.ok(html.includes('class="gallows"'))
  assert.ok(html.includes(`aria-label="Errors: ${errors} / 6"`))
  assert.ok(!html.includes('figure--complete'))
}
assert.match(renderToStaticMarkup(<HangmanDrawing errors={2} label="Errores" />), /aria-label="Errores: 2 \/ 6"/)
for (const errors of [0, 2, 5]) {
  const win = renderToStaticMarkup(<HangmanDrawing errors={errors} mood="win" size="compact" />)
  assert.equal([...win.matchAll(/data-part=/g)].length, 6, 'perfect wins also get the rescued figure')
  assert.ok(!win.includes('class="gallows"'))
  assert.match(win, /width="44" height="48"/)
  assert.match(win, /aria-hidden="true"/)
  assert.ok(!win.includes('aria-label') && !win.includes('role="img"'))
}
console.log('Six-error character mapping, accessories, rescue and accessibility passed')
