// 개발용 `/ai` 화면: AI 대전 설정(판·알 개수) 후 시작. 로비의 방 생성 창(IMPL-012)은
// `AiSetupForm`과 `startAiGame`을 그대로 쓴다. 서버 요청이 없다(DEC-021).
import { useEffect, useState } from 'react';
import {
  BOARD_IDS,
  DEFAULT_THEME,
  THEME_IDS,
  THEME_LABEL,
  type BoardId,
  type ThemeId,
} from '@alkkagi/shared';
import { GameScreen } from '../game/GameScreen.tsx';
import { GameStore } from '../game/game-store.ts';
import { startAiGame, type AiGameSession, type AiMatchSettings } from './ai-game-session.ts';

export const BOARD_LABEL: Record<BoardId, string> = { standard: '기본판', circle: '원형판' };
export const PIECE_COUNTS = [5, 7, 9] as const;

export interface AiSetupFormProps {
  initial?: AiMatchSettings;
  onStart: (settings: AiMatchSettings) => void;
}

export interface ThemeChoiceProps {
  theme: ThemeId;
  onChange: (theme: ThemeId) => void;
  /** 방 생성 창의 칩 모양(`chip`)을 쓴다. AI 설정 폼은 `.ai-setup` 스타일을 쓰므로 끈다 */
  chips?: boolean;
}

/** 방 테마 선택(DEC-050·052). 사람 방과 AI 대전이 같은 칩을 쓴다 */
export function ThemeChoice({ theme, onChange, chips = true }: ThemeChoiceProps) {
  return (
    <fieldset className={chips ? 'choice' : undefined}>
      <legend>방 테마</legend>
      {THEME_IDS.map((id) => (
        <label
          key={id}
          data-theme={id}
          className={chips ? (theme === id ? 'chip chip-on' : 'chip') : undefined}
        >
          <input
            type="radio"
            name="theme"
            value={id}
            checked={theme === id}
            onChange={() => {
              onChange(id);
            }}
          />
          {THEME_LABEL[id]}
        </label>
      ))}
    </fieldset>
  );
}

/** 판·알 개수(5·7·9, 기본 5)·방 테마를 고르고 "AI와 시작"을 누른다(DEC-024·032·050) */
export function AiSetupForm({ initial, onStart }: AiSetupFormProps) {
  const [board, setBoard] = useState<BoardId>(initial?.board ?? 'standard');
  const [theme, setTheme] = useState<ThemeId>(initial?.theme ?? DEFAULT_THEME);
  const [pieceCount, setPieceCount] = useState<AiMatchSettings['pieceCount']>(
    initial?.pieceCount ?? 5,
  );
  return (
    <form
      aria-label="AI 대전 설정"
      onSubmit={(e) => {
        e.preventDefault();
        onStart({ board, theme, pieceCount });
      }}
    >
      <fieldset>
        <legend>판</legend>
        {BOARD_IDS.map((id) => (
          <label key={id}>
            <input
              type="radio"
              name="board"
              value={id}
              checked={board === id}
              onChange={() => {
                setBoard(id);
              }}
            />
            {BOARD_LABEL[id]}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>알 개수</legend>
        {PIECE_COUNTS.map((n) => (
          <label key={n}>
            <input
              type="radio"
              name="pieceCount"
              value={n}
              checked={pieceCount === n}
              onChange={() => {
                setPieceCount(n);
              }}
            />
            {n}개
          </label>
        ))}
      </fieldset>
      <ThemeChoice theme={theme} onChange={setTheme} />
      <p>방 목록에 올리지 않고 바로 시작해요. 결과는 전적에 반영되지 않아요.</p>
      <button type="submit" className="l-btn l-btn-primary">
        AI와 시작
      </button>
    </form>
  );
}

type Phase =
  | { t: 'setup'; last?: AiMatchSettings }
  | { t: 'playing'; settings: AiMatchSettings; session: AiGameSession; store: GameStore };

export function AiPage() {
  const [phase, setPhase] = useState<Phase>({ t: 'setup' });

  // 경기 화면을 떠나거나 창을 닫으면 워커를 끝낸다
  useEffect(() => {
    if (phase.t !== 'playing') return;
    const { session, store } = phase;
    const onPageHide = () => {
      session.dispose();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      store.dispose();
      session.dispose();
    };
  }, [phase]);

  if (typeof Worker === 'undefined') {
    return <p role="alert">이 브라우저는 Web Worker를 지원하지 않아 AI 대전을 할 수 없어요.</p>;
  }
  if (phase.t === 'setup') {
    return (
      <AiSetupForm
        initial={phase.last}
        onStart={(settings) => {
          const session = startAiGame(settings);
          setPhase({ t: 'playing', settings, session, store: new GameStore(session) });
        }}
      />
    );
  }
  return (
    <GameScreen
      session={phase.session}
      store={phase.store}
      onExit={() => {
        setPhase({ t: 'setup', last: phase.settings });
      }}
    />
  );
}
