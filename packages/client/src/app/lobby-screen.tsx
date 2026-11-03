// 로비: 왼쪽 프로필바와 방 화면(방 목록·방 생성·즉시 참가·코드 입력·새로고침). PRD 화면별 요구사항 "로비".
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { canEnter, formatRecord, formatWinRate } from './logic.ts';
import { roomErrorMessage } from './messages.ts';
import {
  AvatarModal,
  CodeModal,
  CreateRoomModal,
  type CreateResult,
  RulesModal,
  SettingsModal,
} from './modals.tsx';
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

  return (
    <div className="lobby">
      <aside className="profile-bar">
        <button
          type="button"
          className="profile-card"
          aria-label="캐릭터 꾸미기"
          disabled={locked}
          onClick={() => {
            setModal({ t: 'character' });
          }}
        >
          <AvatarFace appearance={me.appearance} size={72} />
          <strong className="profile-name">{me.nickname}</strong>
        </button>
        <dl className="profile-stats">
          <div>
            <dt>승률</dt>
            <dd>{formatWinRate(me.record)}</dd>
          </div>
          <div>
            <dt>전적</dt>
            <dd>{formatRecord(me.record)}</dd>
          </div>
        </dl>
        <div className="profile-actions">
          <button
            type="button"
            className="btn"
            disabled={locked}
            onClick={() => {
              setModal({ t: 'settings' });
            }}
          >
            환경설정
          </button>
          <button type="button" className="btn" disabled={locked} onClick={onLogout}>
            {locked ? '로그아웃 중…' : '로그아웃'}
          </button>
        </div>
      </aside>

      <main className="room-area">
        <div className="room-toolbar">
          <button
            type="button"
            className="btn btn-primary"
            disabled={blocked}
            onClick={() => {
              setModal({ t: 'create' });
            }}
          >
            방 생성
          </button>
          <button
            type="button"
            className="btn"
            disabled={blocked}
            onClick={() => {
              void quickJoin();
            }}
          >
            즉시 참가
          </button>
          <button
            type="button"
            className="btn"
            disabled={blocked}
            onClick={() => {
              setModal({ t: 'code' });
            }}
          >
            코드 입력
          </button>
          <button
            type="button"
            className="btn"
            disabled={loading || locked}
            onClick={() => {
              void refresh();
            }}
          >
            {loading ? '불러오는 중…' : '새로고침'}
          </button>
        </div>

        {rooms === null ? (
          <p className="empty">
            {listFailed
              ? '방 목록을 불러오지 못했어요. 새로고침을 눌러 주세요.'
              : '방 목록을 불러오는 중이에요'}
          </p>
        ) : rooms.length === 0 ? (
          <p className="empty">대기 중인 방이 없어요</p>
        ) : (
          <ul className="room-grid">
            {rooms.map((room) => {
              const selected = room.roomId === selectedId;
              const playing = !canEnter(room);
              return (
                <li key={room.roomId}>
                  <div
                    className={selected ? 'room-card room-card-on' : 'room-card'}
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
                    <div className="room-card-head">
                      <strong className="room-title">
                        {!room.isPublic && (
                          <span role="img" aria-label="비공개 방">
                            🔒{' '}
                          </span>
                        )}
                        {room.title}
                      </strong>
                      {playing && <span className="badge">게임 중</span>}
                    </div>
                    <span className="room-theme" aria-label="방 테마">
                      {THEME_LABEL[room.theme]}
                    </span>
                    <div className="room-host">
                      <AvatarFace appearance={room.host.appearance} size={44} />
                      <div>
                        <div className="room-host-name">{room.host.nickname}</div>
                        <div className="room-host-record">
                          {formatRecord(room.host.record)} · 승률 {formatWinRate(room.host.record)}
                        </div>
                      </div>
                    </div>
                    {selected && (
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        disabled={blocked || playing}
                        onClick={(e) => {
                          e.stopPropagation();
                          void enterFromList(room);
                        }}
                      >
                        {playing ? '게임 중' : '입장'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {modal?.t === 'create' && (
        <CreateRoomModal
          nickname={me.nickname}
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
