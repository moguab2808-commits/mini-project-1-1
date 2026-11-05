// 로비: 위쪽 줄(로고·새로고침·코드 입력·방 생성·즉시 참가·오른쪽 위 프로필 명판)과 방 테마별 지역 4열 방 목록(DEC-070).
// PRD 화면별 요구사항 "로비".
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  THEME_LABEL,
  type Appearance,
  type Me,
  type RoomAck,
  type RoomCreate,
  type RoomJoin,
  type RoomSummary,
} from '@alkkagi/shared';
import type { AiMatchSettings } from '../ai/ai-game-session.ts';
import { AvatarFace } from '../avatar/AvatarFace.tsx';
import type { RoomClient } from '../online/room-client.ts';
import { ApiError, describeApiError, type Api } from './api.ts';
import { canEnter, formatRecord, formatWinRate, groupRoomsByTheme } from './logic.ts';
import { roomErrorMessage } from './messages.ts';
import {
  AvatarModal,
  CodeModal,
  CreateRoomModal,
  type CreateResult,
  RulesModal,
  SettingsModal,
} from './modals.tsx';
import { REGION_COLOR, RegionArt } from './region-art.tsx';
import { useToast } from './toast.tsx';

type Modal =
  | null
  | { t: 'create' }
  | { t: 'code'; room?: RoomSummary }
  | { t: 'character' }
  | { t: 'settings' }
  | { t: 'rules' };

export interface LobbyScreenProps {
  api: Api;
  client: RoomClient;
  me: Me;
  onMeChange: (me: Me) => void;
  onLogout: () => void;
  /** 로그아웃 요청이 진행 중이다. 그동안 방 입장·생성을 막는다. */
  locked: boolean;
  onStartAi: (settings: AiMatchSettings) => void;
  /** 세션이 사라졌다(401). 로그인 화면으로 돌아간다. */
  onAuthLost: () => void;
  /** 처음 로그인한 사용자에게 규칙 카드를 보여 준다 */
  showRulesFirst: boolean;
  onRulesShown: () => void;
}

function isUnauthenticated(result: PromiseSettledResult<unknown>): boolean {
  return (
    result.status === 'rejected' &&
    result.reason instanceof ApiError &&
    result.reason.code === 'UNAUTHENTICATED'
  );
}

export function LobbyScreen({
  api,
  client,
  me,
  onMeChange,
  onLogout,
  locked,
  onStartAi,
  onAuthLost,
  showRulesFirst,
  onRulesShown,
}: LobbyScreenProps) {
  const notify = useToast();
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(showRulesFirst ? { t: 'rules' } : null);
  const [busy, setBusy] = useState(false);
  /** 첫 갱신이 실패해 목록이 아직 없는 상태 */
  const [listFailed, setListFailed] = useState(false);
  const blocked = busy || locked;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (showRulesFirst) onRulesShown();
    return () => {
      mounted.current = false;
    };
    // 규칙 카드는 로비가 처음 뜰 때 한 번만 알린다.
  }, []);

  const handleApiError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
        onAuthLost();
        return;
      }
      notify(describeApiError(error));
    },
    [notify, onAuthLost],
  );

  /** 목록과 내 전적을 갱신한다. 둘은 따로 처리해 한쪽이 실패해도 다른 쪽은 반영한다. */
  const refresh = useCallback(async () => {
    setLoading(true);
    const [list, mine] = await Promise.allSettled([api.listRooms(), api.me()]);
    if (!mounted.current) return;
    // 한쪽이라도 세션 만료(401)면 다른 쪽 결과와 상관없이 로그인 화면으로 간다.
    if ([list, mine].some(isUnauthenticated)) {
      onAuthLost();
      return;
    }
    if (list.status === 'fulfilled') {
      setRooms(list.value);
      setListFailed(false);
      setSelectedId((id) => (list.value.some((r) => r.roomId === id) ? id : null));
    } else {
      setListFailed(true);
      handleApiError(list.reason);
    }
    if (mine.status === 'fulfilled') onMeChange(mine.value);
    // 안내가 겹치지 않게 목록이 성공했을 때만 전적 실패를 알린다.
    else if (list.status === 'fulfilled') handleApiError(mine.reason);
    setLoading(false);
  }, [api, handleApiError, onAuthLost, onMeChange]);

  useEffect(() => {
    void refresh();
    // 로비가 뜰 때 한 번 갱신한다. refresh는 매 렌더 바뀔 수 있어 의존성에 넣지 않는다.
  }, []);

  /** 입장 명령을 보내고 실패하면 안내한다. 성공하면 방 상태가 와서 화면이 바뀐다. */
  const enter = async (input: RoomJoin, quick = false): Promise<RoomAck<{ roomId: number }>> => {
    setBusy(true);
    try {
      const result = quick ? await client.quickJoin() : await client.join(input);
      if (!result.ok && mounted.current) {
        if (result.error.code === 'ROOM_PLAYING' || result.error.code === 'ROOM_NOT_FOUND') {
          void refresh();
        }
      }
      return result;
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const enterFromList = async (room: RoomSummary) => {
    if (blocked) return;
    if (!canEnter(room)) {
      notify(roomErrorMessage('ROOM_PLAYING'));
      return;
    }
    if (!room.isPublic) {
      setModal({ t: 'code', room });
      return;
    }
    const result = await enter({ roomId: room.roomId });
    if (!result.ok) notify(roomErrorMessage(result.error.code));
  };

  const quickJoin = async () => {
    if (blocked) return;
    const result = await enter({}, true);
    if (!result.ok) notify(roomErrorMessage(result.error.code, true));
  };

  const submitCode = async (
    room: RoomSummary | undefined,
    code: string,
  ): Promise<string | null> => {
    const result = await enter(room ? { roomId: room.roomId, code } : { code });
    if (result.ok) return null;
    // 코드가 틀리면 창을 유지하고, 그 밖의 오류는 안내 뒤 창을 닫는다.
    if (result.error.code === 'INVALID_CODE') return roomErrorMessage('INVALID_CODE');
    if (mounted.current) setModal(null);
    notify(roomErrorMessage(result.error.code));
    return null;
  };

  const createRoom = async (input: RoomCreate): Promise<CreateResult> => {
    if (locked) return null;
    setBusy(true);
    try {
      const result = await client.create(input);
      if (result.ok) return null;
      return {
        message: roomErrorMessage(result.error.code),
        codeTaken: result.error.code === 'CODE_TAKEN',
      };
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const saveAppearance = async (appearance: Appearance): Promise<string | null> => {
    try {
      onMeChange(await api.changeAppearance(appearance));
      setModal(null);
      return null;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
        onAuthLost();
        return null;
      }
      return describeApiError(error);
    }
  };

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  const regions = rooms ? groupRoomsByTheme(rooms) : [];

  return (
    <div className="lobby">
      <header className="lobby-top">
        <h1 className="l-logo lobby-logo">증강 알까기</h1>
        <button
          type="button"
          className="l-btn l-btn-cream lobby-icon-btn"
          aria-label={loading ? '불러오는 중…' : '새로고침'}
          title={loading ? '불러오는 중…' : '새로고침'}
          disabled={loading || locked}
          onClick={() => {
            void refresh();
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M20 12a8 8 0 1 1-2.3-5.6" />
            <path d="M20 4v5h-5" />
          </svg>
        </button>
        <span className="lobby-spacer" />
        <div className="lobby-actions">
          <button
            type="button"
            className="l-btn l-btn-cream lobby-act lobby-act-code"
            disabled={blocked}
            onClick={() => {
              setModal({ t: 'code' });
            }}
          >
            코드 입력
          </button>
          <button
            type="button"
            className="l-btn l-btn-magic lobby-act lobby-act-create"
            disabled={blocked}
            onClick={() => {
              setModal({ t: 'create' });
            }}
          >
            방 생성 ✦
          </button>
          <button
            type="button"
            className="l-btn l-btn-primary lobby-act lobby-act-quick"
            disabled={blocked}
            onClick={() => {
              void quickJoin();
            }}
          >
            즉시 참가 ▶
          </button>
        </div>
        <section className="lobby-plate l-tray" aria-label="내 프로필">
          <button
            type="button"
            className="lobby-avatar"
            aria-label="캐릭터 꾸미기"
            disabled={locked}
            onClick={() => {
              setModal({ t: 'character' });
            }}
          >
            <AvatarFace appearance={me.appearance} size={72} />
          </button>
          <div className="lobby-plate-info">
            <strong className="lobby-plate-name">{me.nickname}</strong>
            <span className="lobby-plate-record">{formatRecord(me.record)}</span>
          </div>
          <button
            type="button"
            className="lobby-customize"
            title="캐릭터 꾸미기"
            disabled={locked}
            onClick={() => {
              setModal({ t: 'character' });
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M14.5 3.5l6 6-9.8 9.8H4.7v-6z M12.8 5.2l6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            <span>꾸미기</span>
          </button>
          <button
            type="button"
            className="l-btn l-btn-cream lobby-plate-btn"
            aria-label="환경설정"
            title="환경설정"
            disabled={locked}
            onClick={() => {
              setModal({ t: 'settings' });
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3.5" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
            </svg>
          </button>
          <button
            type="button"
            className="l-btn l-btn-cream lobby-plate-btn"
            aria-label={locked ? '로그아웃 중…' : '로그아웃'}
            title={locked ? '로그아웃 중…' : '로그아웃'}
            disabled={locked}
            onClick={onLogout}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />
            </svg>
          </button>
        </section>
      </header>

      {rooms === null ? (
        <main className="lobby-state">
          <p className="l-tray lobby-state-msg">
            {listFailed
              ? '방 목록을 불러오지 못했어요. 새로고침을 눌러 주세요.'
              : '방 목록을 불러오는 중이에요'}
          </p>
        </main>
      ) : (
        <main className="lobby-regions">
          {regions.map((region) => (
            <section
              key={region.theme}
              className="lobby-region l-tray"
              aria-label={`${THEME_LABEL[region.theme]} 대결장`}
              style={{ '--region-color': REGION_COLOR[region.theme] } as CSSProperties}
            >
              <div className="region-head">
                <RegionArt theme={region.theme} />
                <h2 className="region-name">{THEME_LABEL[region.theme]}</h2>
                <span className="region-count">
                  대기 <b>{region.waiting}</b> / 전체 {region.total}
                </span>
              </div>
              <ul className="region-rooms">
                {region.rooms.map((room) => {
                  const selected = room.roomId === selectedId;
                  const playing = !canEnter(room);
                  const status = playing ? '게임 중' : room.isPublic ? '대기 중' : '비공개';
                  return (
                    <li key={room.roomId}>
                      <div
                        className={selected ? 'room-row room-row-on' : 'room-row'}
                        data-playing={playing ? 'true' : undefined}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected}
                        onClick={() => {
                          setSelectedId(selected ? null : room.roomId);
                        }}
                        onDoubleClick={() => {
                          void enterFromList(room);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedId(selected ? null : room.roomId);
                          }
                        }}
                      >
                        <AvatarFace appearance={room.host.appearance} size={40} />
                        <div className="room-row-body">
                          <div className="room-row-title">
                            {!room.isPublic && (
                              <svg
                                className="room-lock"
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                role="img"
                                aria-label="비공개 방"
                              >
                                <rect x="5" y="11" width="14" height="10" rx="3" fill="#c98a14" />
                                <path
                                  d="M8 11V8a4 4 0 0 1 8 0v3"
                                  fill="none"
                                  stroke="#c98a14"
                                  strokeWidth="2.6"
                                />
                              </svg>
                            )}
                            <strong className="room-title">{room.title}</strong>
                          </div>
                          <span className="room-row-host">
                            {room.host.nickname} · 승률 {formatWinRate(room.host.record)}
                          </span>
                          <span className="room-row-record">{formatRecord(room.host.record)}</span>
                        </div>
                        {selected ? (
                          <button
                            type="button"
                            className="l-btn l-btn-primary room-enter"
                            disabled={blocked || playing}
                            onClick={(e) => {
                              e.stopPropagation();
                              void enterFromList(room);
                            }}
                          >
                            {playing ? '게임 중' : '입장'}
                          </button>
                        ) : (
                          <span
                            className={`room-chip room-chip-${
                              playing ? 'playing' : room.isPublic ? 'wait' : 'private'
                            }`}
                          >
                            {status}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
                {region.rooms.length === 0 && <li className="region-empty">아직 방이 없어요</li>}
              </ul>
            </section>
          ))}
        </main>
      )}

      {modal?.t === 'create' && (
        <CreateRoomModal
          nickname={me.nickname}
          appearance={me.appearance}
          onCreate={createRoom}
          onStartAi={onStartAi}
          onClose={closeModal}
        />
      )}
      {modal?.t === 'code' && (
        <CodeModal
          roomTitle={modal.room?.title}
          onSubmit={(code) => submitCode(modal.room, code)}
          onClose={closeModal}
        />
      )}
      {modal?.t === 'character' && (
        <AvatarModal current={me.appearance} onSave={saveAppearance} onClose={closeModal} />
      )}
      {modal?.t === 'settings' && (
        <SettingsModal
          api={api}
          onShowRules={() => {
            setModal({ t: 'rules' });
          }}
          onAuthLost={onAuthLost}
          onClose={closeModal}
        />
      )}
      {modal?.t === 'rules' && <RulesModal onClose={closeModal} />}
    </div>
  );
}
