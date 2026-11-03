/* global window, document, performance, requestAnimationFrame, console, SharedWorker, location, URL */
/**
 * Browser regression evidence for IMPL-015/016/017/018, without a server or DB.
 * Start Vite, then run:
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs node scripts/validate-local-ai.mjs
 * Optional LOCAL_AI_URL and LOCAL_AI_OUTPUT; playwright-core/browser are external tooling.
 * Instrumentation observes real Worker messages and submits the same commands as GameSession.
 * It never changes a game's state, seeds, timers, grants, or AI decisions.
 */
import assert from 'node:assert/strict';
import process from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : 'playwright-core'
);
const base = process.env.LOCAL_AI_URL ?? 'http://127.0.0.1:5199';
const output = path.resolve(
  process.env.LOCAL_AI_OUTPUT ?? 'docs/worklogs/artifacts/2026-11-03-local-ai',
);
await mkdir(output, { recursive: true });
const report = {
  at: new Date().toISOString(),
  viewport: { width: 960, height: 640 },
  method:
    'Unmodified real Worker/SharedWorker; observed transport and normal commands. Scene harness only for static theme/performance comparison.',
  errors: [],
  themes: [],
  local: {},
  ai: {},
  emotes: {},
};
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
  ],
});
report.browser = browser.version();
async function context() {
  const c = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1 });
  await c.addInitScript(() => {
    const v = (window.__validation = {
      ports: [],
      starts: [],
      events: [],
      results: {},
      nextId: 900000,
      sent: [],
    });
    const watch = (p) => {
      v.ports.push(p);
      const post = p.postMessage.bind(p);
      p.postMessage = (...args) => {
        v.sent.push(args[0]);
        return post(...args);
      };
      p.addEventListener('message', ({ data: m }) => {
        if (m.t === 'event') {
          if (m.type === 'game:state') v.view = m.payload;
          else {
            v.events.push(m);
            if (m.type === 'emote:shown' && v.probeCooldown) {
              v.probeCooldown = false;
              p.postMessage({
                t: 'cmd',
                id: 999999,
                kind: 'emote',
                payload: { gameId: m.payload.gameId, emote: 'taunt' },
              });
            }
            if (m.type === 'game:start') {
              v.start = m.payload;
              v.view = m.payload.view;
              v.starts.push(m.payload);
            }
          }
        } else if (m.t === 'result') v.results[m.id] = m.result;
      });
    };
    const W = window.Worker;
    window.Worker = class extends W {
      constructor(...args) {
        super(...args);
        watch(this);
      }
    };
    const S = window.SharedWorker;
    if (S)
      window.SharedWorker = class extends S {
        constructor(...args) {
          super(...args);
          watch(this.port);
        }
      };
  });
  c.on('page', (p) => {
    p.on('pageerror', (e) => report.errors.push(String(e)));
    p.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('favicon')) report.errors.push(m.text());
    });
  });
  return c;
}
async function state(p) {
  return p.evaluate(() => ({ start: window.__validation.start, view: window.__validation.view }));
}
async function command(p, kind, payload) {
  const id = await p.evaluate(
    ({ kind, payload }) => {
      const v = window.__validation;
      const id = v.nextId++;
      v.ports[0].postMessage({ t: 'cmd', id, kind, payload });
      return id;
    },
    { kind, payload },
  );
  await p.waitForFunction((id) => window.__validation.results[id], id, { timeout: 10000 });
  return p.evaluate((id) => window.__validation.results[id], id);
}
async function waitStart(p, count = 1) {
  await p.waitForFunction(
    (n) => window.__validation.starts.length >= n && window.__validation.view?.private.held,
    count,
    { timeout: 20000 },
  );
}
async function capture(p, name) {
  await p.screenshot({ path: path.join(output, name) });
}
async function useHeld(p) {
  const { start, view } = await state(p);
  const held = view.private.held;
  if (!held) return null;
  if (held.kind === 'bar_speed' || held.kind === 'wind') {
    assert(
      view.effects.some((e) => e.kind === held.kind),
      'Passive grant effect must already be active',
    );
    return { kind: held.kind, automatic: true, effects: view.effects.map((e) => e.kind) };
  }
  const payload = { gameId: view.gameId, hazardInstanceId: held.hazardInstanceId };
  if (held.kind === 'board_spin') payload.direction = 1;
  if (held.kind === 'flashlight' || held.kind === 'water_gun')
    payload.target = { x: 0, y: start.seat === 0 ? 30 : -30, h: 23 };
  const data = await p.evaluate(
    async ({ view, start, kind }) => {
      const core = await import('/@fs' + window.__repoRoot + '/packages/game-core/src/index.ts');
      const shared = await import('/@fs' + window.__repoRoot + '/packages/shared/src/index.ts');
      const ai = await import('/src/ai/ai-controller.ts');
      if (core.isInstallKind(kind))
        return ai.randomPlacement(view, shared.BOARDS[start.board], kind, new core.Prng(6789));
      if (kind === 'decoy')
        return { stoneId: view.stones.find((s) => s.ownerId === start.seat && s.h === 0).id };
      return null;
    },
    { view, start, kind: held.kind },
  );
  if (data) payload.target = data;
  const result = await command(p, 'hazard', payload);
  const value = { kind: held.kind, target: data, result };
  if (held.kind === 'fake_wall' && result.ok) {
    await p.waitForFunction(
      (seat) =>
        window.__validation.events.filter(
          (e) =>
            e.type === 'hazard:triggered' &&
            e.payload.kind === 'wall' &&
            e.payload.sourceSeat === seat &&
            e.payload.phase === 'start',
        ).length >= 3,
      start.seat,
    );
    value.walls = await p.evaluate(
      (seat) =>
        window.__validation.events
          .filter(
            (e) =>
              e.type === 'hazard:triggered' &&
              e.payload.kind === 'wall' &&
              e.payload.sourceSeat === seat &&
              e.payload.phase === 'start',
          )
          .slice(-3)
          .map((e) => e.payload),
      start.seat,
    );
    assert.equal(new Set(value.walls.map((e) => e.startsAtMs)).size, 1);
    assert.equal(new Set(value.walls.map((e) => `${e.params.x},${e.params.y}`)).size, 3);
    assert(value.walls.some((e) => e.params.x === data.x && e.params.y === data.y));
  }
  return value;
}
async function root(c) {
  await c.addInitScript((root) => {
    window.__repoRoot = root;
  }, process.cwd());
}
async function transportPage(c, seat, theme) {
  const p = await c.newPage();
  await p.route('**/local-validation.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Local worker transport validation</title>',
    }),
  );
  await p.goto(`${base}/local-validation.html`);
  await p.evaluate(
    async ({ seat, theme }) => {
      const { LocalGameSession } = await import('/src/local/local-game-session.ts');
      const worker = new SharedWorker(
        new URL('/src/local/local-worker.ts?worker_file&type=module', location.href),
        { type: 'module', name: 'alkkagi-local' },
      );
      window.__validation.session = new LocalGameSession(worker.port, { seat, theme });
      await window.__validation.session.connect();
    },
    { seat, theme },
  );
  return p;
}
try {
  // Four scenes under the same software/browser conditions; these are reference values, never GPU acceptance.
  let c = await context();
  const scene = await c.newPage();
  for (const theme of ['bar', 'rooftop', 'classroom', 'beach']) {
    await scene.goto(`${base}/scene-harness.html?theme=${theme}&opp=aim`);
    await scene.waitForFunction(() => window.__harness && document.querySelector('canvas'));
    await scene.waitForTimeout(1500);
    const renderer = await scene.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR),
        renderer: gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
      };
    });
    const samples = await scene.evaluate(
      () =>
        new Promise((resolve) => {
          const samples = [];
          let prev = null;
          const end = performance.now() + 5000;
          function frame(t) {
            if (prev !== null) samples.push(t - prev);
            prev = t;
            if (t < end) requestAnimationFrame(frame);
            else resolve(samples);
          }
          requestAnimationFrame(frame);
        }),
    );
    const ordered = [...samples].sort((a, b) => a - b);
    report.themes.push({
      theme,
      renderer,
      samples,
      meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      p95Ms: ordered[Math.floor(ordered.length * 0.95)],
    });
    await capture(scene, `theme-${theme}.png`);
  }
  await c.close();
  // Real SharedWorker two-tab matches; random grants observed across rematches, never forced.
  c = await context();
  await root(c);
  let p0 = await c.newPage();
  let p1 = await c.newPage();
  await p0.goto(`${base}/local?seat=0&theme=beach`);
  await p1.goto(`${base}/local?seat=1&theme=bar`);
  await waitStart(p0);
  await waitStart(p1);
  const first0 = (await state(p0)).start;
  const first1 = (await state(p1)).start;
  assert.equal(first0.theme, 'beach');
  assert.equal(first1.theme, 'beach');
  assert.deepEqual(first0.players, first1.players);
  assert.notDeepEqual(first0.players[0].appearance, first0.players[1].appearance);
  report.local.first = { theme: first0.theme, players: first0.players };
  await p0.waitForFunction(() => document.querySelector('canvas')?.width > 0);
  await p0.waitForTimeout(2500);
  await capture(p0, 'local-seat0.png');
  await capture(p1, 'local-seat1.png');
  // Real keyboard/menu, event delivered identically to both seats, client+authority cooldown.
  const emoteCount = async (p) =>
    p.evaluate(() => window.__validation.events.filter((e) => e.type === 'emote:shown').length);
  await p0.evaluate(() => {
    window.__validation.probeCooldown = true;
  });
  await p0.keyboard.press('Digit1+Digit2');
  await p0.waitForFunction(() =>
    window.__validation.events.some((e) => e.type === 'emote:shown' && e.payload.seat === 0),
  );
  await p1.waitForFunction(() =>
    window.__validation.events.some((e) => e.type === 'emote:shown' && e.payload.seat === 0),
  );
  assert.equal(await emoteCount(p0), 1);
  await p0.waitForFunction(() => window.__validation.results[999999]);
  const gate = await p0.evaluate(() => window.__validation.results[999999]);
  assert.equal(gate.error.code, 'EMOTE_COOLDOWN');
  await p1.getByRole('button', { name: '감정표현 (1~6)' }).click();
  await p1.getByRole('button', { name: /인사/ }).click();
  await p0.waitForFunction(() =>
    window.__validation.events.some((e) => e.type === 'emote:shown' && e.payload.seat === 1),
  );
  await capture(p0, 'local-emotes.png');
  report.local.renderedTwoTabUiSmoke = true;
  report.emotes.local = {
    events0: await p0.evaluate(() =>
      window.__validation.events.filter((e) => e.type === 'emote:shown'),
    ),
    events1: await p1.evaluate(() =>
      window.__validation.events.filter((e) => e.type === 'emote:shown'),
    ),
    repeatedKeyboardBlocked: true,
    authorityCooldown: gate,
  };
  assert.deepEqual(report.emotes.local.events0, report.emotes.local.events1);
  // UI behavior above uses both rendered tabs. Grant-pool transport coverage below uses
  // the identical session and SharedWorker without a GPU scene, avoiding software rendering
  // starving the main-thread heartbeat. No game state or authority timers are changed.
  await c.close();
  c = await context();
  await root(c);
  p0 = await transportPage(c, 0, 'beach');
  p1 = await transportPage(c, 1, 'bar');
  report.local.grantCoverageMode =
    'Real LocalGameSession and SharedWorker in browser tabs without a WebGL scene; rendered two-tab UI is checked separately above.';
  const used = new Map();
  const failures = [];
  for (let n = 1; n <= 100 && used.size < 18; n++) {
    await waitStart(p0, n);
    await waitStart(p1, n);
    for (const p of [p0, p1]) {
      const value = await useHeld(p);
      if (value?.automatic || value?.result?.ok) used.set(value.kind, value);
      else if (value) failures.push(value);
    }
    const s = await state(p0);
    assert.equal((await command(p0, 'forfeit', { gameId: s.view.gameId })).ok, true);
    await p1.waitForFunction(() => window.__validation.view.phase === 'finished');
    if (n === 1) {
      const blocked = await command(p0, 'emote', { gameId: s.view.gameId, emote: 'laugh' });
      assert.equal(blocked.error.code, 'GAME_NOT_ACTIVE');
      report.emotes.finished = blocked;
    }
    await command(p0, 'rematch', { gameId: s.view.gameId });
    await command(p1, 'rematch', { gameId: s.view.gameId });
    await waitStart(p0, n + 1);
    assert.deepEqual((await state(p0)).start.players, first0.players);
    report.local.matches = n;
    if (n % 10 === 0)
      console.log(`local matches ${n}, distinct successful/automatic hazards ${used.size}`);
  }
  report.local.hazards = [...used.values()];
  report.local.failedAttempts = failures;
  assert.equal(
    used.size,
    18,
    'Every grant-pool hazard must be used/automatically applied in a real SharedWorker match',
  );
  const s = await state(p0);
  const previousTurn = s.view.turnId;
  const shot = s.view.stones.find((x) => x.ownerId === s.view.activePlayerId);
  const activePage = s.view.activePlayerId === 0 ? p0 : p1;
  assert.equal(
    (
      await command(activePage, 'shot', {
        gameId: s.view.gameId,
        turnId: previousTurn,
        stoneId: shot.id,
        angle: s.view.activePlayerId === 0 ? Math.PI / 2 : -Math.PI / 2,
        power: 20,
      })
    ).ok,
    true,
  );
  await p0.waitForFunction((t) => window.__validation.view.turnId > t, previousTurn);
  report.local.shotAndTurnSwap = true;
  await p1.close();
  await p0.waitForFunction(
    (gid) =>
      window.__validation.events.some(
        (e) => e.type === 'game:over' && e.payload.gameId === gid && e.payload.reason === 'forfeit',
      ),
    s.view.gameId,
  );
  report.local.closeForfeit = true;
  await c.close();
  // Invalid/absent local theme defaults checked on the real authority.
  report.local.fallbackThemes = [];
  for (const query of ['&theme=invalid', '']) {
    c = await context();
    await root(c);
    const a = await transportPage(c, 0, query ? 'invalid' : undefined);
    const b = await transportPage(c, 1, 'beach');
    await waitStart(a);
    await waitStart(b);
    assert.equal((await state(a)).start.theme, 'bar');
    report.local.fallbackThemes.push({ query, theme: (await state(a)).start.theme });
    await c.close();
  }
  // Real AI worker and visible setup for every theme; natural AI hazard/emote decisions observed.
  report.ai.matches = [];
  for (const theme of ['bar', 'rooftop', 'classroom', 'beach']) {
    c = await context();
    await root(c);
    const p = await c.newPage();
    await p.goto(`${base}/ai`);
    await p.locator(`input[name="theme"][value="${theme}"]`).check();
    await p.getByRole('button', { name: 'AI와 시작' }).click();
    await waitStart(p);
    const start = (await state(p)).start;
    assert.equal(start.theme, theme);
    await p.waitForTimeout(8500);
    const before = await state(p);
    assert.equal(
      (
        await command(p, 'shot', {
          gameId: before.view.gameId,
          turnId: before.view.turnId,
          stoneId: before.view.stones.find((x) => x.ownerId === 0).id,
          angle: Math.PI / 2,
          power: 30,
        })
      ).ok,
      true,
    );
    await p.waitForFunction(
      () => window.__validation.view.turnId >= 3 || window.__validation.view.phase === 'finished',
      null,
      { timeout: 22000 },
    );
    const snapshot = await state(p);
    let events = await p.evaluate(() =>
      window.__validation.events.filter((e) =>
        ['hazard:triggered', 'emote:shown'].includes(e.type),
      ),
    );
    await capture(p, `ai-${theme}.png`);
    if (snapshot.view.phase !== 'finished')
      await command(p, 'forfeit', { gameId: snapshot.view.gameId });
    await command(p, 'rematch', { gameId: snapshot.view.gameId });
    await waitStart(p, 2);
    assert.deepEqual((await state(p)).start.players, start.players);
    if (theme === 'beach') {
      const prior = report.ai.matches.flatMap((m) => m.events);
      for (let attempt = 0; attempt < 20; attempt++) {
        await p.waitForTimeout(150);
        events = await p.evaluate(() =>
          window.__validation.events.filter((e) =>
            ['hazard:triggered', 'emote:shown'].includes(e.type),
          ),
        );
        if ([...prior, ...events].some((e) => e.type === 'emote:shown' && e.payload.seat === 1))
          break;
        const current = await state(p);
        if (current.view.phase !== 'finished')
          await command(p, 'forfeit', { gameId: current.view.gameId });
        await command(p, 'rematch', { gameId: current.view.gameId });
        await waitStart(p, attempt + 3);
        report.ai.extraNaturalRematches = attempt + 1;
      }
    } else
      events = await p.evaluate(() =>
        window.__validation.events.filter((e) =>
          ['hazard:triggered', 'emote:shown'].includes(e.type),
        ),
      );
    report.ai.matches.push({
      theme,
      players: start.players,
      events,
      turnReached: snapshot.view.turnId,
      appearanceStableOnRematch: true,
    });
    await c.close();
  }
  report.ai.hazardEvents = report.ai.matches
    .flatMap((m) => m.events)
    .filter((e) => e.type === 'hazard:triggered' && e.payload.sourceSeat === 1);
  report.ai.emoteEvents = report.ai.matches
    .flatMap((m) => m.events)
    .filter((e) => e.type === 'emote:shown' && e.payload.seat === 1);
  assert(report.ai.hazardEvents.length > 0, 'Observe at least one natural AI hazard');
  assert(report.ai.emoteEvents.length > 0, 'Observe at least one natural AI emote');
  assert.equal(report.errors.length, 0, 'No browser page or console errors');
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  await writeFile(path.join(output, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        localMatches: report.local.matches,
        hazards: report.local.hazards?.length,
        errors: report.errors,
        failure: report.failure,
      },
      null,
      2,
    ),
  );
}
