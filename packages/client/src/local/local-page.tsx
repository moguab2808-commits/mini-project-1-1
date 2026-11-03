// 개발용 `/local?seat=0|1[&theme=bar|rooftop|classroom|beach]` 화면. 창 2개를 띄워 각자 한 좌석을 맡는다(DEC-020).
// 방 테마는 먼저 연결한 창의 `theme` 값을 쓰고, 없거나 잘못되면 권한 측이 기본 테마로 바꾼다(DEC-052).
import type { ThemeId } from '@alkkagi/shared';
import { useEffect, useState } from 'react';
import { GameScreen } from '../game/GameScreen.tsx';
import { GameStore } from '../game/game-store.ts';
import {
  LocalGameSession,
  LocalSessionRejectedError,
  type SessionPort,
} from './local-game-session.ts';
import type { RejectReason } from './messages.ts';

type Phase =
  | { t: 'unsupported' }
  | { t: 'badSeat' }
  | { t: 'connecting' }
  | { t: 'rejected'; reason: RejectReason }
  | { t: 'playing'; session: LocalGameSession; store: GameStore }
  | { t: 'exited' };

const REJECT_TEXT: Record<RejectReason, string> = {
  SEAT_TAKEN: '이 좌석은 다른 창이 사용 중이에요. 다른 좌석(seat)으로 열어 주세요.',
  SEAT_DEPARTED:
    '이 좌석은 이미 경기에서 나갔어요. 두 창을 모두 닫은 뒤 다시 열면 새 경기가 시작돼요.',
  INVALID_HELLO: '좌석 값이 올바르지 않아요.',
};

function parseSeat(search: string): 0 | 1 | null {
  const seat = new URLSearchParams(search).get('seat');
  return seat === '0' ? 0 : seat === '1' ? 1 : null;
}

export function LocalPage() {
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof SharedWorker === 'undefined') return { t: 'unsupported' };
    return parseSeat(window.location.search) === null ? { t: 'badSeat' } : { t: 'connecting' };
  });

  useEffect(() => {
    const seat = parseSeat(window.location.search);
    if (typeof SharedWorker === 'undefined' || seat === null) return;
    const worker = new SharedWorker(new URL('./local-worker.ts', import.meta.url), {
      type: 'module',
      name: 'alkkagi-local',
    });
    const theme = (new URLSearchParams(window.location.search).get('theme') ?? undefined) as
      ThemeId | undefined;
    const session = new LocalGameSession(worker.port as unknown as SessionPort, { seat, theme });
    const store = new GameStore(session);
    let cancelled = false;
    // 새로고침·창 닫기·이동: 권한 측이 이 좌석을 기권패 처리하게 알린다
    const onPageHide = () => {
      session.dispose();
    };
    window.addEventListener('pagehide', onPageHide);
    session.connect().then(
      () => {
        if (!cancelled) setPhase({ t: 'playing', session, store });
      },
      (error: unknown) => {
        if (cancelled) return;
        setPhase(
          error instanceof LocalSessionRejectedError
            ? { t: 'rejected', reason: error.reason }
            : { t: 'rejected', reason: 'INVALID_HELLO' },
        );
      },
    );
    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', onPageHide);
      store.dispose();
      session.dispose();
    };
  }, []);

  switch (phase.t) {
    case 'unsupported':
      return (
        <p role="alert">
          이 브라우저는 SharedWorker를 지원하지 않아 로컬 2인 모드를 쓸 수 없어요. 데스크톱
          Chrome·Edge·Firefox에서 열어 주세요.
        </p>
      );
    case 'badSeat':
      return <p role="alert">주소에 ?seat=0 또는 ?seat=1을 붙여 열어 주세요.</p>;
    case 'connecting':
      return <p>상대 창을 기다리는 중…</p>;
    case 'rejected':
      return <p role="alert">{REJECT_TEXT[phase.reason]}</p>;
    case 'exited':
      return <p>경기에서 나갔어요. 창을 닫아 주세요.</p>;
    case 'playing':
      return (
        <GameScreen
          session={phase.session}
          store={phase.store}
          onExit={() => {
            phase.session.dispose();
            setPhase({ t: 'exited' });
          }}
        />
      );
  }
}
