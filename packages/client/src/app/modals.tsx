// 로비 위에 뜨는 플로팅 창 내용: 방 생성, 코드 입력, 캐릭터 변경, 환경설정, 규칙 설명(PRD 로비·방 생성·캐릭터 변경·환경설정).
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  BOARD_IDS,
  APPEARANCE_CHOICES,
  APPEARANCE_KEYS,
  DEFAULT_THEME,
  PASSWORD_MAX,
  resolveAvatar,
  ROOM_CODE_LENGTH,
  ROOM_TITLE_MAX,
  type BoardId,
  type Appearance,
  type AppearanceKey,
  type RoomCreate,
  type ThemeId,
} from '@alkkagi/shared';
import { OutfitSwatch } from '../avatar/AvatarAccessories.tsx';
import { AvatarFace } from '../avatar/AvatarFace.tsx';
import { AvatarFigureView } from '../avatar/AvatarFigureView.tsx';
import type { AiMatchSettings } from '../ai/ai-game-session.ts';
import { AiSetupForm, BOARD_LABEL, PIECE_COUNTS, ThemeChoice } from '../ai/ai-page.tsx';
import { ApiError, describeApiError, type Api } from './api.ts';
import { FloatingWindow } from './floating-window.tsx';
import { RegionArt } from './region-art.tsx';
import {
  applyCodeCellInput,
  defaultRoomTitle,
  generateRoomCode,
  isCompleteCode,
  normalizeCodeInput,
  validatePasswordChange,
} from './logic.ts';
import { clampVolume, loadVolume, saveVolume } from './settings.ts';
import { useToast } from './toast.tsx';

/** 꾸미기 항목 이름(PRD 캐릭터 변경, DEC-054) */
export const APPEARANCE_LABEL: Record<AppearanceKey, string> = {
  headShape: '두상',
  hair: '머리카락',
  eyebrows: '눈썹',
  eyes: '눈',
  nose: '코',
  lips: '입술',
  skinTone: '피부색',
  glasses: '안경',
  hat: '모자',
  outfit: '옷',
};

/** 클립보드 복사. 막힌 환경이면 false를 돌려준다. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyCodeButton({ code }: { code: string }) {
  const notify = useToast();
  return (
    <button
      type="button"
      className="btn btn-small"
      onClick={() => {
        void copyText(code).then((ok) => {
          notify(ok ? '코드를 복사했어요.' : '복사하지 못했어요. 코드를 직접 적어 주세요.');
        });
      }}
    >
      코드 복사
    </button>
  );
}

/** 방 테마 칩 안의 그림: 로비 방 목록의 지역 그림과 같다 */
const themeArt = (id: ThemeId) => <RegionArt theme={id} />;

function BoardPreview({ board }: { board: BoardId }) {
  return (
    <svg className="board-preview" viewBox="0 0 48 48" aria-hidden="true">
      {board === 'circle' ? (
        <circle cx="24" cy="24" r="20" />
      ) : (
        <rect x="6" y="9" width="36" height="30" rx="3" />
      )}
    </svg>
  );
}

/* ───────── 코드 입력 ───────── */

export interface CodeModalProps {
  /** 목록에서 비공개 방을 골라 입장할 때 보여 줄 방 제목 */
  roomTitle?: string;
  /** 입장을 시도한다. 오류 문구를 돌려주면 창을 유지하고 문구를 보인다. */
  onSubmit: (code: string) => Promise<string | null>;
  onClose: () => void;
}

export function CodeModal({ roomTitle, onSubmit, onClose }: CodeModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cells = useRef<(HTMLInputElement | null)[]>([]);

  const focusCell = (index: number) => {
    cells.current[Math.min(Math.max(index, 0), ROOM_CODE_LENGTH - 1)]?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !isCompleteCode(code)) return;
    setBusy(true);
    setError(null);
    const message = await onSubmit(code);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <FloatingWindow title={roomTitle ? `${roomTitle} · 코드 입력` : '코드 입력'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          void submit(e);
        }}
      >
        <p className="hint">
          {roomTitle ? '비공개 방이에요. ' : ''}방장에게 받은 6자리 코드를 입력해 주세요.
        </p>
        <div
          className="code-cells"
          onPaste={(e) => {
            e.preventDefault();
            const pasted = normalizeCodeInput(e.clipboardData.getData('text'));
            setCode(pasted);
            focusCell(pasted.length);
          }}
        >
          {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (
            <input
              key={i}
              ref={(el) => {
                cells.current[i] = el;
              }}
              className="code-cell"
              aria-label={`코드 ${String(i + 1)}번째 칸`}
              value={code[i] ?? ''}
              autoFocus={i === 0}
              autoComplete="off"
              onChange={(e) => {
                const result = applyCodeCellInput(code, i, e.target.value);
                setCode(result.code);
                setError(null);
                focusCell(result.focus);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !code[i]) focusCell(i - 1);
              }}
            />
          ))}
        </div>
        {error && (
          <p className="msg msg-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy || !isCompleteCode(code)}>
          {busy ? '입장 중…' : '입장'}
        </button>
      </form>
    </FloatingWindow>
  );
}

/* ───────── 방 생성 ───────── */

/** 방 만들기 결과. 오류면 안내 문구를 담고, 코드가 겹쳤으면 `codeTaken`이다. */
export type CreateResult = null | { message: string; codeTaken: boolean };

export interface CreateRoomModalProps {
  nickname: string;
  /** 왼쪽 전신에 보일 내 외형 */
  appearance: Appearance;
  /** 사람(PvP) 방을 만든다. 오류 결과를 돌려주면 창을 유지한다. */
  onCreate: (input: RoomCreate) => Promise<CreateResult>;
  /** AI 대전은 서버 요청 없이 이 브라우저에서 바로 시작한다(DEC-021). */
  onStartAi: (settings: AiMatchSettings) => void;
  onClose: () => void;
}

export function CreateRoomModal({
  nickname,
  appearance,
  onCreate,
  onStartAi,
  onClose,
}: CreateRoomModalProps) {
  const [opponent, setOpponent] = useState<'pvp' | 'ai'>('pvp');
  const [title, setTitle] = useState(() => defaultRoomTitle(nickname));
  const [pieceCount, setPieceCount] = useState<AiMatchSettings['pieceCount']>(5);
  const [board, setBoard] = useState<BoardId>('standard');
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState(() => generateRoomCode());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = title.trim();
    if (trimmed === '' || trimmed.length > ROOM_TITLE_MAX) {
      setError(`방 제목은 1~${String(ROOM_TITLE_MAX)}자로 적어 주세요.`);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onCreate({
      title: trimmed,
      isPublic,
      pieceCount,
      board,
      theme,
      ...(isPublic ? {} : { code }),
    });
    setBusy(false);
    if (!result) return;
    if (result.codeTaken) {
      // 보여 준 코드와 만든 방의 코드가 달라지지 않도록, 새 코드로 바꿔 보여 주고 다시 누르게 한다.
      setCode(generateRoomCode());
      setError('방 코드가 겹쳐 새 코드로 바꿨어요. 코드를 확인하고 다시 눌러 주세요.');
      return;
    }
    setError(result.message);
  };

  // 방 생성 창(DEC-070): 로비를 덮는 L 화풍 화면. 왼쪽은 배경 없이 뒤가 비치는 창에 내 캐릭터 전신, 오른쪽은 설정과 만들기 버튼.
  return (
    <div className="create-layer" role="dialog" aria-label="방 생성">
      <header className="create-top">
        <h2 className="l-logo create-logo">증강 알까기</h2>
        <span className="l-ribbon create-ribbon">✦ 방 생성 · 새 대결장을 열어요</span>
        <span className="lobby-spacer" />
        <button type="button" className="l-btn l-btn-cream create-back" onClick={onClose}>
          ◀ 방 목록으로
        </button>
      </header>

      <section className="create-figure l-tray" aria-label="내 캐릭터">
        <AvatarFigureView appearance={appearance} />
      </section>

      <div className="create-form l-tray">
        <fieldset className="choice create-opponent">
          <legend>대전 상대</legend>
          {(['pvp', 'ai'] as const).map((value) => (
            <label key={value} className={opponent === value ? 'chip chip-on' : 'chip'}>
              <input
                type="radio"
                name="opponent"
                checked={opponent === value}
                onChange={() => {
                  setOpponent(value);
                  setError(null);
                }}
              />
              {value === 'pvp' ? '사람과 대결' : 'AI와 연습'}
              {value === 'ai' && <small>전적 미반영</small>}
            </label>
          ))}
        </fieldset>

        {opponent === 'ai' ? (
          // DEC-042 ②: AI 대전은 `/ai`의 설정 폼과 시작 함수를 그대로 쓴다.
          <div className="ai-setup">
            <AiSetupForm
              initial={{ board, theme, pieceCount }}
              onStart={onStartAi}
              themeArt={themeArt}
            />
          </div>
        ) : (
          <form
            className="create-fields"
            onSubmit={(e) => {
              void submit(e);
            }}
          >
            <label className="field create-title">
              <span>방 제목</span>
              <input
                className="l-input"
                value={title}
                maxLength={ROOM_TITLE_MAX}
                onChange={(e) => {
                  setTitle(e.target.value);
                }}
              />
            </label>

            <div className="create-pair">
              <fieldset className="choice">
                <legend>알 개수</legend>
                {PIECE_COUNTS.map((n) => (
                  <label key={n} className={pieceCount === n ? 'chip chip-on' : 'chip'}>
                    <input
                      type="radio"
                      name="pieceCount"
                      checked={pieceCount === n}
                      onChange={() => {
                        setPieceCount(n);
                      }}
                    />
                    {n}개
                  </label>
                ))}
              </fieldset>

              <fieldset className="choice">
                <legend>판</legend>
                {BOARD_IDS.map((id) => (
                  <label
                    key={id}
                    className={board === id ? 'chip chip-on chip-board' : 'chip chip-board'}
                  >
                    <input
                      type="radio"
                      name="board"
                      checked={board === id}
                      onChange={() => {
                        setBoard(id);
                      }}
                    />
                    <BoardPreview board={id} />
                    {BOARD_LABEL[id]}
                  </label>
                ))}
              </fieldset>
            </div>

            <ThemeChoice theme={theme} onChange={setTheme} art={themeArt} />

            <div className="create-pair create-pair-code">
              <fieldset className="choice">
                <legend>공개 여부</legend>
                {([true, false] as const).map((value) => (
                  <label
                    key={String(value)}
                    className={isPublic === value ? 'chip chip-on' : 'chip'}
                  >
                    <input
                      type="radio"
                      name="isPublic"
                      checked={isPublic === value}
                      onChange={() => {
                        setIsPublic(value);
                      }}
                    />
                    {value ? '공개' : '비공개'}
                  </label>
                ))}
              </fieldset>

              <div className="code-box">
                {isPublic ? (
                  <span className="hint">방 코드 없음</span>
                ) : (
                  <>
                    <span className="hint">방 코드 (자동 생성)</span>
                    <strong className="code-text">{code}</strong>
                    <CopyCodeButton code={code} />
                  </>
                )}
              </div>
            </div>

            {error && (
              <p className="msg msg-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="l-btn l-btn-primary create-submit" disabled={busy}>
              {busy ? '만드는 중…' : '방 만들기 ✦'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ───────── 캐릭터 꾸미기 ───────── */

/**
 * 꾸미기 창(DEC-059): 왼쪽 3D 미리보기 + 오른쪽 항목 탭. 창 안에서 마음대로 바꿔 본 뒤
 * 저장을 눌러야 한 번 저장되고, 닫으면 바꾼 것이 버려진다.
 */
export function AvatarModal({
  current,
  onSave,
  onClose,
}: {
  current: Appearance;
  /** 저장 요청. 실패하면 오류 문구를 돌려준다 */
  onSave: (appearance: Appearance) => Promise<string | null>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Appearance>(current);
  const [tab, setTab] = useState<AppearanceKey>('headShape');
  const [busy, setBusy] = useState(false);
  const notify = useToast();
  const changed = APPEARANCE_KEYS.some((k) => draft[k] !== current[k]);
  const choices = Array.from({ length: APPEARANCE_CHOICES }, (_, i) => i);
  return (
    <FloatingWindow title="캐릭터 꾸미기" onClose={onClose} wide>
      <div className="avatar-editor">
        <div className="avatar-preview">
          <AvatarFigureView appearance={draft} draggable />
        </div>
        <div className="avatar-options">
          <div className="avatar-tabs" role="tablist" aria-label="꾸미기 항목">
            {APPEARANCE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={k === tab}
                className={k === tab ? 'avatar-tab avatar-tab-on' : 'avatar-tab'}
                onClick={() => {
                  setTab(k);
                }}
              >
                {APPEARANCE_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="avatar-choices" role="tabpanel" aria-label={APPEARANCE_LABEL[tab]}>
            {choices.map((i) => {
              const on = draft[tab] === i;
              return (
                <button
                  key={i}
                  type="button"
                  className={on ? 'avatar-choice avatar-choice-on' : 'avatar-choice'}
                  aria-pressed={on}
                  aria-label={`${APPEARANCE_LABEL[tab]} ${String(i + 1)}`}
                  disabled={busy}
                  onClick={() => {
                    setDraft((d) => ({ ...d, [tab]: i }));
                  }}
                >
                  {tab === 'outfit' ? (
                    <OutfitSwatch outfit={resolveAvatar({ ...draft, outfit: i }).outfit} />
                  ) : (
                    <AvatarFace appearance={{ ...draft, [tab]: i }} size={64} />
                  )}
                </button>
              );
            })}
          </div>
          <div className="avatar-actions">
            <button type="button" className="btn" disabled={busy} onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !changed}
              onClick={() => {
                setBusy(true);
                void onSave(draft).then((message) => {
                  setBusy(false);
                  if (message) notify(message);
                });
              }}
            >
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
          <p className="hint">저장을 눌러야 계정에 반영돼요. 닫으면 바꾼 것이 취소돼요.</p>
        </div>
      </div>
    </FloatingWindow>
  );
}

/* ───────── 환경설정 ───────── */

export function SettingsModal({
  api,
  onShowRules,
  onAuthLost,
  onClose,
}: {
  api: Api;
  onShowRules: () => void;
  onAuthLost: () => void;
  onClose: () => void;
}) {
  const notify = useToast();
  const [volume, setVolume] = useState(() => loadVolume());
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const invalid = validatePasswordChange({
      currentPassword: current,
      newPassword: next,
      newPasswordConfirm: confirm,
    });
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      notify('비밀번호를 바꿨어요.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'UNAUTHENTICATED') {
        onAuthLost();
        return;
      }
      setError(
        err instanceof ApiError && err.code === 'INVALID_CREDENTIALS'
          ? '현재 비밀번호가 맞지 않아요.'
          : describeApiError(err),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <FloatingWindow title="환경설정" onClose={onClose}>
      <div className="form">
        <label className="field">
          <span>효과음 음량 {volume}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => {
              const value = clampVolume(Number(e.target.value));
              setVolume(value);
              saveVolume(value);
            }}
          />
        </label>
        <p className="hint">이 브라우저에만 저장돼요.</p>

        <div className="field">
          <span>닉네임·전적</span>
          <p className="hint">닉네임과 전적은 바꿀 수 없어요.</p>
        </div>

        <form
          className="form"
          onSubmit={(e) => {
            void changePassword(e);
          }}
        >
          <div className="field">
            <span>비밀번호</span>
            <output className="masked">********</output>
          </div>
          <label className="field">
            <span>현재 비밀번호</span>
            <input
              type="password"
              value={current}
              maxLength={PASSWORD_MAX}
              autoComplete="current-password"
              onChange={(e) => {
                setCurrent(e.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>새 비밀번호</span>
            <input
              type="password"
              value={next}
              maxLength={PASSWORD_MAX}
              autoComplete="new-password"
              onChange={(e) => {
                setNext(e.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>새 비밀번호 확인</span>
            <input
              type="password"
              value={confirm}
              maxLength={PASSWORD_MAX}
              autoComplete="new-password"
              onChange={(e) => {
                setConfirm(e.target.value);
              }}
            />
          </label>
          {error && (
            <p className="msg msg-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? '바꾸는 중…' : '비밀번호 변경'}
          </button>
        </form>

        <button type="button" className="btn" onClick={onShowRules}>
          규칙 다시 보기
        </button>
      </div>
    </FloatingWindow>
  );
}

/* ───────── 규칙 설명 카드 ───────── */

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <FloatingWindow title="증강 알까기 규칙" onClose={onClose} wide>
      <div className="rules">
        <h3>조작</h3>
        <ul>
          <li>내 턴에 내 알을 누른 채 뒤로 당겨 반대 방향으로 조준해요.</li>
          <li>버튼을 누르고 있으면 세기 막대가 0~100을 오르내리고, 놓는 순간의 세기로 발사해요.</li>
          <li>세기 0에서 놓거나 오른쪽 클릭·ESC를 누르면 발사하지 않아요.</li>
          <li>조준하지 않을 때 A·D(또는 ←·→)로 판을 돌릴 수 있어요.</li>
        </ul>
        <h3>승패</h3>
        <ul>
          <li>판 밖으로 나간 알은 사라져요. 상대 알을 모두 떨어뜨리면 이겨요.</li>
          <li>한 턴은 30초예요. 3번 연속 시간을 넘기면 기권으로 져요.</li>
          <li>10라운드까지 승부가 나지 않으면 남은 알이 많은 쪽이 이겨요.</li>
          <li>남은 알이 같거나 한 번의 발사로 양쪽 알이 함께 모두 떨어지면 무승부예요.</li>
        </ul>
        <h3>방해요소</h3>
        <ul>
          <li>
            1·3·5·7·9라운드가 시작될 때 무작위로 하나를 받아요. 상대는 내 방해요소를 볼 수 없어요.
          </li>
          <li>프로필 위 칸을 누르거나 E 키로 쓰고, 종류마다 쿨타임·게이지 제한이 있어요.</li>
        </ul>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          알겠어요
        </button>
      </div>
    </FloatingWindow>
  );
}
