// 개발용 장면 하네스. `npm run dev -w @alkkagi/client` 후 /scene-harness.html 로 연다(운영 빌드의 입력이 아니다).
// 쿼리:
//   seat=0|1 board=standard|circle theme=bar|rooftop|classroom|beach looks=0000000,0101010(두상·머리카락·눈썹·눈·코·입술·피부색 번호 7자리) cam=default|first shake=0~1
//   walls=1 sticky=1 place=wall|sticky invalid=1 lift=1 spin=1 fall=1 desk=1
//   aim=<내 알 번호 0~6> charge=<세기> unreach=1 strain=0~1   (내 조준: aim 상태 + 내 포즈)
//   opp=aim|charge|rotate|hold oppstone=<상대 알 번호> hold=flashlight|water_gun   (상대 포즈, 20Hz로 흔들며 보냄)
//   me=rotate|hold                                          (내 포즈)
//   beam=flashlight|water_gun beamby=0|1 coverage=0~1        (발동 중인 후레쉬·물총 효과)
//   stun=0|1                                                 (그 좌석 기절: 머리 위 별, 내 좌석이면 화면 한 바퀴 회전, 8초)
//   react0=win react1=lose                                   (시작 0.3초 뒤 반응)
//   emote0=yawn|taunt|doze|gg|laugh|surprise emote1=… emoteAge=600 (반복 표시, 경과 ms 고정 선택)
//   flick=1                                                  (1초 뒤 상대가 조준하던 알을 쏜다)
//   interactive=1                                            (왼쪽 드래그로 조준)
// 하네스는 합성 GameStart/GameView만 쓰며 `window.__harness`로 상태·포인터 이벤트·조작 함수를 노출한다.
import {
  APPEARANCE_KEYS,
  EMOTE_IDS,
  type EmoteId,
  type EmoteShown,
  BOARDS,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  type Appearance,
  PHYSICS,
  THEME_IDS,
  type ThemeId,
  type GameStart,
  type GameView,
  type HazardKind,
  type Seat,
} from '@alkkagi/shared';
import { spawnPositions } from '../../../../game-core/src/geometry.ts';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameScene } from './GameScene.tsx';
import {
  CAMERA_PRESETS,
  type AimRenderState,
  type BoardPointerEvent,
  type CameraPreset,
  type CharacterPose,
  type PlacementRenderState,
  type Reaction,
  type ReactionKind,
} from './scene-contract.ts';

const q = new URLSearchParams(window.location.search);
const mySeat: Seat = q.get('seat') === '1' ? 1 : 0;
const oppSeat: Seat = mySeat === 0 ? 1 : 0;
const boardId = q.get('board') === 'circle' ? 'circle' : 'standard';
const themeParam = q.get('theme');
const themeId: ThemeId = THEME_IDS.find((t) => t === themeParam) ?? 'bar';
const [look0, look1] = (q.get('looks') ?? '').split(',');

/** 'looks' 쿼리의 7자리 숫자(두상·머리카락·눈썹·눈·코·입술·피부색 순)를 외형으로 읽는다 */
function lookFrom(digits: string | undefined, fallback: Appearance): Appearance {
  if (!digits || !/^[0-4]{7}$/.test(digits)) return fallback;
  return normalizeAppearance(
    Object.fromEntries(APPEARANCE_KEYS.map((k, i) => [k, Number(digits[i])])),
  );
}
const PIECES = 7;
const T0 = Date.now();

type StoneRow = GameView['stones'][number];

function baseStones(): StoneRow[] {
  const def = BOARDS[boardId];
  const out: StoneRow[] = [];
  for (const seat of [0, 1] as const) {
    spawnPositions(def, seat, PIECES).forEach(([x, y], i) => {
      out.push({ id: seat * PIECES + i, ownerId: seat, x, y, h: 0 });
    });
  }
  return out;
}

/** 서버 틱은 실제 경과 시간에 맞춘다(보간 시계가 실시간으로 흐르게) */
function makeView(stones: StoneRow[], rot: number, effects: GameView['effects'] = []): GameView {
  const tick = Math.round(((Date.now() - T0) / 1000) * PHYSICS.tickHz) + 1;
  return {
    gameId: 'harness',
    serverTick: tick,
    serverNowMs: Date.now(),
    revision: tick,
    phase: 'aiming',
    turnId: 1,
    round: 1,
    activePlayerId: q.get('flick') ? oppSeat : mySeat,
    deadlineMs: Date.now() + 30000,
    boardRotationDeg: rot,
    stones,
    effects,
    result: null,
    stoneCounts: [
      stones.filter((s) => s.ownerId === 0).length,
      stones.filter((s) => s.ownerId === 1).length,
    ],
    // ?decoys=1: 내 분신술 허상 2개(시전자 화면)
    ...(q.get('decoys')
      ? {
          decoys: [
            { decoyId: 100, x: -4, y: -6 },
            { decoyId: 101, x: 7, y: -9 },
          ],
        }
      : {}),
    private: {
      held: null,
      fatigueGauge: null,
      overheated: false,
      cooldownEndsAtMs: null,
      usable: true,
      timeoutStreak: 0,
    },
  };
}

function staticEffects(): GameView['effects'] {
  const now = Date.now();
  const fx: GameView['effects'] = [];
  if (q.get('walls')) {
    fx.push(
      {
        kind: 'wall',
        targetSeat: 1,
        startsAtMs: now + 300,
        expiresAtMs: now + 600000,
        params: { x: -6, y: 3, orientation: 'horizontal' },
      },
      {
        kind: 'wall',
        targetSeat: 1,
        startsAtMs: now + 300,
        expiresAtMs: now + 600000,
        params: { x: 12, y: -2, orientation: 'vertical' },
      },
    );
  }
  if (q.get('sticky')) {
    fx.push({
      kind: 'sticky',
      targetSeat: 0,
      startsAtMs: now + 300,
      expiresAtMs: now + 600000,
      params: { x: 4, y: 8 },
    });
  }
  // 추가 방해요소 표시 확인(IMPL-016): ?zones=1 은 6종 설치물, ?ice=1 은 미끄럼 장판
  if (q.get('zones')) {
    const add = (kind: GameView['effects'][number]['kind'], params: object) =>
      fx.push({ kind, targetSeat: 1, startsAtMs: now + 300, expiresAtMs: now + 600000, params });
    add('magnet', { x: -11, y: 4 });
    add('gravity_zone', { x: 10, y: 6, directionRad: Math.PI / 4, angleDeg: 0 });
    add('reverse_zone', { x: -12, y: -5 });
    add('mine', { x: 4, y: -4 });
    add('pit', { x: 12, y: -7 });
    add('moving_wall', { x: 0, y: 2, orientation: 'horizontal', angleDeg: 90 });
  }
  if (q.get('ice')) {
    fx.push({
      kind: 'ice_floor',
      targetSeat: 1,
      startsAtMs: now,
      expiresAtMs: now + 600000,
      params: { x: -4, y: 6 },
    });
  }
  const beam = q.get('beam');
  if (beam === 'flashlight' || beam === 'water_gun') {
    const by: Seat = q.get('beamby') === '1' ? 1 : q.get('beamby') === '0' ? 0 : oppSeat;
    const target: Seat = by === 0 ? 1 : 0;
    const ty = target === 0 ? -30 : 30;
    fx.push({
      kind: beam,
      targetSeat: target,
      startsAtMs: now,
      expiresAtMs: now + 600000,
      params: { aimX: 1.5, aimY: ty, aimH: 23, coverage: Number(q.get('coverage') ?? '0.8') },
    });
  }
  const stun = q.get('stun');
  if (stun === '0' || stun === '1') {
    fx.push({
      kind: 'stun',
      targetSeat: stun === '0' ? 0 : 1,
      startsAtMs: now + 500,
      expiresAtMs: now + 8500,
    });
  }
  return fx;
}

function initial(): { start: GameStart; view: GameView } {
  const stones = baseStones();
  if (q.get('lift')) {
    const s = stones[2];
    if (s) {
      s.h = 4.4;
      s.x += 1;
    }
  }
  const view = makeView(stones, 0, staticEffects());
  const start: GameStart = {
    gameId: 'harness',
    seat: mySeat,
    players: [
      {
        seat: 0,
        nickname: 'A',
        appearance: lookFrom(look0, DEFAULT_APPEARANCE),
      },
      {
        seat: 1,
        nickname: 'B',
        appearance: lookFrom(look1, { ...DEFAULT_APPEARANCE, hair: 1, skinTone: 1, eyes: 1 }),
      },
    ],
    board: boardId,
    theme: themeId,
    pieceCount: PIECES,
    finalRound: 10,
    turnSeconds: 30,
    view,
  };
  return { start, view };
}

const init = initial();

/** seat 쪽 알 하나에서 판 중심 쪽(상대 진영)을 향한 각 */
function forwardAngle(seat: Seat): number {
  return seat === 0 ? Math.PI / 2 + 0.25 : -Math.PI / 2 + 0.25;
}

function initialAim(): AimRenderState | null {
  const a = q.get('aim');
  if (a === null) return null;
  const charge = q.get('charge');
  return {
    stoneId: mySeat * PIECES + Number(a || '3'),
    angle: forwardAngle(mySeat),
    power: charge ? Number(charge) : 0,
    charging: charge !== null,
    reachable: !q.get('unreach'),
    strain: Number(q.get('strain') ?? '0'),
  };
}

function holdTarget(seatHolding: Seat) {
  // 상대 얼굴 근처
  const ty = seatHolding === 0 ? 30 : -30;
  return { x: 2, y: ty, h: 24 };
}

function posesFor(
  aim: AimRenderState | null,
  wobble: number,
): [CharacterPose | null, CharacterPose | null] {
  const out: [CharacterPose | null, CharacterPose | null] = [null, null];
  const hk = (q.get('hold') ?? 'flashlight') as HazardKind;
  if (aim) {
    out[mySeat] = {
      mode: aim.charging ? 'charge' : 'aim',
      stoneId: aim.stoneId,
      angle: aim.angle,
      power: aim.power,
    };
  } else if (q.get('me') === 'rotate') out[mySeat] = { mode: 'rotate' };
  else if (q.get('me') === 'hold')
    out[mySeat] = { mode: 'hold_hazard', kind: hk, target: holdTarget(mySeat) };
  const opp = q.get('opp');
  const oppStone = oppSeat * PIECES + Number(q.get('oppstone') ?? '1');
  if (opp === 'aim' || opp === 'charge') {
    out[oppSeat] = {
      mode: opp,
      stoneId: oppStone,
      angle: forwardAngle(oppSeat) + Math.sin(wobble) * 0.2,
      power: opp === 'charge' ? 55 + Math.sin(wobble * 0.7) * 30 : 0,
    };
  } else if (opp === 'rotate') out[oppSeat] = { mode: 'rotate' };
  else if (opp === 'hold') {
    const t = holdTarget(oppSeat);
    out[oppSeat] = {
      mode: 'hold_hazard',
      kind: hk,
      target: { ...t, x: t.x + Math.sin(wobble) * 6 },
    };
  }
  return out;
}

function Harness() {
  const [emotes, setEmotes] = useState<[EmoteShown | null, EmoteShown | null]>([null, null]);
  const [view, setView] = useState(init.view);
  const [aim, setAim] = useState<AimRenderState | null>(initialAim);
  const [placement, setPlacement] = useState<PlacementRenderState | null>(
    q.get('place')
      ? {
          kind: (q.get('place') ?? 'wall') as PlacementRenderState['kind'],
          x: 0,
          y: 0,
          orientation: q.get('vertical') ? 'vertical' : 'horizontal',
          directionRad: Math.PI / 4,
          valid: q.get('invalid') ? false : true,
        }
      : null,
  );
  const [preset, setPreset] = useState<{ p: CameraPreset; n: number }>(() => {
    const c = q.get('cam') as CameraPreset | null;
    return { p: c && (CAMERA_PRESETS as readonly string[]).includes(c) ? c : 'default', n: 0 };
  });
  const [wobble, setWobble] = useState(0);
  const [poseOverride, setPoseOverride] = useState<
    [CharacterPose | null, CharacterPose | null] | null
  >(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const events = useRef<BoardPointerEvent[]>([]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ id: number; sx: number; sy: number } | null>(null);
  const reactId = useRef(1);

  const react = (seat: Seat, kind: ReactionKind) =>
    setReactions((r) => [...r.slice(-8), { seat, kind, id: reactId.current++ }]);

  // 상대 포즈를 20Hz로 흔들어 네트워크 중계처럼 보낸다
  useEffect(() => {
    const id = window.setInterval(() => setWobble((w) => w + 0.15), 50);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const t: number[] = [];
    const later = (ms: number, f: () => void) => t.push(window.setTimeout(f, ms));
    // 시간이 흐르도록 주기적으로 같은 상태를 다시 보낸다(서버 스냅샷처럼)
    const pump = window.setInterval(() => {
      const v = viewRef.current;
      setView(makeView(v.stones, v.boardRotationDeg, v.effects));
      if (q.has('emote0') || q.has('emote1'))
        setEmotes(
          ([a, b]) =>
            [0, 1].map((seat) => {
              const emote = EMOTE_IDS.find((kind) => kind === q.get(`emote${seat}`));
              const prev = seat === 0 ? a : b;
              return emote
                ? {
                    gameId: 'harness',
                    seat: seat as Seat,
                    emote,
                    atMs:
                      Date.now() -
                      (q.has('emoteAge')
                        ? Math.max(0, Math.min(1200, Number(q.get('emoteAge')) || 0))
                        : (Date.now() - T0) % 1500),
                  }
                : prev;
            }) as [EmoteShown | null, EmoteShown | null],
        );
    }, 100);
    for (const s of [0, 1] as const) {
      const k = q.get(`react${s}`);
      if (k) later(300, () => react(s, k as ReactionKind));
    }
    if (q.get('spin')) {
      later(600, () => {
        const v = viewRef.current;
        const rad = (45 * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        setView(
          makeView(
            v.stones.map((st) => ({ ...st, x: st.x * c - st.y * s, y: st.x * s + st.y * c })),
            v.boardRotationDeg + 45,
            v.effects.map((e) =>
              e.params?.x === undefined || e.params.y === undefined
                ? e
                : {
                    ...e,
                    params: {
                      ...e.params,
                      x: e.params.x * c - e.params.y * s,
                      y: e.params.x * s + e.params.y * c,
                      angleDeg: (e.params.orientation === 'vertical' ? 90 : 0) + 45,
                    },
                  },
            ),
          ),
        );
      });
    }
    if (q.get('fall')) {
      const id = (1 - mySeat) * PIECES + 2;
      later(500, () => {
        const v = viewRef.current;
        setView(
          makeView(
            v.stones.map((s) => (s.id === id ? { ...s, x: s.x + 8, y: s.y + 12 } : s)),
            v.boardRotationDeg,
            v.effects,
          ),
        );
      });
      later(540, () => {
        const v = viewRef.current;
        setView(
          makeView(
            v.stones.filter((s) => s.id !== id),
            v.boardRotationDeg,
            v.effects,
          ),
        );
      });
    }
    if (q.get('desk')) {
      later(500, () => {
        const v = viewRef.current;
        const now = Date.now();
        setView(
          makeView(v.stones, v.boardRotationDeg, [
            ...v.effects,
            { kind: 'desk_shake', targetSeat: 0, startsAtMs: now, expiresAtMs: now + 500 },
          ]),
        );
      });
    }
    if (q.get('flick')) {
      // 1초 뒤 상대가 조준하던 알이 빠르게 나가고 포즈는 idle이 된다
      const id = oppSeat * PIECES + Number(q.get('oppstone') ?? '1');
      later(1000, () => {
        setPoseOverride([null, null]);
        const st = viewRef.current.stones.find((s) => s.id === id);
        if (!st) return;
        const a = forwardAngle(oppSeat);
        let k = 0;
        const iv = window.setInterval(() => {
          k++;
          const v = viewRef.current;
          const d = Math.min(30, k * 4.5);
          setView(
            makeView(
              v.stones.map((s) =>
                s.id === id ? { ...s, x: st.x + Math.cos(a) * d, y: st.y + Math.sin(a) * d } : s,
              ),
              v.boardRotationDeg,
              v.effects,
            ),
          );
          if (d >= 30) window.clearInterval(iv);
        }, 33);
        t.push(iv);
      });
    }
    return () => {
      t.forEach((x) => {
        window.clearTimeout(x);
        window.clearInterval(x);
      });
      window.clearInterval(pump);
    };
  }, []);

  useEffect(() => {
    (window as unknown as { __harness: unknown }).__harness = {
      events: events.current,
      get view() {
        return viewRef.current;
      },
      setPreset: (p: CameraPreset) => setPreset((s) => ({ p, n: s.n + 1 })),
      react,
      setPose: (seat: Seat, pose: CharacterPose | null) =>
        setPoseOverride((o) => {
          const next: [CharacterPose | null, CharacterPose | null] = o
            ? [o[0], o[1]]
            : [null, null];
          next[seat] = pose;
          return next;
        }),
      setAim,
      emote: (seat: Seat, emote: EmoteId) =>
        setEmotes((prev) => {
          const next: [EmoteShown | null, EmoteShown | null] = [...prev];
          next[seat] = { gameId: 'harness', seat, emote, atMs: Date.now() };
          return next;
        }),
    };
  }, []);

  const onPointer = (e: BoardPointerEvent) => {
    events.current.push(e);
    if (events.current.length > 200) events.current.shift();
    if (q.get('interactive') === null) return;
    if (e.type === 'down' && e.button === 2) {
      drag.current = null;
      setAim(null);
      return;
    }
    if (e.type === 'down' && e.stoneId !== null && e.point) {
      const st = viewRef.current.stones.find((s) => s.id === e.stoneId);
      if (st) {
        drag.current = { id: st.id, sx: st.x, sy: st.y };
        setAim({ stoneId: st.id, angle: 0, power: 0, charging: false, reachable: true, strain: 0 });
      }
    } else if (e.type === 'move' && e.point && drag.current) {
      const d = drag.current;
      setAim({
        stoneId: d.id,
        angle: Math.atan2(d.sy - e.point.y, d.sx - e.point.x),
        power: Math.min(100, Math.hypot(e.point.x - d.sx, e.point.y - d.sy) * 3),
        charging: true,
        reachable: true,
        strain: 0,
      });
    } else if (e.type === 'up' || e.type === 'cancel') drag.current = null;
    if (placement && e.point) setPlacement({ ...placement, x: e.point.x, y: e.point.y });
  };

  const poses = poseOverride ?? posesFor(aim, wobble);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GameScene
        emotes={emotes}
        start={init.start}
        view={view}
        mySeat={mySeat}
        aim={aim}
        placement={placement}
        onPointer={onPointer}
        poses={poses}
        reactions={reactions}
        cameraPreset={preset.p}
        cameraPresetNonce={preset.n}
        shake={Number(q.get('shake') ?? '0')}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
