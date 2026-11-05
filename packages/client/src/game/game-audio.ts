// 경기 소리 연출(DEC-084). 서버 이벤트(턴·방해요소·결과·감정표현)와 스냅샷 변화(발사·알 충돌·떨어짐·착지·
// 자석에 붙잡힘)를 효과음으로 바꾼다. 충돌은 이벤트가 없어 스냅샷의 알 거리·속도로 추정한다(소리 전용이며 판정과 무관).
// 판단은 순수 함수(`detectStoneSounds`)로 두어 테스트하고, 재생은 `audio` 엔진에 맡긴다.
import {
  HAZARD_TUNING,
  PHYSICS,
  type EmoteId,
  type GameOver,
  type GameView,
  type HazardKind,
  type HazardTriggered,
  type Seat,
  type TurnChange,
} from '@alkkagi/shared';
import { audio, type SfxId } from '../audio/engine.ts';

type StoneView = GameView['stones'][number];

export type StoneSound =
  | { kind: 'clack'; x: number; y: number; speed: number }
  | { kind: 'fall'; x: number; y: number }
  | { kind: 'pit'; x: number; y: number }
  | { kind: 'land'; x: number; y: number }
  | { kind: 'lift'; x: number; y: number }
  | { kind: 'magnet_suck'; x: number; y: number };

/** 이만큼(cm) 안으로 들어오면 닿았다고 본다(스냅샷 간격 탓에 실제 접촉보다 조금 넉넉히) */
const TOUCH = PHYSICS.stoneRadius * 2 + 0.35;
/** 이 상대 속도(cm/s) 미만의 스침은 소리를 내지 않는다 */
const MIN_CLACK_SPEED = 4;

/** 이전 스냅샷과 비교해 날 소리를 고른다. `touching`은 지금 닿아 있는 쌍(다음 호출에 넘긴다) */
export function detectStoneSounds(
  prev: readonly StoneView[],
  cur: readonly StoneView[],
  dtSec: number,
  ctx: {
    touching: Set<string>;
    pits: readonly { x: number; y: number }[];
    magnets: readonly { x: number; y: number }[];
    captured: Set<number>;
  },
): StoneSound[] {
  const out: StoneSound[] = [];
  if (dtSec <= 0) return out;
  const before = new Map(prev.map((s) => [s.id, s]));
  const vel = new Map<number, [number, number]>();
  for (const s of cur) {
    const p = before.get(s.id);
    vel.set(s.id, p ? [(s.x - p.x) / dtSec, (s.y - p.y) / dtSec] : [0, 0]);
    if (p) {
      if (p.h <= 0.05 && s.h > 0.3) out.push({ kind: 'lift', x: s.x, y: s.y });
      if (p.h > 0.3 && s.h <= 0.05) out.push({ kind: 'land', x: s.x, y: s.y });
    }
  }
  // 사라진 알: 구멍 안이면 빠짐, 아니면 판 밖으로 떨어짐
  const now = new Set(cur.map((s) => s.id));
  for (const p of prev) {
    if (now.has(p.id)) continue;
    const inPit = ctx.pits.some(
      (q) =>
        Math.hypot(q.x - p.x, q.y - p.y) <= HAZARD_TUNING.pitDiameter / 2 + PHYSICS.stoneRadius,
    );
    out.push({ kind: inPit ? 'pit' : 'fall', x: p.x, y: p.y });
  }
  // 새로 닿은 쌍
  const touching = new Set<string>();
  for (let i = 0; i < cur.length; i++) {
    for (let j = i + 1; j < cur.length; j++) {
      const a = cur[i]!;
      const b = cur[j]!;
      if (a.h > 0.3 || b.h > 0.3) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > TOUCH) continue;
      const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
      touching.add(key);
      if (ctx.touching.has(key)) continue;
      const va = vel.get(a.id) ?? [0, 0];
      const vb = vel.get(b.id) ?? [0, 0];
      const speed = Math.hypot(va[0] - vb[0], va[1] - vb[1]);
      if (speed >= MIN_CLACK_SPEED)
        out.push({ kind: 'clack', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, speed });
    }
  }
  ctx.touching.clear();
  for (const k of touching) ctx.touching.add(k);
  // 자석 범위로 움직여 들어온 알(알마다 한 번, 범위를 벗어나면 다시 셀 수 있다)
  for (const s of cur) {
    const [vx, vy] = vel.get(s.id) ?? [0, 0];
    const inside = ctx.magnets.some(
      (m) => Math.hypot(m.x - s.x, m.y - s.y) <= HAZARD_TUNING.magnetRadius,
    );
    if (!inside) {
      ctx.captured.delete(s.id);
      continue;
    }
    if (!ctx.captured.has(s.id) && Math.hypot(vx, vy) > 2) {
      ctx.captured.add(s.id);
      out.push({ kind: 'magnet_suck', x: s.x, y: s.y });
    }
  }
  return out;
}

/** 방해요소 발동 효과음 */
export const HAZARD_SFX: Record<HazardKind, SfxId> = {
  board_spin: 'spin',
  flashlight: 'flash',
  water_gun: 'water',
  desk_shake: 'shake',
  wall: 'brick',
  sticky: 'slime',
  stun: 'stun',
  bar_speed: 'speed',
  wind: 'wind',
  magnet: 'magnet',
  gravity_zone: 'gravity',
  ice_floor: 'ice',
  decoy: 'decoy',
  fake_wall: 'brick',
  heavy_stones: 'heavy',
  reverse_zone: 'reverse',
  mine: 'bomb_place',
  pit: 'pit_open',
  moving_wall: 'brick',
};

export const EMOTE_SFX: Record<EmoteId, SfxId> = {
  yawn: 'emote_yawn',
  taunt: 'emote_taunt',
  doze: 'emote_doze',
  gg: 'emote_gg',
  laugh: 'emote_laugh',
  surprise: 'emote_surprise',
};

/** 결과 효과음: 내 좌석 기준 */
export function resultSfx(r: Pick<GameOver, 'winnerId'>, mySeat: Seat): SfxId {
  if (r.winnerId === null) return 'draw';
  return r.winnerId === mySeat ? 'win' : 'lose';
}

/** 내 차례에 남은 시간 째깍(5·4·3·2·1초). 이번에 울릴 초를 돌려준다(없으면 null) */
export function countdownSecond(remainingMs: number, lastTicked: number | null): number | null {
  const sec = Math.ceil(remainingMs / 1000);
  if (sec < 1 || sec > 5 || sec === lastTicked) return null;
  return sec;
}

/** 경기 하나의 소리 연출. GameScreen이 이벤트·스냅샷을 넘긴다 */
export class GameAudioDirector {
  private prev: {
    stones: StoneView[];
    at: number;
    phase: GameView['phase'];
    gameId: string;
  } | null = null;
  private readonly touch = { touching: new Set<string>(), captured: new Set<number>() };
  private lastTick: number | null = null;
  private stopSpray: (() => void) | null = null;

  constructor(private readonly mySeat: Seat) {}

  /** 내 화면에서 왼쪽·오른쪽(좌석 1은 판이 돌아 보인다) */
  private pan(x: number): number {
    return (this.mySeat === 0 ? x : -x) / 30;
  }

  onView(view: GameView, nowMs: number) {
    const p = this.prev;
    if (p && p.gameId === view.gameId) {
      if (p.phase === 'aiming' && view.phase === 'moving') audio.sfx('shot');
      const pits = view.effects.filter((e) => e.kind === 'pit' && e.params?.x !== undefined);
      const magnets = view.effects.filter((e) => e.kind === 'magnet' && e.params?.x !== undefined);
      const sounds = detectStoneSounds(p.stones, view.stones, (nowMs - p.at) / 1000, {
        ...this.touch,
        pits: pits.map((e) => ({ x: e.params!.x!, y: e.params!.y! })),
        magnets: magnets.map((e) => ({ x: e.params!.x!, y: e.params!.y! })),
      });
      for (const s of sounds) {
        // 판 밖으로 떨어지는 소리는 내지 않는다(사용자 선택, DEC-086)
        if (s.kind === 'fall') continue;
        const pan = this.pan(s.x);
        if (s.kind === 'clack')
          audio.sfx('clack', {
            pan,
            gain: Math.min(1.2, 0.35 + s.speed / 80),
            rate: 0.9 + Math.random() * 0.2,
          });
        else audio.sfx(s.kind, { pan });
      }
    } else {
      this.touch.touching.clear();
      this.touch.captured.clear();
    }
    this.prev = {
      stones: view.stones.map((s) => ({ ...s })),
      at: nowMs,
      phase: view.phase,
      gameId: view.gameId,
    };
  }

  /** 짧은 간격으로 불러 남은 시간 째깍을 낸다 */
  tick(view: GameView | null, serverNowMs: number) {
    if (!view || view.phase !== 'aiming' || view.activePlayerId !== this.mySeat) {
      this.lastTick = null;
      return;
    }
    const sec = countdownSecond(view.deadlineMs - serverNowMs, this.lastTick);
    if (sec !== null) {
      this.lastTick = sec;
      audio.sfx('tick', { rate: sec === 1 ? 1.5 : 1 });
    }
  }

  onTurn(e: TurnChange) {
    if (e.reason === 'start' && e.turnId <= 1) return;
    audio.sfx(e.activePlayerId === this.mySeat ? 'my_turn' : 'opp_turn');
  }

  onGranted() {
    audio.sfx('grant');
  }

  onHazard(e: HazardTriggered) {
    const x = e.params?.x;
    const pan = x === undefined ? 0 : this.pan(x);
    if (e.phase === 'start') {
      // 바람은 방향이 바뀔 때마다, 막대 속도는 지급과 함께 오므로 크게 울리지 않는다
      audio.sfx(HAZARD_SFX[e.kind], { pan, gain: e.kind === 'bar_speed' ? 0.5 : 1 });
      if (e.kind === 'water_gun') {
        this.stopSpray?.();
        this.stopSpray = audio.loop('spray', { gain: 0.8 });
      }
      return;
    }
    if (e.kind === 'mine' && e.params?.exploded) audio.sfx('bomb', { pan });
    if (e.kind === 'water_gun') {
      this.stopSpray?.();
      this.stopSpray = null;
    }
  }

  onEmote(emote: EmoteId) {
    audio.sfx(EMOTE_SFX[emote]);
  }

  onGameOver(r: GameOver) {
    this.stopSpray?.();
    this.stopSpray = null;
    audio.duckMusic(0.25);
    audio.sfx(resultSfx(r, this.mySeat));
    setTimeout(() => audio.duckMusic(1, 1.5), 3000);
  }

  dispose() {
    this.stopSpray?.();
    this.stopSpray = null;
    audio.duckMusic(1);
  }
}
