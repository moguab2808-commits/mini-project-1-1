// 사람 아바타 이목구비를 캔버스에 그린다(3D 머리의 얼굴 텍스처). 2D SVG 얼굴(AvatarFace.tsx)과
// 같은 부품 경로(`@alkkagi/shared` AVATAR_PARTS)를 Path2D로 그려 모양을 맞춘다.
// 캔버스는 얼굴 좌표 [-50, 50]²(머리 반지름 50 기준)를 정사각형 전체에 대응한다.
import type { ResolvedAvatar } from '@alkkagi/shared';

export type FaceEyes = 'open' | 'wide' | 'happy' | 'shut';
export type FaceMouth = 'smile' | 'frown' | 'flat' | 'open' | 'laugh' | 'tongue';

/** 표정. brow(+)는 미간을 찌푸림, browUp은 얼굴 좌표 단위로 눈썹을 올린다 */
export interface FaceExpression {
  eyes: FaceEyes;
  mouth: FaceMouth;
  blink: boolean;
  brow: number;
  browUp: number;
  browAsym?: number;
}

export const NEUTRAL_FACE: FaceExpression = {
  eyes: 'open',
  mouth: 'smile',
  blink: false,
  brow: 0,
  browUp: 0,
};

const MOUTH_DARK = '#5a2320';
const TONGUE = '#e0707e';

/** 얼굴 좌표 → 캔버스 변환을 걸고 이목구비를 그린다. size는 캔버스 한 변(px) */
export function paintFace(
  ctx: CanvasRenderingContext2D,
  size: number,
  parts: ResolvedAvatar,
  ex: FaceExpression,
) {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 볼터치
  const { eyes: E, eyebrows: B, nose: N, lips: L, skinTone: S } = parts;
  ctx.fillStyle = S.blush;
  ctx.globalAlpha = 0.35;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * (E.x + 5), E.y + 13, 6.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 눈
  for (const sx of [-1, 1]) {
    const cx = sx * E.x;
    ctx.strokeStyle = E.color;
    ctx.fillStyle = E.color;
    if ((ex.eyes === 'open' || ex.eyes === 'wide') && !ex.blink) {
      ctx.beginPath();
      ctx.ellipse(
        cx,
        E.y,
        E.rx * (ex.eyes === 'wide' ? 1.15 : 1),
        E.ry * (ex.eyes === 'wide' ? 1.4 : 1),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + E.rx * 0.32, E.y - E.ry * 0.38, E.rx * 0.36, 0, Math.PI * 2);
      ctx.fill();
      if (E.lash) {
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(cx, E.y, E.rx + 1.4, E.ry + 1.2, 0, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      }
    } else if (ex.eyes === 'happy') {
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(cx, E.y + 2, E.rx + 0.6, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (ex.eyes === 'shut') {
      // 질끈 감음: 바깥쪽이 올라간 꺾인 선
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(cx + sx * (E.rx + 1), E.y - 2.6);
      ctx.lineTo(cx - sx * 1.2, E.y + 0.4);
      ctx.lineTo(cx + sx * (E.rx + 1), E.y + 2.8);
      ctx.stroke();
    } else {
      // 깜빡임
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx - E.rx, E.y + 1);
      ctx.quadraticCurveTo(cx, E.y + 2.6, cx + E.rx, E.y + 1);
      ctx.stroke();
    }
  }

  // 눈썹
  if (B.d) {
    const path = new Path2D(B.d);
    ctx.strokeStyle = B.color;
    ctx.lineWidth = B.width;
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.translate(sx * B.x, B.y - ex.browUp - (sx === 1 ? (ex.browAsym ?? 0) : 0));
      ctx.scale(sx, 1);
      // 오른쪽 눈썹을 기준으로 반시계(화면상) 회전하면 바깥쪽이 올라간다
      ctx.rotate(-ex.brow);
      ctx.stroke(path);
      ctx.restore();
    }
  }

  // 코
  ctx.strokeStyle = S.shade;
  ctx.lineWidth = N.width;
  ctx.stroke(new Path2D(N.d));

  // 입
  paintMouth(ctx, L, ex.mouth);
  ctx.restore();
}

function paintMouth(ctx: CanvasRenderingContext2D, L: ResolvedAvatar['lips'], mouth: FaceMouth) {
  const w = L.halfW;
  const y = L.y;
  ctx.strokeStyle = L.color;
  ctx.lineWidth = L.width;
  switch (mouth) {
    case 'smile':
      ctx.stroke(new Path2D(L.d));
      return;
    case 'frown':
      ctx.beginPath();
      ctx.moveTo(-w * 0.85, y + 3);
      ctx.bezierCurveTo(-w * 0.4, y - 1.5, w * 0.4, y - 1.5, w * 0.85, y + 3);
      ctx.stroke();
      return;
    case 'flat':
      ctx.beginPath();
      ctx.moveTo(-w * 0.7, y + 0.5);
      ctx.lineTo(w * 0.7, y + 0.5);
      ctx.stroke();
      return;
    case 'open':
      ctx.fillStyle = MOUTH_DARK;
      ctx.beginPath();
      ctx.ellipse(0, y + 1, w * 0.55, w * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    case 'laugh':
    case 'tongue':
      ctx.fillStyle = MOUTH_DARK;
      ctx.beginPath();
      ctx.moveTo(-w * 1.05, y - 1.5);
      ctx.lineTo(w * 1.05, y - 1.5);
      ctx.bezierCurveTo(w * 1.0, y + 8, -w * 1.0, y + 8, -w * 1.05, y - 1.5);
      ctx.closePath();
      ctx.fill();
      if (mouth === 'tongue') {
        ctx.fillStyle = TONGUE;
        ctx.beginPath();
        ctx.ellipse(0, y + 5, w * 0.5, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.stroke();
      return;
  }
}
