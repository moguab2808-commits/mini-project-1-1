import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type RequestHandler } from 'express';

const API_PREFIXES = ['/api', '/socket.io', '/health'];

function isReserved(requestPath: string): boolean {
  return API_PREFIXES.some(
    (prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`),
  );
}

/**
 * 빌드된 클라이언트를 정적 파일로 제공한다(OPERATIONS SPA fallback).
 * `/api`·`/socket.io`·`/health` 밖의 확장자 없는 GET은 `index.html`로 대체하고,
 * 확장자가 있는 요청은 파일이 없으면 404로 둔다.
 */
export function createStaticHandlers(staticDir: string): RequestHandler[] {
  const indexFile = path.join(staticDir, 'index.html');
  const serveFiles = express.static(staticDir, { index: false, fallthrough: true });
  const fallback: RequestHandler = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (isReserved(req.path)) return next();
    if (path.extname(req.path) !== '') {
      res.status(404).type('text/plain').send('Not Found');
      return;
    }
    res.sendFile(indexFile);
  };
  return [serveFiles, fallback];
}

export function hasClientBuild(staticDir: string): boolean {
  return existsSync(path.join(staticDir, 'index.html'));
}
