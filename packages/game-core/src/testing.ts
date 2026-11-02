import { Game } from './game.ts';
import type { HazardKind, Seat } from '@alkkagi/shared';

/**
 * 테스트 전용 Game. 검증을 우회해 권위 상태를 바꾸므로 `index.ts`에서 내보내지 않는다.
 */
export class TestGame extends Game {
  /** 테스트용: 난수 스트림 상태(거부된 명령이 난수를 바꾸지 않는지 확인) */
  debugPrngStates(): number[] {
    return [
      this.grantRng.state,
      this.shakeRng.state,
      this.visualRng.state,
      ...this.players.map((p) => p.random?.rng.state ?? -1),
    ];
  }

  /** 테스트용: 서버만 쓰는 내부 상태 */
  debugState() {
    return {
      phase: this.phase,
      completedTurns: this.completedTurns,
      stones: this.world.stones.map((s) => ({ ...s })),
      walls: this.world.walls.map((w) => ({ ...w })),
      players: this.players.map((p) => ({
        held: p.held ? { ...p.held } : null,
        gauge: p.gauge,
        overheated: p.overheated,
        cooldownEndsAtMs: p.cooldownEndsAtMs,
        timeoutStreak: p.timeoutStreak,
      })),
      effects: this.effects.map((e) => ({ ...e })),
    };
  }

  /** 테스트용: 알 위치를 직접 설정한다 */
  debugSetStone(id: number, x: number, y: number, alive = true, vx = 0, vy = 0): void {
    const s = this.world.stones.find((st) => st.id === id);
    if (s) Object.assign(s, { x, y, alive, vx, vy });
  }

  /** 테스트용: 보유 방해요소를 지정한다(랜덤 스트림은 정상 지급과 같은 방식으로 만든다) */
  debugGrant(seat: Seat, kind: HazardKind): void {
    this.grantOne(seat, false, kind);
  }
}
