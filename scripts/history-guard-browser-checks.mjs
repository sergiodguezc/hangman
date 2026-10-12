import assert from 'node:assert/strict'

// QA-01: browser Back/Forward follow the same exit guard as header links. A guarded move is undone while the dialog is
// open, so the dialog stays with the game it protects: Cancel keeps playing, Confirm performs the move.
export async function checkHistoryGuard({ context, command, evaluate, waitFor, navigate }) {
  const back = () => command('browsingContext.traverseHistory', { context, delta: -1 })
  const forward = () => command('browsingContext.traverseHistory', { context, delta: 1 })
  const dialogOpen = "document.querySelector('.exit-confirmation-dialog[open]') !== null"
  const noDialog = "document.querySelector('.exit-confirmation-dialog') === null"
  const guessed = "document.querySelectorAll('.keyboard button:disabled').length"
  const cancel = () => evaluate(context, "document.querySelector('.exit-confirmation-dialog .secondary-action').click()")
  const confirm = () => evaluate(context, "document.querySelector('.exit-confirmation-dialog .danger-action').click()")
  const startLearning = async () => {
    await evaluate(context, "document.querySelector('.learning-setup .primary-action').click()")
    await waitFor(context, "document.querySelector('.learning-game .keyboard') !== null")
    await evaluate(context, "document.querySelector('.keyboard button:not(:disabled)').click()")
    await waitFor(context, `${guessed} === 1`)
  }
  // The dialog and the page it guards stay together: same URL, same game, same guesses.
  const expectGuarded = async (path, game, title) => {
    await waitFor(context, dialogOpen)
    await waitFor(context, `location.pathname === '${path}'`)
    assert.equal(await evaluate(context, `document.querySelector('${game}') !== null`), true, `${path} game stays mounted under the dialog`)
    assert.equal(await evaluate(context, "document.querySelector('#exit-confirmation-title').textContent"), title)
  }

  await command('browsingContext.setViewport', { context, viewport: { width: 1440, height: 900 } })
  await navigate(context, '/')
  await evaluate(context, "localStorage.setItem('hangman-interface-language', 'ca'); localStorage.setItem('hangman-name', 'Historial')")
  await navigate(context, '/')
  await waitFor(context, "document.querySelector('.home-modes') !== null")

  // Original reproduction: active learning → logo opens the dialog → Back → Cancel keeps the session.
  await evaluate(context, "document.querySelector('.site-nav a[href=\"/aprendre\"]').click()")
  await waitFor(context, "document.querySelector('.learning-setup') !== null")
  await startLearning()
  await evaluate(context, "document.querySelector('.site-brand').click()")
  await waitFor(context, dialogOpen)
  await back()
  await expectGuarded('/aprendre/', '.learning-game', 'Vols acabar la partida?')
  assert.equal(await evaluate(context, "document.title.startsWith('Aprèn')"), true)
  await cancel()
  await waitFor(context, noDialog)
  assert.equal(await evaluate(context, 'location.pathname'), '/aprendre/')
  assert.equal(await evaluate(context, guessed), 1, 'Cancel keeps the learning word and its guesses')

  // Back without an open dialog asks too; Confirm then goes back, and Forward returns to a fresh setup, unguarded.
  await back()
  await expectGuarded('/aprendre/', '.learning-game', 'Vols acabar la partida?')
  assert.equal(await evaluate(context, guessed), 1)
  await confirm()
  await waitFor(context, "location.pathname === '/' && document.querySelector('.home-modes') !== null")
  assert.equal(await evaluate(context, noDialog), true, 'The dialog never survives the page change')
  await forward()
  await waitFor(context, "location.pathname === '/aprendre/' && document.querySelector('.learning-setup') !== null")
  assert.equal(await evaluate(context, noDialog), true)

  // Forward out of an active game is guarded as well (learning → daily, Back, start, Forward).
  await evaluate(context, "document.querySelector('.site-nav a[href=\"/paraula-del-dia\"]').click()")
  await waitFor(context, "location.pathname === '/paraula-del-dia/' && document.querySelector('.daily-game') !== null")
  await back()
  await waitFor(context, "location.pathname === '/aprendre/' && document.querySelector('.learning-setup') !== null")
  await startLearning()
  await forward()
  await expectGuarded('/aprendre/', '.learning-game', 'Vols acabar la partida?')
  await cancel()
  await waitFor(context, noDialog)
  assert.equal(await evaluate(context, guessed), 1)
  await forward()
  await waitFor(context, dialogOpen)
  await confirm()
  await waitFor(context, "location.pathname === '/paraula-del-dia/' && document.querySelector('.daily-game') !== null")

  // Daily: an unfinished challenge is guarded the same way; confirming leaves and the stored guess survives.
  await evaluate(context, "document.querySelector('.keyboard button:not(:disabled)').click()")
  await waitFor(context, `${guessed} === 1`)
  await back()
  await expectGuarded('/paraula-del-dia/', '.daily-game', 'Vols acabar la partida?')
  await cancel()
  await waitFor(context, noDialog)
  assert.equal(await evaluate(context, guessed), 1)
  await back()
  await waitFor(context, dialogOpen)
  await confirm()
  await waitFor(context, "location.pathname === '/aprendre/' && document.querySelector('.learning-setup') !== null")
  await forward()
  await waitFor(context, `location.pathname === '/paraula-del-dia/' && ${guessed} === 1`)
  await evaluate(context, "localStorage.removeItem('penjat-daily-challenge')")

  // Multiplayer: Back from a waiting room asks before leaving; Cancel keeps the room and its credentials.
  // (The restored daily game is still unfinished, so the header link asks first too.)
  await evaluate(context, "document.querySelector('.site-nav a[href=\"/multijugador\"]').click()")
  await waitFor(context, dialogOpen)
  await confirm()
  await waitFor(context, "document.querySelector('.setup-name input')?.value === 'Historial'")
  await evaluate(context, "document.querySelector('.setup-panel--create .primary-action').click()")
  await waitFor(context, "document.querySelector('.lobby-page') !== null")
  const room = await evaluate(context, "sessionStorage.getItem('hangman-room-session')")
  assert.ok(room)
  await back()
  await expectGuarded('/multijugador/', '.lobby-page', 'Vols sortir de la sala?')
  await cancel()
  await waitFor(context, noDialog)
  assert.equal(await evaluate(context, "sessionStorage.getItem('hangman-room-session')"), room)
  // A header link's dialog replaced by Back still belongs to the room; Confirm leaves it for the Back destination.
  await evaluate(context, "document.querySelector('.site-nav a[href=\"/com-es-juga\"]').click()")
  await waitFor(context, dialogOpen)
  await back()
  await expectGuarded('/multijugador/', '.lobby-page', 'Vols sortir de la sala?')
  await confirm()
  await waitFor(context, "location.pathname === '/paraula-del-dia/' && sessionStorage.getItem('hangman-room-session') === null")
  assert.equal(await evaluate(context, noDialog), true)
  assert.equal(await evaluate(context, "document.querySelector('.lobby-page') === null"), true)
  await evaluate(context, "localStorage.removeItem('hangman-name'); localStorage.removeItem('penjat-daily-challenge')")
  console.log('History guard passed: Back/Forward with and without an open dialog in learning, daily and a waiting room; Cancel keeps the game, Confirm navigates.')
}
