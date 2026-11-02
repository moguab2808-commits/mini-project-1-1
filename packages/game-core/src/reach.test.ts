// 실행: 루트에서 npm test (Vitest)
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { beamHitsFace, facePoint, reachOf } from './index.ts';

describe('reachOf', () => {
  test('좌석 기준점에서의 거리로 편안·흔들림·닿지 않음을 가른다', () => {
    const near = reachOf(0, 0, -30);
    assert.deepEqual(near, { distance: 0, strain: 0, reachable: true });
    assert.equal(reachOf(0, 0, -4).strain, 0, '26cm까지 편안');
    assert.ok(Math.abs(reachOf(0, 0, 3).strain - 0.5) < 1e-9, '33cm는 중간');
    assert.deepEqual(reachOf(0, 0, 10), { distance: 40, strain: 1, reachable: true });
    assert.equal(reachOf(0, 0, 10.01).reachable, false);
  });

  test('좌석 1은 +y 쪽 기준점을 쓴다', () => {
    assert.equal(reachOf(1, 0, 30).distance, 0);
    assert.equal(reachOf(1, 0, -10.01).reachable, false);
    assert.equal(reachOf(1, 0, 15).reachable, true);
  });
});

describe('beamHitsFace', () => {
  test('상대 얼굴 쪽은 맞고 반각 10°를 벗어나면 빗나간다', () => {
    assert.equal(beamHitsFace(0, facePoint(1)), true);
    assert.equal(beamHitsFace(1, facePoint(0)), true);
    assert.equal(beamHitsFace(0, facePoint(0)), false, '반대 방향');
    // 손 (0, −22, 12) → 얼굴 (0, 30, 24): 거리 약 53. 옆으로 15cm면 약 16°
    assert.equal(beamHitsFace(0, { x: 15, y: 30, h: 24 }), false);
    assert.equal(beamHitsFace(0, { x: 5, y: 30, h: 24 }), true);
    assert.equal(beamHitsFace(0, { x: 0, y: -22, h: 12 }), false, '손 위치 자체는 빗나감');
  });
});
