// 내 캐릭터 3D 전신(AvatarFigure)을 투명 배경 캔버스에 그린다. 방 생성 창(IMPL-019, DEC-074)과 캐릭터 꾸미기 창(IMPL-022, DEC-076) 왼쪽에 쓴다.
// 기본은 저절로 천천히 좌우를 돌아보고, `draggable`이면 끌어서 돌려 본다(꾸미기 창). WebGL을 못 쓰면 2D 얼굴(AvatarFace)로 대신한다.
import { resolveAvatar, type Appearance } from '@alkkagi/shared';
import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import { AvatarFace } from './AvatarFace.tsx';
import { AvatarFigure, FIGURE_HEIGHT } from './avatar-figure.ts';

const FOV = 26;
/** 전신이 위아래 여백을 두고 들어오는 거리 */
const CAM_DIST = (FIGURE_HEIGHT * 0.62) / Math.tan(((FOV / 2) * Math.PI) / 180);

export function AvatarFigureView({
  appearance,
  draggable = false,
}: {
  appearance: Appearance;
  /** 왼쪽 버튼으로 끌어 좌우로 돌린다. 끄면 저절로 천천히 좌우를 돌아본다 */
  draggable?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const yawRef = useRef(0.35);
  const sceneRef = useRef<Scene | null>(null);
  const figureRef = useRef<AvatarFigure | null>(null);
  /** 끄는 중이면 그 끌기의 window 리스너를 떼는 함수. 끝나거나 창이 닫히면 비운다 */
  const stopDragRef = useRef<(() => void) | null>(null);
  /** 키 큰 모자(마법사 모자)는 전신보다 위로 솟아 카메라를 조금 더 물린다(DEC-078) */
  const zoomRef = useRef(1);
  const [failed, setFailed] = useState(false);
  const look = JSON.stringify(appearance);

  // 렌더러·장면은 화면에 있는 동안 하나만 쓴다
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setClearColor(0x000000, 0);
    const scene = new Scene();
    sceneRef.current = scene;
    // 밝고 부드러운 조명(진한 그림자 대비 없이)
    scene.add(new HemisphereLight(0xffffff, 0x8a7a6a, 1.7));
    scene.add(new AmbientLight(0xffffff, 0.35));
    const key = new DirectionalLight(0xfff4e6, 1.9);
    key.position.set(25, 50, 70);
    scene.add(key);
    const rim = new DirectionalLight(0xffe2c0, 0.8);
    rim.position.set(-40, 30, -50);
    scene.add(rim);
    const cam = new PerspectiveCamera(FOV, 1, 1, 500);
    const centerY = FIGURE_HEIGHT / 2 - 1;

    let raf = 0;
    // 마지막으로 맞춘 캔버스 크기. 비율이 같아도 크기가 바뀌면 그림 버퍼를 다시 맞춘다
    let sizedW = 0;
    let sizedH = 0;
    let baseDist = CAM_DIST;
    let last = performance.now();
    const t0 = last;
    const loop = (now: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0 && (w !== sizedW || h !== sizedH)) {
        sizedW = w;
        sizedH = h;
        renderer.setSize(w, h, false);
        cam.aspect = w / h;
        // 가로가 좁으면 전신이 잘리지 않게 뒤로 물러난다
        baseDist = CAM_DIST * Math.max(1, 0.8 / cam.aspect);
        cam.updateProjectionMatrix();
      }
      cam.position.set(0, centerY + 6, baseDist * zoomRef.current);
      cam.lookAt(0, centerY + (zoomRef.current - 1) * 30, 0);
      const dt = Math.min(0.1, (now - last) / 1000);
      const t = (now - t0) / 1000;
      last = now;
      const figure = figureRef.current;
      if (figure) {
        figure.root.rotation.y = draggable ? yawRef.current : Math.sin(t * 0.45) * 0.45;
        figure.update(t, dt);
      }
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      figureRef.current?.dispose();
      figureRef.current = null;
      sceneRef.current = null;
      renderer.dispose();
    };
  }, [draggable]);

  // 끄는 중에 창이 닫혀도 window 리스너가 남지 않게 한다
  useEffect(() => () => stopDragRef.current?.(), []);

  // 외형이 바뀌면 모델만 바꾼다
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const look2 = JSON.parse(look) as Appearance;
    zoomRef.current = resolveAvatar(look2).hat.kind === 'wizard' ? 1.2 : 1;
    const figure = new AvatarFigure(look2);
    const old = figureRef.current;
    if (old) {
      scene.remove(old.root);
      old.dispose();
    }
    scene.add(figure.root);
    figureRef.current = figure;
  }, [look, failed, draggable]);

  if (failed) {
    return (
      <div className="figure-view figure-view-flat">
        <AvatarFace appearance={appearance} size={180} title="내 캐릭터" />
      </div>
    );
  }
  return (
    <canvas
      ref={canvasRef}
      className={draggable ? 'figure-view figure-view-drag' : 'figure-view'}
      role="img"
      aria-label={draggable ? '내 캐릭터 3D 전신(끌어서 돌리기)' : '내 캐릭터 3D 전신'}
      onPointerDown={
        draggable
          ? (e) => {
              const start = e.clientX;
              const base = yawRef.current;
              e.currentTarget.setPointerCapture(e.pointerId);
              const move = (ev: PointerEvent) => {
                yawRef.current = base + (ev.clientX - start) * 0.012;
              };
              const up = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                window.removeEventListener('pointercancel', up);
                stopDragRef.current = null;
              };
              stopDragRef.current?.();
              stopDragRef.current = up;
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up);
              window.addEventListener('pointercancel', up);
            }
          : undefined
      }
    />
  );
}
