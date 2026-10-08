import assert from 'node:assert/strict'

export const homeMetrics = `JSON.stringify((() => {
  const box = (selector) => {
    const el = document.querySelector(selector), r = el.getBoundingClientRect(), s = getComputedStyle(el)
    return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, fontSize: parseFloat(s.fontSize), lineHeight: parseFloat(s.lineHeight) }
  }
  return {
    viewport: [innerWidth, innerHeight], clientWidth: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth > innerWidth,
    h1: box('h1'), primary: box('.home-modes .primary-action'), secondary: box('.home-modes .secondary-action'),
    daily: box('.daily-entry'), separator: box('.mode-daily'), shell: box('.home-shell'), footer: box('.home-footer'),
    card: box('.home-preview'), slots: box('.preview-word'), drawing: box('.preview-drawing'), caption: box('.mode-caption'), dailyTitle: box('.daily-title'),
    reminder: document.querySelector('.daily-entry .daily-tomorrow') ? box('.daily-entry .daily-tomorrow') : null,
    ios: !!document.querySelector('.ios-install-card'),
    headings: [...document.querySelectorAll('h1')].map(el => el.textContent),
    canonical: document.querySelector('link[rel=canonical]').href, title: document.title,
    description: document.querySelector('meta[name=description]').content,
    links: [...document.querySelectorAll('.home-modes a')].map(el => ({ href: el.getAttribute('href'), height: el.getBoundingClientRect().height }))
  }
})())`

export function checkHomeLayout(m, size = 's0') {
  const [width, height] = m.viewport
  const tablet = width >= 600 && width <= 860
  assert.equal(m.overflow, false, `Overflow at ${width}`)
  assert.equal(m.headings.length, 1)
  assert.equal(m.canonical, 'https://penjat.cat/')
  assert.deepEqual(m.links.map(link => link.href), ['/multijugador', '/aprendre', '/paraula-del-dia'])
  assert.ok(m.links.every(link => link.height >= 48))
  assert.equal(m.caption.fontSize, 14)
  if (m.reminder) assert.equal(m.reminder.fontSize, 14)
  assert.equal(m.dailyTitle.fontSize, 18)
  assert.ok(m.h1.fontSize <= 56)
  assert.equal(m.primary.height, size === 's1' && width >= 600 ? 52 : 48)
  if (height >= 568) assert.ok(m.primary.bottom <= height, `Primary below fold at ${width}×${height}`)
  if (width <= 599) {
    assert.ok(m.secondary.y > m.primary.bottom)
    assert.equal(m.drawing.width, 100)
  } else {
    assert.equal(m.primary.y, m.secondary.y)
    assert.ok(m.secondary.x > m.primary.x)
  }
  if (width >= 600) {
    assert.ok(m.drawing.y >= m.card.y + 24, 'Drawing remains inside the card padding')
    assert.ok(m.slots.bottom <= m.card.bottom - 24, 'Letter slots remain inside the card padding')
  }
  if (tablet) {
    assert.equal(m.shell.width, Math.min(m.clientWidth - 48, size === 's1' ? 600 : 560))
    assert.equal(m.shell.x, (m.clientWidth - m.shell.width) / 2)
    assert.equal(m.card.x, m.shell.x)
    assert.equal(m.card.width, m.shell.width)
    assert.equal(m.separator.width, m.shell.width)
    assert.equal(m.footer.x, m.shell.x)
    assert.equal(m.drawing.width, size === 's1' ? 220 : 196)
    assert.ok(m.card.y > m.daily.bottom)
  } else if (width >= 861) assert.ok(m.card.x > m.primary.x + m.primary.width)
  if (width >= 390) assert.equal(Math.round(m.h1.height / m.h1.lineHeight), 2, `Headline at ${width}`)
}

export async function checkHomeNavigation({ context, command, evaluate, waitFor, navigate }) {
  await navigate(context, '/')
  await waitFor(context, "document.querySelector('.home-modes') !== null")
  await evaluate(context, 'window.homeNavigationSentinel = 42')
  const head = await evaluate(context, "JSON.stringify([document.title, document.querySelector('meta[name=description]').content, document.querySelector('link[rel=canonical]').href])")
  // Observe React's cancellation before canceling the native default in this synthetic probe.
  // Actual Ctrl/middle clicks are exercised separately below using BiDi input.
  for (const href of ['/multijugador', '/aprendre', '/paraula-del-dia', '/com-es-juga']) {
    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const prevented = await evaluate(context, `(() => {
        let prevented
        const observe = event => { prevented = event.defaultPrevented; event.preventDefault() }
        document.addEventListener('click', observe, { once: true })
        document.querySelector('a[href="${href}"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...${JSON.stringify(modifiers)} }))
        return prevented
      })()`)
      assert.equal(prevented, false, `${href} modified click`)
    }
    await evaluate(context, `document.querySelector('a[href="${href}"]').click()`)
    await waitFor(context, `location.pathname === '${href}/'`)
    assert.equal(await evaluate(context, 'window.homeNavigationSentinel'), 42, 'Ordinary click must not reload')
    await command('browsingContext.traverseHistory', { context, delta: -1 })
    await waitFor(context, "location.pathname === '/' && document.querySelector('.home-modes') !== null")
    await command('browsingContext.traverseHistory', { context, delta: 1 })
    await waitFor(context, `location.pathname === '${href}/'`)
    await command('browsingContext.traverseHistory', { context, delta: -1 })
    await waitFor(context, "location.pathname === '/' && document.querySelector('.home-modes') !== null")
    assert.equal(await evaluate(context, 'window.homeNavigationSentinel'), 42)
  }
  assert.equal(await evaluate(context, "JSON.stringify([document.title, document.querySelector('meta[name=description]').content, document.querySelector('link[rel=canonical]').href])"), head, 'Homepage metadata restored after history navigation')
  // Real keyboard navigation: help, multiplayer, learning, daily, then language buttons.
  await command('browsingContext.setViewport', { context, viewport: { width: 1024, height: 768 } })
  await navigate(context, '/')
  await waitFor(context, "document.querySelector('.home-modes') !== null")
  for (const href of ['/com-es-juga', '/multijugador', '/aprendre', '/paraula-del-dia']) {
    await command('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value: '\uE004' }, { type: 'keyUp', value: '\uE004' }] }] })
    assert.equal(await evaluate(context, 'document.activeElement.getAttribute("href")'), href)
    assert.equal(await evaluate(context, 'document.activeElement.matches(":focus-visible")'), true)
  }
  await command('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value: '\uE007' }, { type: 'keyUp', value: '\uE007' }] }] })
  await waitFor(context, "location.pathname === '/paraula-del-dia/'")
  for (const button of [0, 1]) {
    await navigate(context, '/')
    await waitFor(context, "document.querySelector('.home-modes') !== null")
    const before = new Set((await command('browsingContext.getTree')).contexts.map(item => item.context))
    const point = JSON.parse(await evaluate(context, "JSON.stringify((r => ({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }))(document.querySelector('.home-modes .primary-action').getBoundingClientRect()))"))
    if (button === 0) await command('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value: '\uE009' }] }] })
    await command('input.performActions', { context, actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [{ type: 'pointerMove', ...point }, { type: 'pointerDown', button }, { type: 'pointerUp', button }] }] })
    await command('input.releaseActions', { context })
    let opened
    for (let i = 0; i < 50 && !opened; i++) {
      opened = (await command('browsingContext.getTree')).contexts.find(item => !before.has(item.context))
      if (!opened) await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.ok(opened, `${button === 0 ? 'Ctrl' : 'Middle'} click opens a tab`)
    try {
      await waitFor(opened.context, "location.pathname === '/multijugador/' && document.querySelector('.home-card') !== null")
      assert.equal(await evaluate(context, 'location.pathname'), '/')
    } finally { await command('browsingContext.close', { context: opened.context }) }
  }
  console.log('Homepage navigation passed: semantic links, modifiers, Ctrl/middle new tabs, keyboard, SPA routing and back/forward metadata.')
}
