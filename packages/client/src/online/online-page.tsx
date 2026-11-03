// IMPL-012 이전의 접속 확인용 화면. 로그인은 기존 인증 API의 세션 쿠키를 사용한다.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { GameScreen } from '../game/GameScreen.tsx';
import { createRoomClient, type RoomClient } from './room-client.ts';

function OnlineRoom({ client }: { client: RoomClient }) {
  const { room, match } = useSyncExternalStore(client.subscribe, client.getState);
  const [roomId, setRoomId] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const enter = async (create: boolean) => {
    setBusy(true);
    const result = create
      ? await client.create({
          title: '온라인 대전',
          isPublic: true,
          pieceCount: 5,
          board: 'standard',
        })
      : await client.join({ roomId: Number(roomId) });
    setNotice(result.ok ? '' : result.error.message);
    setBusy(false);
  };
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
  return (
    <main>
      <h1>온라인 대전 연결 확인</h1>
      <p role="status">
        {notice ||
          (room
            ? `방 ${room.roomId}: 상대를 기다리는 중`
            : '로그인된 계정으로 방을 만들거나 참여하세요.')}
      </p>
      {room ? (
        <button
          onClick={() => {
            void client.leave();
          }}
        >
          나가기
        </button>
      ) : (
        <>
          <button
            disabled={busy}
            onClick={() => {
              void enter(true);
            }}
          >
            공개 방 만들기
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enter(false);
            }}
          >
            <label>
              방 번호{' '}
              <input
                required
                type="number"
                min="1"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
            </label>
            <button disabled={busy}>참여</button>
          </form>
        </>
      )}
    </main>
  );
}

export function OnlinePage() {
  const [client, setClient] = useState<RoomClient | null>(null);
  useEffect(() => {
    const connection = createRoomClient({
      onLoginRequired: () => window.location.assign('/login'),
    });
    setClient(connection);
    connection.connect();
    const unload = () => connection.dispose();
    window.addEventListener('pagehide', unload);
    return () => {
      window.removeEventListener('pagehide', unload);
      connection.dispose();
    };
  }, []);
  return client ? <OnlineRoom client={client} /> : <p>연결 중…</p>;
}
