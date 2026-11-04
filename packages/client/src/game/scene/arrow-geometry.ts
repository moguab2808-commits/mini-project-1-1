// 판 평면 위에 눕혀 그리는 납작한 화살표(DEC-071 ①). 세우거나 기울인 3D 화살표 대신 쓴다.
import { Shape, ShapeGeometry } from 'three';

/**
 * +X 방향을 가리키는 납작한 화살표(몸통 + 머리). 가운데가 원점이고 XZ 평면(판 평면)에 눕혀 둔다.
 * 회전 그룹 안에서 rotation.y = θ 이면 서버 좌표계 각 θ 방향을 가리킨다.
 */
export function flatArrowGeometry(length: number, width: number): ShapeGeometry {
  const head = Math.min(length * 0.45, width * 1.1);
  const shaftHalf = width * 0.22;
  const half = length / 2;
  const s = new Shape();
  s.moveTo(-half, -shaftHalf);
  s.lineTo(half - head, -shaftHalf);
  s.lineTo(half - head, -width / 2);
  s.lineTo(half, 0);
  s.lineTo(half - head, width / 2);
  s.lineTo(half - head, shaftHalf);
  s.lineTo(-half, shaftHalf);
  s.closePath();
  const geo = new ShapeGeometry(s);
  // XY 평면 → XZ 평면: (x, y) → (x, 0, −y). +X 방향은 그대로다
  geo.rotateX(-Math.PI / 2);
  return geo;
}
