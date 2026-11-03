import { DEFAULT_APPEARANCE } from '@alkkagi/shared';
import { EventEmitter } from 'node:events';
import type { Socket } from 'socket.io-client';
import { describe, expect, it, vi } from 'vitest';
import { Game } from '@alkkagi/game-core';
import { ERROR_CODES, type CommandResult, type GameStart, type RoomState } from '@alkkagi/shared';
import { RoomClient } from './room-client.ts';

class FakeSocket {
  connected = true;
  readonly incoming = new EventEmitter();
  readonly sent: { event: string; payload: unknown; ack?: (payload: unknown) => void }[] = [];
  readonly volatile = this;
  on(event: string, cb: (...args: unknown[]) => void) {
    this.incoming.on(event, cb);
    return this;
  }
  off(event: string, cb: (...args: unknown[]) => void) {
    this.incoming.off(event, cb);
    return this;
  }
  emit(event: string, payload: unknown, ack?: (payload: unknown) => void) {
    this.sent.push({ event, payload, ack });
    return this;
  }
  connect() {
    this.connected = true;
    return this;
  }
  disconnect() {
    this.connected = false;
    this.fire('disconnect', 'io client disconnect');
    return this;
  }
  fire(event: string, payload: unknown) {
    this.incoming.emit(event, payload);
  }
  get socket() {
    return this as unknown as Socket;
  }
}
const member = {
  nickname: '사람',
  appearance: DEFAULT_APPEARANCE,
  record: { totalGames: 0, wins: 0, losses: 0, draws: 0 },
};
const room: RoomState = {
  roomId: 1,
  title: '방',
  isPublic: true,
  pieceCount: 5,
  board: 'standard',
  theme: 'bar',
  status: 'playing',
  host: member,
  guest: member,
  isHost: true,
};
function start(gameId = 'g1'): GameStart {
  const game = new Game({ gameId, board: 'standard', pieceCount: 5, seed: 42, startMs: 1000 });
  game.start();
  return {
    gameId,
    seat: 0,
    board: 'standard',
    theme: 'bar',
    pieceCount: 5,
    finalRound: 10,
    turnSeconds: 30,
    players: [
      { seat: 0, nickname: '가', appearance: DEFAULT_APPEARANCE },
      { seat: 1, nickname: '나', appearance: DEFAULT_APPEARANCE },
    ],
    view: game.getViewFor(0),
  };
}
function setup() {
  const socket = new FakeSocket();
  const login = vi.fn();
  const closed = vi.fn();
  const client = new RoomClient(socket.socket, { onLoginRequired: login, onRoomClosed: closed });
  return { socket, client, login, closed };
}

describe('온라인 방과 원격 세션', () => {
  it('입장 ack 전 시작·지급을 놓치지 않고 같은 세션이 재도전과 다음 입장자를 받는다', async () => {
    const { socket, client } = setup();
    const joined = client.join({ roomId: 1 });
    socket.fire('room:state', room);
    const match = client.getState().match!;
    const first = start();
    socket.fire('game:start', first);
    const grant = { gameId: 'g1', hazardInstanceId: 'h', kind: 'stun', round: 1, replaced: false };
    socket.fire('hazard:granted', grant);
    expect(match.store.getState().start).toBe(first);
    expect(match.store.getState().grantCard).toMatchObject(grant);
    socket.sent[0]!.ack!({ ok: true, roomId: 1 });
    expect(await joined).toEqual({ ok: true, roomId: 1 });
    socket.fire('game:over', {
      gameId: 'g1',
      winnerId: 0,
      reason: 'forfeit',
      remainingStones: [5, 5],
      rematchDeadlineMs: 16000,
    });
    const rematch = match.session.requestRematch('g1');
    expect(socket.sent.at(-1)).toMatchObject({
      event: 'rematch:request',
      payload: { gameId: 'g1' },
    });
    socket.fire('game:start', start('g2'));
    socket.sent.at(-1)!.ack!({ ok: true });
    expect(await rematch).toEqual({ ok: true });
    expect(client.getState().match).toBe(match);
    expect(match.store.getState().result).toBeNull();
    socket.fire('room:state', { ...room, status: 'waiting', guest: null });
    socket.fire('room:state', room);
    socket.fire('game:start', start('g3'));
    expect(client.getState().match).toBe(match);
    expect(match.store.getState().start!.gameId).toBe('g3');
    client.dispose();
  });

  it('다른 경기·중복 시작·오래된 revision·종료 뒤 이벤트를 버리고 새 경기는 초기화한다', () => {
    const { socket, client } = setup();
    socket.fire('room:state', room);
    const store = client.getState().match!.store;
    const first = start();
    socket.fire('game:start', first);
    const view = { ...first.view, revision: first.view.revision + 3 };
    socket.fire('game:state', view);
    socket.fire('game:state', { ...view, revision: view.revision - 1 });
    socket.fire('game:state', { ...view, gameId: 'other', revision: 999 });
    socket.fire('game:start', first);
    expect(store.getState().view).toBe(view);
    const over = {
      gameId: 'g1',
      winnerId: 0,
      reason: 'forfeit',
      remainingStones: [5, 5],
      rematchDeadlineMs: 16000,
    };
    socket.fire('game:over', over);
    socket.fire('game:state', { ...view, revision: 999 });
    expect(store.getState().view).toBe(view);
    socket.fire('game:start', start('g2'));
    socket.fire('game:over', over);
    socket.fire('game:start', first);
    expect(store.getState().start!.gameId).toBe('g2');
    expect(store.getState().result).toBeNull();
    client.dispose();
  });

  it('경기 ack 오류 코드를 객체 그대로 전달하고 모든 조작을 API 이름으로 보낸다', async () => {
    const { socket, client } = setup();
    socket.fire('room:state', room);
    const session = client.getState().match!.session;
    for (const code of ERROR_CODES) {
      const pending = session.forfeit({ gameId: 'g1' });
      const result: CommandResult = { ok: false, error: { code, message: code } };
      socket.sent.at(-1)!.ack!(result);
      expect(await pending).toBe(result);
    }
    const shot = { gameId: 'g1', turnId: 1, stoneId: 0, angle: 0, power: 20 };
    const pending = session.submitShot(shot);
    expect(socket.sent.at(-1)).toMatchObject({ event: 'shot:submit', payload: shot });
    socket.sent.at(-1)!.ack!({ ok: true });
    await pending;
    session.sendAim({ gameId: 'g1', mode: 'idle' });
    session.aimHazard({
      gameId: 'g1',
      hazardInstanceId: 'h',
      target: { x: 0, y: 0, h: 1 },
      active: false,
    });
    expect(socket.sent.slice(-2).map((e) => e.event)).toEqual(['aim:update', 'hazard:aim']);
    client.dispose();
  });

  it('닫힌 방의 늦은 state·start·성공 ack를 버린다', async () => {
    const { socket, client, closed } = setup();
    const joined = client.join({ roomId: 1 });
    socket.fire('room:closed', { roomId: 1, reason: 'host_left' });
    socket.fire('room:state', room);
    socket.fire('game:start', start());
    socket.sent[0]!.ack!({ ok: true, roomId: 1 });
    expect(await joined).toMatchObject({ ok: false });
    expect(client.getState()).toEqual({ room: null, match: null });
    expect(closed).not.toHaveBeenCalled();
    client.dispose();
  });

  it('시작 실패 ack가 선행 playing 상태를 지우고 늦은 이벤트를 막는다', async () => {
    const { socket, client } = setup();
    const joined = client.join({ roomId: 1 });
    socket.fire('room:state', { ...room, isHost: false });
    const result = { ok: false, error: { code: 'INTERNAL_ERROR', message: '실패' } };
    socket.sent[0]!.ack!(result);
    expect(await joined).toBe(result);
    socket.fire('room:state', room);
    expect(client.getState().room).toBeNull();
    client.dispose();
  });

  it.each(['disconnect', 'connect_error', 'session:replaced'])(
    '%s는 대기 ack를 끝내고 로그인 전환을 한 번만 요청한다',
    async (event) => {
      const { socket, client, login } = setup();
      socket.fire('room:state', room);
      const match = client.getState().match!;
      const pending = match.session.forfeit({ gameId: 'g1' });
      socket.fire(event, { reason: 'new_connection' });
      socket.fire('disconnect', 'transport close');
      expect(await pending).toMatchObject({ ok: false, error: { code: 'GAME_NOT_ACTIVE' } });
      expect(login).toHaveBeenCalledOnce();
      expect(socket.connected).toBe(false);
      expect(client.getState().match).toBeNull();
      expect(socket.incoming.eventNames()).toEqual([]);
    },
  );

  it('dispose는 room:leave를 한 번 보내고 늦은 ack 대기와 이벤트 구독을 정리한다', async () => {
    const { socket, client, login } = setup();
    socket.fire('room:state', room);
    const match = client.getState().match!;
    const pending = match.session.requestRematch('g1');
    match.session.dispose();
    match.session.dispose();
    expect(await pending).toMatchObject({ ok: false });
    expect(socket.sent.filter((e) => e.event === 'room:leave')).toHaveLength(1);
    socket.fire('room:state', room);
    expect(client.getState().room).toBeNull();
    client.dispose();
    expect(login).not.toHaveBeenCalled();
    expect(socket.incoming.eventNames()).toEqual([]);
  });
});
