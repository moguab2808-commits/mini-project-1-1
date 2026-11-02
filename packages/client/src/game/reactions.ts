// 결과에 따른 캐릭터 표정·몸짓(`SceneProps.reactions`)을 상태 변화에서 만든다. React에 의존하지 않는다.
//
// - 발사 후 알 정지: 직전 조준 단계와 정지 뒤의 좌석별 남은 알 수를 비교한다.
// - 방해요소가 나를 대상으로 발동: 내 캐릭터 'hit'.
// - 경기 종료: 승·패·무.
import type { GameOver, GameView, HazardTriggered, Seat } from '@alkkagi/shared';
import type { Reaction, ReactionKind } from './scene/scene-contract.ts';

export type ReactionSeed = Omit<Reaction, 'id'>;

/** 장면에 넘기는 최근 반응 개수. 장면은 처음 보는 id만 재생하므로 오래된 것은 버려도 된다 */
export const MAX_REACTIONS = 8;

export function stoneCounts(view: GameView): [number, number] {
  let a = 0;
  let b = 0;
  for (const s of view.stones) {
    if (s.ownerId === 0) a++;
    else b++;
  }
  return [a, b];
}

/** 발사 결과 반응: 쏜 쪽은 great/trade/own/miss, 상대는 내 알을 잃으면 shocked, 아니면 taunt */
export function settleReactions(
  shooter: Seat,
  before: readonly [number, number],
  after: readonly [number, number],
): ReactionSeed[] {
  const other: Seat = shooter === 0 ? 1 : 0;
  const lostOther = before[other] - after[other] > 0;
  const lostOwn = before[shooter] - after[shooter] > 0;
  let kind: ReactionKind;
  if (lostOther && lostOwn) kind = 'trade';
  else if (lostOther) kind = 'great';
  else if (lostOwn) kind = 'own';
  else kind = 'miss';
  return [
    { seat: shooter, kind },
    { seat: other, kind: lostOther ? 'shocked' : 'taunt' },
  ];
}

/** 방해요소 발동 반응: 내가 대상일 때만 내 캐릭터가 'hit' */
export function hazardReactions(event: HazardTriggered, mySeat: Seat): ReactionSeed[] {
  if (event.phase !== 'start' || event.targetSeat !== mySeat) return [];
  return [{ seat: mySeat, kind: 'hit' }];
}

export function gameOverReactions(result: GameOver): ReactionSeed[] {
  if (result.winnerId === null) {
    return [
      { seat: 0, kind: 'draw' },
      { seat: 1, kind: 'draw' },
    ];
  }
  const loser: Seat = result.winnerId === 0 ? 1 : 0;
  return [
    { seat: result.winnerId, kind: 'win' },
    { seat: loser, kind: 'lose' },
  ];
}

/**
 * 상태 변화를 받아 반응 목록을 유지한다. `useSyncExternalStore`로 연결할 수 있게 구독을 제공한다.
 * 발사는 `aiming → moving` 전이로 감지하고, `moving`이 끝난 첫 스냅샷에서 결과를 계산한다.
 */
export class ReactionTracker {
  private list: readonly Reaction[] = [];
  private nextId = 1;
  private lastView: GameView | null = null;
  private shot: { gameId: string; shooter: Seat; before: [number, number] } | null = null;
  private overGameId: string | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly mySeat: Seat) {}

  getReactions = (): readonly Reaction[] => this.list;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  onView(view: GameView): void {
    const prev = this.lastView;
    this.lastView = view;
    if (prev && prev.gameId !== view.gameId) this.shot = null; // 새 경기
    if (prev && prev.gameId === view.gameId && prev.phase === 'aiming' && view.phase === 'moving') {
      this.shot = { gameId: view.gameId, shooter: prev.activePlayerId, before: stoneCounts(prev) };
      return;
    }
    const shot = this.shot;
    if (
      shot &&
      view.gameId === shot.gameId &&
      view.phase !== 'moving' &&
      view.phase !== 'resolving'
    ) {
      this.shot = null;
      this.push(settleReactions(shot.shooter, shot.before, stoneCounts(view)));
    }
  }

  onHazard(event: HazardTriggered): void {
    this.push(hazardReactions(event, this.mySeat));
  }

  onGameOver(result: GameOver): void {
    if (this.overGameId === result.gameId) return;
    this.overGameId = result.gameId;
    // 마지막 발사로 끝났으면 발사 반응을 먼저 내보낸다(종료 스냅샷보다 결과가 먼저 올 수 있다)
    const shot = this.shot;
    if (shot && shot.gameId === result.gameId && this.lastView?.gameId === result.gameId) {
      this.shot = null;
      this.push(settleReactions(shot.shooter, shot.before, result.remainingStones));
    }
    this.push(gameOverReactions(result));
  }

  private push(seeds: ReactionSeed[]): void {
    if (seeds.length === 0) return;
    const added = seeds.map((s) => ({ ...s, id: this.nextId++ }));
    this.list = [...this.list, ...added].slice(-MAX_REACTIONS);
    for (const l of this.listeners) l();
  }
}
