// 개발용 장면 하네스. `npm run dev -w @alkkagi/client` 후 /scene-harness.html 로 연다(운영 빌드의 입력이 아니다).
// 쿼리: seat=0|1 board=standard|circle chars=bear,cat walls=1 sticky=1 aim=1 charge=1 place=wall|sticky
//       lift=1 spin=1 fall=1 shake=1
// 하네스는 합성 GameStart/GameView만 쓰며 `window.__harness`로 상태와 포인터 이벤트를 노출한다.
import { BOARDS, type GameStart, type GameView, type Seat } from '@alkkagi/shared';
import { spawnPositions } from '../../../../game-core/src/geometry.ts';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameScene } from './GameScene.tsx';
import type { AimRenderState, BoardPointerEvent, PlacementRenderState } from './scene-contract.ts';

const q = new URLSearchParams(window.location.search);
const mySeat: Seat = q.get('seat') === '1' ? 1 : 0;
const boardId = q.get('board') === 'circle' ? 'circle' : 'standard';
const [c0, c1] = (q.get('chars') ?? 'bear,fox').split(',');
const PIECES = 7;

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

let tick = 0;
function makeView(stones: StoneRow[], rot: number, effects: GameView['effects'] = []): GameView {
  tick += 4;
  return {
    gameId: 'harness',
    serverTick: tick,
    serverNowMs: Date.now(),
    revision: tick,
    phase: 'aiming',
    turnId: 1,
    round: 1,
    activePlayerId: 0,
    deadlineMs: Date.now() + 30000,
    boardRotationDeg: rot,
    stones,
    effects,
    result: null,
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
        startsAtMs: now,
        expiresAtMs: now + 600000,
        params: { x: -6, y: 3, orientation: 'horizontal' },
      },
      {
        kind: 'wall',
        targetSeat: 1,
        startsAtMs: now,
        expiresAtMs: now + 600000,
        params: { x: 8, y: -2, orientation: 'vertical' },
      },
    );
  }
  if (q.get('sticky')) {
    fx.push({
      kind: 'sticky',
      targetSeat: 0,
      startsAtMs: now,
      expiresAtMs: now + 600000,
      params: { x: 4, y: 8 },
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
        characterId: (c0 ?? 'bear') as GameStart['players'][0]['characterId'],
      },
      {
        seat: 1,
        nickname: 'B',
        characterId: (c1 ?? 'fox') as GameStart['players'][0]['characterId'],
      },
    ],
    board: boardId,
    pieceCount: PIECES,
    finalRound: 10,
    turnSeconds: 30,
    view,
  };
  return { start, view };
}

const init = initial();

function Harness() {
  const [view, setView] = useState(init.view);
  const [aim, setAim] = useState<AimRenderState | null>(
    q.get('aim')
      ? {
          stoneId: mySeat * PIECES + 3,
          angle: mySeat === 0 ? Math.PI / 2 + 0.3 : -Math.PI / 2 + 0.3,
          power: 62,
          charging: !!q.get('charge'),
        }
      : null,
  );
  const [placement, setPlacement] = useState<PlacementRenderState | null>(
    q.get('place')
      ? {
          kind: q.get('place') === 'sticky' ? 'sticky' : 'wall',
          x: 0,
          y: 0,
          orientation: 'horizontal',
          valid: q.get('invalid') ? false : true,
        }
      : null,
  );
  const events = useRef<BoardPointerEvent[]>([]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ id: number; sx: number; sy: number } | null>(null);

  useEffect(() => {
    const t: number[] = [];
    if (q.get('spin')) {
      t.push(
        window.setTimeout(() => {
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
        }, 600),
      );
    }
    if (q.get('fall')) {
      // 한 알이 판 밖으로 나가며 제거되는 장면: 0.5초에 경계 근처로 이동, 0.7초에 제거
      const id = (1 - mySeat) * PIECES + 2;
      t.push(
        window.setTimeout(() => {
          const v = viewRef.current;
          setView(
            makeView(
              v.stones.map((s) => (s.id === id ? { ...s, x: s.x + 8, y: s.y + 12 } : s)),
              v.boardRotationDeg,
              v.effects,
            ),
          );
        }, 500),
        window.setTimeout(() => {
          const v = viewRef.current;
          setView(
            makeView(
              v.stones.filter((s) => s.id !== id),
              v.boardRotationDeg,
              v.effects,
            ),
          );
        }, 540),
      );
    }
    if (q.get('shake')) {
      t.push(
        window.setTimeout(() => {
          const v = viewRef.current;
          const now = Date.now();
          setView(
            makeView(v.stones, v.boardRotationDeg, [
              ...v.effects,
              { kind: 'desk_shake', targetSeat: 0, startsAtMs: now, expiresAtMs: now + 500 },
            ]),
          );
        }, 500),
      );
    }
    return () => t.forEach((x) => window.clearTimeout(x));
  }, []);

  useEffect(() => {
    (window as unknown as { __harness: unknown }).__harness = {
      events: events.current,
      get view() {
        return viewRef.current;
      },
    };
  }, []);

  const onPointer = (e: BoardPointerEvent) => {
    events.current.push(e);
    if (events.current.length > 200) events.current.shift();
    if (q.get('interactive') === null) return;
    if (e.type === 'down' && e.stoneId !== null && e.point) {
      const st = viewRef.current.stones.find((s) => s.id === e.stoneId);
      if (st) {
        drag.current = { id: st.id, sx: st.x, sy: st.y };
        setAim({ stoneId: st.id, angle: 0, power: 0, charging: false });
      }
    } else if (e.type === 'move' && e.point && drag.current) {
      const d = drag.current;
      setAim({
        stoneId: d.id,
        angle: Math.atan2(e.point.y - d.sy, e.point.x - d.sx),
        power: Math.min(100, Math.hypot(e.point.x - d.sx, e.point.y - d.sy) * 3),
        charging: true,
      });
    } else if (e.type === 'up' || e.type === 'cancel') drag.current = null;
    if (placement && e.point) setPlacement({ ...placement, x: e.point.x, y: e.point.y });
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GameScene
        start={init.start}
        view={view}
        mySeat={mySeat}
        aim={aim}
        placement={placement}
        onPointer={onPointer}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
