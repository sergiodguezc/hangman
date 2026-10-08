// Optional real-browser regressions using Firefox's native WebDriver BiDi (no npm dependency).
// Start a dedicated headless Firefox with --remote-debugging-port 9222 and a built local server.
import assert from 'node:assert/strict'
import { io } from 'socket.io-client'
import { checkResponsiveScope } from './responsive-scope-checks.mjs'
import { checkHomeNavigation, checkHomeLayout, homeMetrics } from './homepage-browser-checks.mjs'

const origin = process.env.TEST_SERVER_URL || 'http://127.0.0.1:3002'
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname), 'Browser tests must target a local server')
const baseline = process.env.AUDIT_BASELINE === '1'
const ws = new WebSocket(`${process.env.BIDI_URL || 'ws://127.0.0.1:9222'}/session`)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
let id = 0
const pending = new Map()
const browserErrors = []
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data)
  if (message.method === 'log.entryAdded' && message.params.level === 'error') browserErrors.push(message.params.text)
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id)
  clearTimeout(request.timer)
  if (message.type === 'error') request.reject(new Error(`${message.error}: ${message.message}`))
  else request.resolve(message.result)
}
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++id
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Timed out: ${method}`)) }, 10000)
    pending.set(requestId, { resolve, reject, timer })
    ws.send(JSON.stringify({ id: requestId, method, params }))
  })
}
async function evaluate(context, expression) {
  const result = await command('script.evaluate', { expression, target: { context }, awaitPromise: true, userActivation: true })
  if (result.type === 'exception') throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.type === 'null' ? null : result.result.value
}
async function waitFor(context, expression) {
  const deadline = Date.now() + 7000
  while (Date.now() < deadline) {
    if (await evaluate(context, expression)) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Browser condition failed: ${expression}\n${await evaluate(context, 'document.body.innerText')}`)
}
const sockets = []
async function createRoom(name) {
  const socket = io(origin, { transports: ['websocket'], forceNew: true })
  sockets.push(socket)
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject) })
  const response = await new Promise((resolve) => socket.emit('room:create', { name, gameLanguage: 'ca', voltes: 1 }, resolve))
  assert.equal(response.ok, true)
  return response.data.session
}
async function navigate(context, path) {
  await command('browsingContext.navigate', { context, url: new URL(path, origin).href, wait: 'complete' })
}
const contexts = []
async function newTab(userContext) {
  const result = await command('browsingContext.create', { type: 'tab', userContext })
  contexts.push(result.context)
  return result.context
}
try {
  await command('session.new', { capabilities: {} })
  await command('session.subscribe', { events: ['log.entryAdded'] })
  const profile = (await command('browser.createUserContext')).userContext
  const isolatedProfile = (await command('browser.createUserContext')).userContext
  const home = await newTab(isolatedProfile)
  await checkHomeNavigation({ context: home, command, evaluate, waitFor, navigate })
  for (const language of ['ca', 'es']) {
    await navigate(home, '/')
    await evaluate(home, `localStorage.setItem('hangman-interface-language', '${language}')`)
    await navigate(home, '/')
    await waitFor(home, "document.querySelector('.home-modes') !== null")
    for (const [width, height] of [[1440,900], [1024,768], [768,1024], [820,1180], [390,844], [320,568], [599,960], [600,960], [660,1000], [661,1000], [860,1180], [861,1180], [1024,1366], [844,390]]) {
      await command('browsingContext.setViewport', { context: home, viewport: { width, height } })
      checkHomeLayout(JSON.parse(await evaluate(home, homeMetrics)))
    }
  }
  await evaluate(home, "localStorage.setItem('hangman-interface-language', 'ca')")
  await navigate(home, '/paraula-del-dia/')
  await waitFor(home, "document.querySelector('.keyboard') !== null")
  for (let i=0; i<28 && !await evaluate(home, "document.querySelector('.daily-result') !== null"); i++) {
    await evaluate(home, "document.querySelector('.keyboard button:not(:disabled)')?.click()")
  }
  await waitFor(home, "document.querySelector('.daily-result') !== null")
  await command('browsingContext.setViewport', { context:home, viewport:{ width:320, height:568 } })
  assert.equal(await evaluate(home, "getComputedStyle(document.querySelector('.daily-result .daily-tomorrow')).whiteSpace"), 'normal')
  assert.equal(await evaluate(home, "getComputedStyle(document.querySelector('.daily-result .daily-tomorrow')).fontSize"), '13px')
  const wonDaily = await evaluate(home, "document.querySelector('.daily-result').classList.contains('win')")
  const secretDaily = await evaluate(home, "document.querySelector('.daily-result dd').textContent")
  await evaluate(home, "document.querySelector('.global-back-button').click()")
  await waitFor(home, "document.querySelector('.daily-tomorrow') !== null")
  assert.equal(await evaluate(home, "document.querySelector('.daily-caption').textContent.includes('Encertada')"), wonDaily)
  assert.equal(await evaluate(home, "getComputedStyle(document.querySelector('.daily-entry .daily-tomorrow')).fontSize"), '14px')
  assert.equal(await evaluate(home, "getComputedStyle(document.querySelector('.daily-entry .daily-tomorrow')).color"), 'rgb(95, 106, 98)')
  assert.equal(await evaluate(home, `document.querySelector('.home-modes').textContent.replace('Paraula del dia', '').includes(${JSON.stringify(secretDaily)})`), false)
  for (const attempt of ['{', JSON.stringify({ challengeId:'2000-01-01', guesses:['A'], completed:true, won:true })]) {
    await evaluate(home, `localStorage.setItem('penjat-daily-challenge', ${JSON.stringify(attempt)}); window.dispatchEvent(new Event('focus'))`)
    await waitFor(home, "document.querySelector('.daily-caption').textContent === 'La mateixa per a tothom'")
  }
  assert.equal(await evaluate(home, "document.querySelector('.home-modes .primary-action').textContent"), 'Juga amb amics')
  console.log('Homepage daily status passed: completed game return, corrupt/outdated storage refresh, stable primary action.')
  console.log('Homepage responsive checks passed in CA/ES, including all six boundaries.')
  await navigate(home, '/multijugador/')
  await waitFor(home, "document.querySelector('.home-card form') !== null")
  await checkResponsiveScope({ context:home, command, evaluate, page:'setup', root:'.home-card', selectors:'.home-card, .home-card *' })
  await navigate(home, '/com-es-juga/')
  await waitFor(home, "document.querySelector('.howto-header') !== null")
  await checkResponsiveScope({ context:home, command, evaluate, page:'help', root:'.howto-page', selectors:'.howto-page, .howto-page *' })
  const oldRoom = await createRoom('Old host')
  const invitedRoom = await createRoom('New host')
  const source = await newTab(profile)
  await navigate(source, '/')
  await evaluate(source, `sessionStorage.setItem('hangman-room-session', ${JSON.stringify(JSON.stringify(oldRoom))}); localStorage.setItem('hangman-name', 'Shared name')`)
  await navigate(source, '/multijugador/')
  await waitFor(source, `document.body.innerText.includes(${JSON.stringify(oldRoom.roomCode)})`)

  // A normal same-profile tab shares localStorage but has its own sessionStorage.
  const shared = await newTab(profile)
  await navigate(shared, `/multijugador/?sala=${invitedRoom.roomCode}`)
  await waitFor(shared, "document.querySelector('.invitation-form') !== null")
  await checkResponsiveScope({ context:shared, command, evaluate, page:'invitation', root:'.invitation-card', selectors:'.invitation-card, .invitation-card *' })
  assert.equal(await evaluate(shared, "localStorage.getItem('hangman-name')"), 'Shared name')
  assert.equal(await evaluate(shared, "sessionStorage.getItem('hangman-room-session')"), null)

  // Separate user contexts have independent browser storage, like different devices.
  const isolated = await newTab(isolatedProfile)
  await navigate(isolated, `/multijugador/?sala=${invitedRoom.roomCode}`)
  await waitFor(isolated, "document.querySelector('.invitation-form') !== null")
  assert.equal(await evaluate(isolated, "localStorage.getItem('hangman-name')"), null)

  // Actual opener-created tab inherits a copy of the previous room's sessionStorage.
  const before = new Set((await command('browsingContext.getTree')).contexts.map((item) => item.context))
  await evaluate(source, `window.open(${JSON.stringify(new URL(`/multijugador/?sala=${invitedRoom.roomCode}`, origin).href)}, '_blank'); true`)
  const tree = await command('browsingContext.getTree')
  const copied = tree.contexts.find((item) => !before.has(item.context)).context
  contexts.push(copied)
  await waitFor(copied, "document.readyState === 'complete' && document.body.innerText.length > 20")
  await waitFor(copied, baseline ? `document.body.innerText.includes(${JSON.stringify(oldRoom.roomCode)})` : "document.querySelector('.invitation-form') !== null")
  assert.equal(JSON.parse(await evaluate(copied, "sessionStorage.getItem('hangman-room-session')")).roomCode, oldRoom.roomCode)
  if (baseline) {
    assert.equal(await evaluate(copied, `document.body.innerText.includes(${JSON.stringify(invitedRoom.roomCode)})`), false)
    console.log('BASELINE reproduced F02: opener tab displays old room despite new invitation; ordinary shared tabs and isolated contexts display invitation.')
  } else {
    assert.equal(await evaluate(copied, `document.querySelector('.lobby-page') !== null`), false)
    // Reload must preserve invitation precedence and leave the old credential intact until joining.
    await navigate(copied, `/multijugador/?sala=${invitedRoom.roomCode}`)
    await waitFor(copied, "document.querySelector('.invitation-form') !== null")
    // A same-room invitation still restores the valid session.
    await navigate(source, `/multijugador/?sala=${oldRoom.roomCode}`)
    await waitFor(source, "document.querySelector('.lobby-page') !== null")
    await checkResponsiveScope({ context:source, command, evaluate, page:'lobby', root:'.lobby-page', selectors:'.lobby-page, .lobby-page *' })
    // Joining replaces credentials only after the new room accepts the player.
    await evaluate(copied, "document.querySelector('.invitation-form button.primary-action').click()")
    await waitFor(copied, "document.querySelector('.lobby-page') !== null")
    assert.equal(JSON.parse(await evaluate(copied, "sessionStorage.getItem('hangman-room-session')")).roomCode, invitedRoom.roomCode)
    await navigate(copied, '/multijugador/?sala=bad')
    await waitFor(copied, "document.querySelector('.invitation-invalid') !== null")
    assert.equal(JSON.parse(await evaluate(copied, "sessionStorage.getItem('hangman-room-session')")).roomCode, invitedRoom.roomCode)
    await navigate(copied, '/multijugador/')
    await waitFor(copied, "document.querySelector('.lobby-page') !== null")
    await evaluate(copied, "document.querySelector('.global-back-button').click()")
    await waitFor(copied, "sessionStorage.getItem('hangman-room-session') === null")
    console.log('Browser invitation tests passed: shared tabs, opener copy, isolated contexts, reload, same-room restoration, join, invalid invitation and explicit leave.')

    const learning = await newTab(isolatedProfile)
    const clickText = async (context, text, selector = 'button') => {
      await evaluate(context, `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`)
    }
    const finishWord = async () => {
      // Exercise UI guesses to completion without depending on a random word.
      for (let index = 0; index < 28; index++) {
        if (await evaluate(learning, "document.querySelector('.learning-result') !== null")) return
        await evaluate(learning, "document.querySelector('.keyboard button:not(:disabled)')?.click()")
      }
      await waitFor(learning, "document.querySelector('.learning-result') !== null")
    }
    for (const level of ['Bàsic', 'Intermedi', 'Avançat', 'Tots']) {
      await navigate(learning, '/aprendre/')
      await waitFor(learning, "document.querySelector('.learning-setup') !== null")
      await clickText(learning, level, '.learning-setup button')
      await clickText(learning, 'Comença')
      await waitFor(learning, "document.querySelector('.keyboard') !== null")
      await finishWord()
      await clickText(learning, 'Paraula següent', '.learning-result-actions button')
      await waitFor(learning, "document.querySelector('.keyboard') !== null")
    }
    await navigate(learning, '/aprendre/')
    await waitFor(learning, "document.querySelector('.learning-setup') !== null")
    await clickText(learning, 'Bàsic', '.learning-setup button')
    await clickText(learning, 'Comença')
    await waitFor(learning, "document.querySelector('.keyboard') !== null")
    await finishWord()
    await clickText(learning, 'Canviar el nivell')
    await clickText(learning, 'Intermedi', '.learning-difficulty-dialog button')
    assert.equal(await evaluate(learning, "document.querySelector('.learning-round-meta strong').textContent"), 'Bàsic')
    await clickText(learning, 'Paraula següent', '.learning-result-actions button')
    await waitFor(learning, "document.querySelector('.keyboard') !== null")
    assert.equal(await evaluate(learning, "document.querySelector('.learning-round-meta strong').textContent"), 'Intermedi')
    await finishWord()
    await clickText(learning, 'Canviar el nivell')
    await clickText(learning, 'Avançat', '.learning-difficulty-dialog button')
    assert.equal(await evaluate(learning, "document.querySelector('.learning-round-meta strong').textContent"), 'Intermedi')
    await evaluate(learning, "document.querySelector('.global-back-button').click()")
    await waitFor(learning, "document.querySelector('.exit-confirmation-dialog') !== null")
    await evaluate(learning, "document.querySelector('.exit-confirmation-dialog .primary-action').click()")
    await waitFor(learning, "document.querySelector('.learning-summary') !== null")
    const summary = await evaluate(learning, "document.querySelector('.learning-summary').innerText")
    assert.ok(summary.includes('Bàsic · Intermedi'))
    assert.ok(!summary.includes('Avançat'))
    assert.ok(summary.includes('Paraules no encertades'))
    console.log('Browser learning tests passed: every level starts/progresses, level switching preserves the current board, mixed summary excludes an unplayed selection.')

    // Finish a match through departure while its last round is still choosing.
    // The server intentionally retains that round; the UI must prioritize match-over.
    const hostSession = await createRoom('Departure host')
    const hostSocket = sockets.at(-1)
    const guestSocket = io(origin, { transports: ['websocket'], forceNew: true })
    sockets.push(guestSocket)
    await new Promise((resolve, reject) => { guestSocket.once('connect', resolve); guestSocket.once('connect_error', reject) })
    const emit = (socket, event, payload) => new Promise((resolve) => payload === undefined ? socket.emit(event, resolve) : socket.emit(event, payload, resolve))
    const joined = await emit(guestSocket, 'room:join', { name: 'Departure guest', code: hostSession.roomCode })
    assert.equal(joined.ok, true)
    const started = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { hostSocket.off('room:state', listener); reject(new Error('Match did not start')) }, 7000)
      const listener = (view) => {
        if (view.roomStatus !== 'active') return
        clearTimeout(timer); hostSocket.off('room:state', listener); resolve(view)
      }
      hostSocket.on('room:state', listener)
    })
    assert.equal((await emit(hostSocket, 'room:start')).ok, true)
    const state = await started
    const setterSession = state.round.setterId === hostSession.playerId ? hostSession : joined.data.session
    const leavingSocket = state.round.setterId === hostSession.playerId ? guestSocket : hostSocket
    const terminal = await newTab(isolatedProfile)
    await navigate(terminal, '/')
    await evaluate(terminal, `sessionStorage.setItem('hangman-room-session', ${JSON.stringify(JSON.stringify(setterSession))})`)
    await navigate(terminal, '/multijugador/')
    await waitFor(terminal, "document.querySelector('.word-form') !== null")
    await checkResponsiveScope({ context:terminal, command, evaluate, page:'match', root:'.match-page', selectors:'.match-page, .match-page *' })
    leavingSocket.emit('room:leave')
    await waitFor(terminal, "document.querySelector('.match-result') !== null")
    assert.equal(await evaluate(terminal, "document.querySelector('.word-form, .forgiveness-wait, .player-terminal-state, .keyboard button:not(:disabled)') !== null"), false)
    console.log('Browser terminal-match test passed: departure during word choice shows results without active-round controls.')
    assert.deepEqual(browserErrors, [], 'No browser console errors should occur')


  }
} finally {
  for (const context of contexts.reverse()) await command('browsingContext.close', { context }).catch(() => {})
  sockets.forEach((socket) => socket.disconnect())
  await command('session.end').catch(() => {})
  ws.close()
}
