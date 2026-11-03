// 개발용 아바타 화풍 확인 화면. `npm run dev -w @alkkagi/client` 후 /avatar-harness.html 로 연다(운영 빌드 입력 아님).
// 위 줄은 고른 항목(item)의 선택지 5개, 아래 줄은 무작위 외형(표정 포함), 오른쪽은 같은 외형의 2D SVG 얼굴이다.
// editor=1이면 꾸미기 창만 띄운다.
// 쿼리: item=headShape|hair|eyebrows|eyes|nose|lips|skinTone(기본 hair) seed=<정수> yaw=<라디안>(기본 0.35) spin=1
import {
  APPEARANCE_CHOICES,
  APPEARANCE_KEYS,
  DEFAULT_APPEARANCE,
  randomAppearance,
  type Appearance,
  type AppearanceKey,
} from '@alkkagi/shared';
import { useEffect, useRef, useState } from 'react';
import '../app/app.css';
import { AvatarModal } from '../app/modals.tsx';
import { ToastProvider } from '../app/toast.tsx';
import { createRoot } from 'react-dom/client';
import {
  AmbientLight,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
  Color,
  SRGBColorSpace,
} from 'three';
import { AvatarFace } from './AvatarFace.tsx';
import { AvatarHead } from './avatar-head.ts';
import type { FaceExpression } from './face-paint.ts';

const q = new URLSearchParams(window.location.search);
const YAW = Number(q.get('yaw') ?? '0.35');
const SPIN = q.get('spin') === '1';
const R = 8.5;

const ITEM = (APPEARANCE_KEYS as readonly string[]).includes(q.get('item') ?? '')
  ? (q.get('item') as AppearanceKey)
  : 'hair';

// 위 줄: 고른 항목의 선택지 5개. 아래 줄: 고정 시드 무작위 외형 5개(표정 포함)
const LOOKS: { label: string; a: Appearance }[] = Array.from(
  { length: APPEARANCE_CHOICES },
  (_, i) => ({
    label: `${ITEM} ${String(i + 1)}`,
    a: { ...DEFAULT_APPEARANCE, [ITEM]: i },
  }),
);
let seed = Number(q.get('seed') ?? '7');
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const MIXES = Array.from({ length: 5 }, () => randomAppearance(rand));

const EXPRS: (FaceExpression | null)[] = [
  null,
  { eyes: 'happy', mouth: 'laugh', blink: false, brow: 0, browUp: 3 },
  { eyes: 'shut', mouth: 'frown', blink: false, brow: -0.35, browUp: 0 },
  { eyes: 'open', mouth: 'open', blink: false, brow: -0.2, browUp: 4 },
  { eyes: 'happy', mouth: 'tongue', blink: false, brow: 0.15, browUp: 0 },
];

function makeBust(a: Appearance, ex: FaceExpression | null) {
  const g = new Group();
  const head = new AvatarHead(a, R);
  head.group.position.y = 27;
  head.group.scale.setScalar(1.1);
  if (ex) head.setExpression(ex);
  g.add(head.group);
  const shirt = new MeshStandardMaterial({ color: 0x3f6fb5, roughness: 0.85 });
  const skin = new MeshStandardMaterial({ color: head.parts.skinTone.base, roughness: 0.7 });
  const neck = new Mesh(new CylinderGeometry(2.4, 2.8, 5, 14), skin);
  neck.position.y = 16;
  g.add(neck);
  const trunk = new Mesh(new CylinderGeometry(7.5, 9, 18, 20), shirt);
  trunk.position.y = 5;
  trunk.scale.z = 0.7;
  g.add(trunk);
  for (const sx of [-1, 1]) {
    const sh = new Mesh(new SphereGeometry(3.4, 14, 10), shirt);
    sh.position.set(sx * 8, 12, 0);
    g.add(sh);
  }
  return { g, head };
}

function Harness() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    const W = canvas.clientWidth;
    const Hh = canvas.clientHeight;
    renderer.setSize(W, Hh, false);
    const scene = new Scene();
    scene.background = new Color(0x3a2618);
    scene.add(new HemisphereLight(0xfff1dc, 0x4a2e1c, 1.4));
    scene.add(new AmbientLight(0xffffff, 0.25));
    const key = new DirectionalLight(0xffe6c4, 2.2);
    key.position.set(30, 60, 80);
    scene.add(key);
    const cam = new PerspectiveCamera(30, W / Hh, 1, 1000);
    cam.position.set(0, 16, 215);
    cam.lookAt(0, 16, 0);
    const busts: Group[] = [];
    const heads: AvatarHead[] = [];
    LOOKS.forEach((l, i) => {
      const { g, head } = makeBust(l.a, null);
      g.position.set((i - 2) * 36, 20, 0);
      scene.add(g);
      busts.push(g);
      heads.push(head);
    });
    MIXES.forEach((a, i) => {
      const { g, head } = makeBust(a, EXPRS[i] ?? null);
      g.position.set((i - 2) * 36, -26, 0);
      scene.add(g);
      busts.push(g);
      heads.push(head);
    });
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      for (const b of busts) b.rotation.y = SPIN ? t * 0.6 : YAW;
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    loop();
    (window as unknown as { __ready: boolean }).__ready = true;
    return () => {
      cancelAnimationFrame(raf);
      for (const h of heads) h.dispose();
      renderer.dispose();
    };
  }, []);
  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'sans-serif', color: '#f6e7cf' }}>
      <canvas ref={ref} style={{ flex: '1 1 auto', height: '100%', minWidth: 0 }} />
      <div style={{ width: 300, padding: 16, background: '#2a1a10', overflowY: 'auto' }}>
        <div style={{ marginBottom: 8 }}>2D 얼굴(프로필·카드)</div>
        {LOOKS.map((l) => (
          <div
            key={l.label}
            style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}
          >
            <AvatarFace appearance={l.a} size={84} title={l.label} />
            <AvatarFace appearance={l.a} size={40} />
            <span>{l.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {MIXES.map((a, i) => (
            <AvatarFace key={i} appearance={a} size={52} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** editor=1: 꾸미기 창만 띄운다(저장은 0.3초 뒤 성공으로 흉내 낸다) */
function EditorHarness() {
  const [current, setCurrent] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [open, setOpen] = useState(true);
  return (
    <ToastProvider>
      <div className="app" style={{ height: '100%' }}>
        {!open && (
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            다시 열기
          </button>
        )}
        {open && (
          <AvatarModal
            current={current}
            onSave={(a) =>
              new Promise((resolve) => {
                setTimeout(() => {
                  setCurrent(a);
                  setOpen(false);
                  resolve(null);
                }, 300);
              })
            }
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    </ToastProvider>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(q.get('editor') === '1' ? <EditorHarness /> : <Harness />);
