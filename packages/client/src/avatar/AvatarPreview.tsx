// 꾸미기 창 왼쪽의 3D 미리보기. 게임 장면과 같은 CharacterRig(상반신)를 쉬는 자세로 그린다.
// 왼쪽 버튼으로 끌면 좌우로 돌려 볼 수 있다. WebGL을 못 쓰면 2D 얼굴로 대신한다.
import type { Appearance } from '@alkkagi/shared';
import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import { CharacterRig, type CharacterFrame } from '../game/scene/characters.ts';
import { TABLE_Y } from '../game/scene/stage.ts';
import { AvatarFace } from './AvatarFace.tsx';

const HEAD_Y = 24;

export function AvatarPreview({ appearance }: { appearance: Appearance }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const yawRef = useRef(0.35);
  const [failed, setFailed] = useState(false);
  const look = JSON.stringify(appearance);

  const sceneRef = useRef<Scene | null>(null);
  const rigRef = useRef<CharacterRig | null>(null);

  // 렌더러·장면은 창이 열려 있는 동안 하나만 쓴다
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    const scene = new Scene();
    sceneRef.current = scene;
    scene.background = new Color(0x3a2618);
    scene.add(new HemisphereLight(0xfff1dc, 0x4a2e1c, 1.4));
    scene.add(new AmbientLight(0xffffff, 0.25));
    const key = new DirectionalLight(0xffe6c4, 2.2);
    key.position.set(30, 60, 80);
    scene.add(key);
    const cam = new PerspectiveCamera(30, 1, 1, 500);
    cam.position.set(0, HEAD_Y, 112);
    cam.lookAt(0, HEAD_Y - 11, 0);
    const tableGeo = new BoxGeometry(60, 3, 24);
    const tableMat = new MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.8 });
    const table = new Mesh(tableGeo, tableMat);
    table.position.set(0, TABLE_Y - 1.5, 14);
    scene.add(table);

    const frame: CharacterFrame = {
      dt: 0,
      t: 0,
      lookYaw: 0,
      lookPitch: -0.05,
      aim: null,
      grab: null,
      hold: null,
      gesture: 'neutral',
      opponentHead: { x: 0, y: HEAD_Y, z: 200 },
      watch: null,
      blind: 0,
      firstPerson: false,
      hideArms: false,
      camLocal: null,
      opacity: 1,
    };

    let raf = 0;
    let last = performance.now();
    const t0 = last;
    const loop = (now: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0 && cam.aspect !== w / h) {
        renderer.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
      frame.dt = Math.min(0.1, (now - last) / 1000);
      frame.t = (now - t0) / 1000;
      last = now;
      const rig = rigRef.current;
      if (rig) {
        // 좌석 로컬 +Z가 카메라 쪽이다. 끈 만큼 더 돌린다
        rig.root.rotation.y = yawRef.current;
        rig.update(frame);
      }
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      rigRef.current?.dispose();
      rigRef.current = null;
      sceneRef.current = null;
      tableGeo.dispose();
      tableMat.dispose();
      renderer.dispose();
    };
  }, []);

  // 외형이 바뀌면 모델만 바꾼다
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const rig = new CharacterRig(JSON.parse(look) as Appearance, 0);
    rig.root.position.set(0, 0, 0);
    const old = rigRef.current;
    if (old) {
      scene.remove(old.root);
      old.dispose();
    }
    scene.add(rig.root);
    rigRef.current = rig;
  }, [look, failed]);

  if (failed) {
    return (
      <div className="avatar-preview avatar-preview-flat">
        <AvatarFace appearance={appearance} size={180} title="미리보기" />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="avatar-preview"
      role="img"
      aria-label="3D 미리보기(끌어서 돌리기)"
      onPointerDown={(e) => {
        const start = e.clientX;
        const base = yawRef.current;
        e.currentTarget.setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) => {
          yawRef.current = base + (ev.clientX - start) * 0.012;
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
    />
  );
}
