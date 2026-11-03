// 같은 출처의 REST API(docs/design/API.md). 세션은 쿠키가 맡는다. fetch를 주입할 수 있어 단위 검증이 쉽다.
import { NETWORK_ERROR_MESSAGE, authErrorMessage } from './messages.ts';
import type { CharacterId, Login, Me, PasswordChange, RoomSummary, Signup } from '@alkkagi/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 화면에 보일 안내. REST 오류는 코드별 문구, 응답을 받지 못한 경우(네트워크 단절)는 연결 실패 문구다. */
export function describeApiError(error: unknown): string {
  return error instanceof ApiError ? authErrorMessage(error.code) : NETWORK_ERROR_MESSAGE;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

async function parseError(res: Response): Promise<ApiError> {
  let code = 'INTERNAL_ERROR';
  let message = '';
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    code = body.error?.code ?? code;
    message = body.error?.message ?? '';
  } catch {
    // 본문이 JSON이 아니면(프록시 오류 등) 일반 오류로 다룬다.
  }
  return new ApiError(res.status, code, message);
}

export interface Api {
  signup(input: Signup): Promise<void>;
  login(input: Login): Promise<Me>;
  logout(): Promise<void>;
  me(): Promise<Me>;
  changePassword(input: PasswordChange): Promise<void>;
  changeCharacter(characterId: CharacterId): Promise<Me>;
  listRooms(): Promise<RoomSummary[]>;
}

export function createApi(fetchFn: FetchFn = (input, init) => fetch(input, init)): Api {
  async function call(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await fetchFn(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw await parseError(res);
    return res;
  }
  return {
    async signup(input) {
      await call('POST', '/api/auth/signup', input);
    },
    async login(input) {
      const res = await call('POST', '/api/auth/login', input);
      return ((await res.json()) as { user: Me }).user;
    },
    async logout() {
      await call('POST', '/api/auth/logout');
    },
    async me() {
      const res = await call('GET', '/api/me');
      return ((await res.json()) as { user: Me }).user;
    },
    async changePassword(input) {
      await call('PATCH', '/api/me/password', input);
    },
    async changeCharacter(characterId) {
      const res = await call('PATCH', '/api/me/character', { characterId });
      return ((await res.json()) as { user: Me }).user;
    },
    async listRooms() {
      const res = await call('GET', '/api/rooms');
      return ((await res.json()) as { rooms: RoomSummary[] }).rooms;
    },
  };
}
