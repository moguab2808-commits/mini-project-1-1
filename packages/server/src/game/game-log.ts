// 서버 로그(OPERATIONS "서버 로그"): 구조화 JSON 한 줄을 stdout으로 내보낸다.
// 허용 목록 방식이다. 정해진 키만 직렬화하고 요청·소켓·세션 객체는 받지 않는다.
import type { RuntimeLogEntry } from '@alkkagi/game-runtime';

export type GameLogLine = {
  ts: string;
  mono: number;
  roomId: number;
  gameId: string | null;
  turnId?: number;
  userId?: number;
  ingressSeq?: number;
  serverTick?: number;
  event: RuntimeLogEntry['event'];
  result?: string;
  reason?: string;
};

export type GameLogSink = (line: string) => void;

export const stdoutSink: GameLogSink = (line) => {
  console.log(line);
};

/** 런타임 로그 항목에 UTC 시각·방 번호·사용자 번호를 덧붙여 허용된 키만 한 줄로 만든다. */
export function toLogLine(
  entry: RuntimeLogEntry,
  context: { roomId: number; userIdOf: (seat: 0 | 1) => number | undefined; now?: () => Date },
): GameLogLine {
  const userId = entry.seat === undefined ? undefined : context.userIdOf(entry.seat);
  const line: GameLogLine = {
    ts: (context.now?.() ?? new Date()).toISOString(),
    mono: entry.mono,
    roomId: context.roomId,
    gameId: entry.gameId,
    event: entry.event,
  };
  if (entry.turnId !== undefined) line.turnId = entry.turnId;
  if (userId !== undefined) line.userId = userId;
  if (entry.ingressSeq !== undefined) line.ingressSeq = entry.ingressSeq;
  if (entry.serverTick !== undefined) line.serverTick = entry.serverTick;
  if (entry.result !== undefined) line.result = entry.result;
  if (entry.reason !== undefined) line.reason = entry.reason;
  return line;
}
