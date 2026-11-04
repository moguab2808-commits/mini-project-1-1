// 대기실: 방 정보와 "플레이어 입장을 기다리는 중". 시작 버튼은 없고 상대가 입장하면 곧바로 경기가 시작된다(DEC-040).
// 화면은 L 화풍(DEC-070): 블러 처리한 일러스트 배경 위에 반투명 원목 창을 둔다. 방장은 2D 얼굴로 보인다.
import { useState } from 'react';
import { THEME_LABEL, type RoomState } from '@alkkagi/shared';
import { BOARD_LABEL } from '../ai/ai-page.tsx';
import { AvatarFace } from '../avatar/AvatarFace.tsx';
import { formatRecord, formatWinRate } from './logic.ts';
import { CopyCodeButton } from './modals.tsx';
import { RegionArt } from './region-art.tsx';

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
      <header className="waiting-top">
        <h1 className="l-logo waiting-logo">증강 알까기</h1>
        <span className="l-ribbon waiting-ribbon">✦ 대기실 · 상대를 기다려요</span>
        <span className="lobby-spacer" />
        <button
          type="button"
          className="l-btn l-btn-cream waiting-leave"
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
      </header>

      <section className="waiting-card l-tray" aria-label="대기실">
        <h2 className="waiting-title">
          {!room.isPublic && (
            <span role="img" aria-label="비공개 방">
              🔒{' '}
            </span>
          )}
          {room.title}
        </h2>
        <dl className="waiting-info">
          <div className="l-well">
            <dt>판</dt>
            <dd>{BOARD_LABEL[room.board]}</dd>
          </div>
          <div className="l-well">
            <dt>알 개수</dt>
            <dd>{room.pieceCount}개</dd>
          </div>
          <div className="waiting-info-theme">
            <RegionArt theme={room.theme} />
            <dt>방 테마</dt>
            <dd>{THEME_LABEL[room.theme]}</dd>
          </div>
        </dl>
        <div className="waiting-host l-well">
          <AvatarFace appearance={room.host.appearance} size={80} />
          <div className="waiting-host-text">
            <strong className="waiting-host-name">{room.host.nickname}</strong>
            <span className="room-host-record">
              {formatRecord(room.host.record)} · 승률 {formatWinRate(room.host.record)}
            </span>
          </div>
        </div>
        {room.code && (
          <div className="code-box">
            <span className="hint">방 코드</span>
            <strong className="code-text">{room.code}</strong>
            <CopyCodeButton code={room.code} />
          </div>
        )}
        <p className="l-ribbon waiting-status" role="status">
          플레이어 입장을 기다리는 중
        </p>
      </section>
    </main>
  );
}
