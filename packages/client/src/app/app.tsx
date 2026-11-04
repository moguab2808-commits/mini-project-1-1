// 계정·로비·대기실·경기 화면을 잇는 앱 껍데기. 화면 전환은 URL이 아니라 로그인 여부와 방 상태로 정한다.
// 방 연결과 경기 세션은 `RoomClient`(IMPL-010)가 맡고, 이 파일은 그 상태를 화면으로 옮긴다.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Me } from '@alkkagi/shared';
import { startAiGame, type AiGameSession, type AiMatchSettings } from '../ai/ai-game-session.ts';
import { GameScreen } from '../game/GameScreen.tsx';
import { GameStore } from '../game/game-store.ts';
import { createRoomClient, type RoomClient } from '../online/room-client.ts';
import { ApiError, createApi, describeApiError, type Api } from './api.ts';
import { AuthScreen } from './auth-screen.tsx';
import { LobbyScreen } from './lobby-screen.tsx';
import { roomClosedMessage, sessionEndMessage, WAKING_SERVER_MESSAGE } from './messages.ts';
import { hasSeenRules, markRulesSeen } from './settings.ts';
import { ToastProvider, useToast } from './toast.tsx';
import { usePendingNotice } from './use-pending-notice.ts';
import { WaitingRoom } from './waiting-room.tsx';
import '../ui/theme.css';
import './app.css';

type Phase =
  { t: 'boot' } | { t: 'auth'; notice?: string } | { t: 'main'; me: Me; firstVisit: boolean };

export function App() {
  return (
    <ToastProvider>
      <AppRoot />
    </ToastProvider>
  );
}

function AppRoot() {
  const api = useMemo(() => createApi(), []);
  const [phase, setPhase] = useState<Phase>({ t: 'boot' });
  const waking = usePendingNotice(phase.t === 'boot');

  // 열자마자 세션 쿠키로 로그인 상태를 확인한다.
  useEffect(() => {
    let alive = true;
    api.me().then(
      (me) => {
        if (alive) setPhase({ t: 'main', me, firstVisit: !hasSeenRules() });
      },
      (error: unknown) => {
        if (!alive) return;
        const unauthenticated = error instanceof ApiError && error.code === 'UNAUTHENTICATED';
        setPhase({ t: 'auth', notice: unauthenticated ? undefined : describeApiError(error) });
      },
    );
    return () => {
      alive = false;
    };
  }, [api]);

  if (phase.t === 'boot') {
    return (
      <main className="boot-page">
        <h1 className="l-logo">증강 알까기</h1>
        <p role="status">{waking ? WAKING_SERVER_MESSAGE : '불러오는 중…'}</p>
      </main>
    );
  }
  if (phase.t === 'auth') {
    return (
      <AuthScreen
        api={api}
        notice={phase.notice}
        onLoggedIn={(me) => {
          setPhase({ t: 'main', me, firstVisit: !hasSeenRules() });
        }}
      />
    );
  }
  return (
    <MainShell
      api={api}
      initialMe={phase.me}
      firstVisit={phase.firstVisit}
      onSessionEnd={(notice) => {
        setPhase({ t: 'auth', notice });
      }}
    />
  );
}

interface AiMatch {
  session: AiGameSession;
  store: GameStore;
}

/** 로그인한 동안 방 연결(소켓) 하나를 소유한다. */
function MainShell({
  api,
  initialMe,
  firstVisit,
  onSessionEnd,
}: {
  api: Api;
  initialMe: Me;
  firstVisit: boolean;
  onSessionEnd: (notice?: string) => void;
}) {
  const notify = useToast();
  const [client, setClient] = useState<RoomClient | null>(null);
  // 소켓이 연결되기 전에는 방 명령이 모두 실패하므로 연결된 뒤에 로비를 연다.
  const [connected, setConnected] = useState(false);
  const endRef = useRef(onSessionEnd);
  endRef.current = onSessionEnd;
  // 로그아웃 요청 중이면 서버가 연결을 끊어도 끊김 안내를 보이지 않는다.
  const loggingOutRef = useRef(false);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  useEffect(() => {
    const connection = createRoomClient({
      onLoginRequired: (reason) => {
        endRef.current(loggingOutRef.current ? undefined : sessionEndMessage(reason));
      },
      onRoomClosed: (event) => {
        notifyRef.current(roomClosedMessage(event.reason));
      },
      onConnected: () => {
        setConnected(true);
      },
    });
    setClient(connection);
    connection.connect();
    // 창을 닫아도 이탈이 서버에 전해지도록 먼저 정리한다.
    const unload = () => {
      connection.dispose();
    };
    // 뒤로가기로 페이지가 복원되면(bfcache) 연결이 이미 끝나 있으므로 처음부터 다시 불러온다.
    const restore = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('pagehide', unload);
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener('pagehide', unload);
      window.removeEventListener('pageshow', restore);
      connection.dispose();
    };
  }, []);

  if (!client || !connected) return <p className="boot-page">연결 중…</p>;
  return (
    <Connected
      api={api}
      client={client}
      initialMe={initialMe}
      firstVisit={firstVisit}
      loggingOutRef={loggingOutRef}
      onSessionEnd={onSessionEnd}
    />
  );
}

function Connected({
  api,
  client,
  initialMe,
  firstVisit,
  loggingOutRef,
  onSessionEnd,
}: {
  api: Api;
  client: RoomClient;
  initialMe: Me;
  firstVisit: boolean;
  loggingOutRef: { current: boolean };
  onSessionEnd: (notice?: string) => void;
}) {
  const notify = useToast();
  const { room, match } = useSyncExternalStore(client.subscribe, client.getState);
  const [me, setMe] = useState(initialMe);
  const [ai, setAi] = useState<AiMatch | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  // 규칙 카드는 로그인 뒤 처음 로비가 뜰 때 한 번만 보인다. 경기를 마치고 로비가 다시 그려져도 열지 않는다.
  const [rulesPending, setRulesPending] = useState(firstVisit);

  // AI 경기 화면을 떠나거나 창을 닫으면 워커를 끝낸다.
  useEffect(() => {
    if (!ai) return;
    const stop = () => {
      ai.session.dispose();
    };
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      ai.store.dispose();
      ai.session.dispose();
    };
  }, [ai]);

  const authLost = useCallback(() => {
    onSessionEnd('로그인이 만료됐어요. 다시 로그인해 주세요.');
  }, [onSessionEnd]);

  const logout = useCallback(() => {
    if (loggingOutRef.current) return;
    // 요청이 끝날 때까지 로비를 잠그고, 성공한 뒤에 연결을 끊는다. 실패하면 세션이 살아 있으니 그대로 둔다.
    loggingOutRef.current = true;
    setLoggingOut(true);
    api.logout().then(
      () => {
        client.dispose();
        onSessionEnd();
      },
      (error: unknown) => {
        loggingOutRef.current = false;
        setLoggingOut(false);
        notify(describeApiError(error));
      },
    );
  }, [api, client, loggingOutRef, notify, onSessionEnd]);

  const startAi = useCallback(
    (settings: AiMatchSettings) => {
      if (typeof Worker === 'undefined') {
        notify('이 브라우저는 AI 대전을 지원하지 않아요.');
        return;
      }
      // 게임 화면에 내 닉네임·외형을 보인다(브라우저 안에서만 쓰고 서버로 보내지 않는다)
      const session = startAiGame({
        ...settings,
        profile: { nickname: me.nickname, appearance: me.appearance },
      });
      setAi({ session, store: new GameStore(session) });
    },
    [notify, me.nickname, me.appearance],
  );

  if (ai) {
    return (
      <GameScreen
        session={ai.session}
        store={ai.store}
        onExit={() => {
          setAi(null);
        }}
      />
    );
  }
  if (room?.status === 'playing' && match) {
    return (
      <GameScreen
        key={room.roomId}
        {...match}
        onExit={() => {
          void client.leave();
        }}
      />
    );
  }
  if (room) {
    return <WaitingRoom room={room} onLeave={() => client.leave()} />;
  }
  return (
    <LobbyScreen
      api={api}
      client={client}
      me={me}
      onMeChange={setMe}
      onLogout={logout}
      locked={loggingOut}
      onStartAi={startAi}
      onAuthLost={authLost}
      showRulesFirst={rulesPending}
      onRulesShown={() => {
        markRulesSeen();
        setRulesPending(false);
      }}
    />
  );
}
