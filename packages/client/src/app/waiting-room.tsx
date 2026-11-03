// 대기실: 방 정보와 "플레이어 입장을 기다리는 중". 시작 버튼은 없고 상대가 입장하면 곧바로 경기가 시작된다(DEC-040).
import { useState } from 'react';
import type { RoomState } from '@alkkagi/shared';
import { BOARD_LABEL } from '../ai/ai-page.tsx';
import { CharacterFace } from '../game/hud/CharacterFace.tsx';
import { formatRecord, formatWinRate } from './logic.ts';
import { CopyCodeButton } from './modals.tsx';

export function WaitingRoom({
  room,
  onLeave,
}: {
  room: RoomState;
  onLeave: () => Promise<unknown>;
}) {
  const [leaving, setLeaving] = useState(false);
  return (
    <main className="waiting-page">
      <section className="waiting-card">
        <h1 className="waiting-title">
          {!room.isPublic && (
            <span role="img" aria-label="비공개 방">
              🔒{' '}
            </span>
          )}
          {room.title}
        </h1>
        <dl className="waiting-info">
          <div>
            <dt>판</dt>
            <dd>{BOARD_LABEL[room.board]}</dd>
          </div>
          <div>
            <dt>알 개수</dt>
            <dd>{room.pieceCount}개</dd>
          </div>
        </dl>
        <div className="waiting-host">
          <CharacterFace characterId={room.host.characterId} size={80} />
          <strong>{room.host.nickname}</strong>
          <span className="room-host-record">
            {formatRecord(room.host.record)} · 승률 {formatWinRate(room.host.record)}
          </span>
        </div>
        {room.code && (
          <div className="code-box">
            <span className="hint">방 코드</span>
            <strong className="code-text">{room.code}</strong>
            <CopyCodeButton code={room.code} />
          </div>
        )}
        <p className="waiting-status" role="status">
          플레이어 입장을 기다리는 중
        </p>
        <button
          type="button"
          className="btn"
          disabled={leaving}
          onClick={() => {
            setLeaving(true);
            void onLeave().finally(() => {
              setLeaving(false);
            });
          }}
        >
          나가기
        </button>
      </section>
    </main>
  );
}
