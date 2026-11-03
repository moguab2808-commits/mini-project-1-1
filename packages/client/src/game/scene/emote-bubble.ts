import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace } from 'three';
import type { EmoteId } from '@alkkagi/shared';
import { EMOTE_TEXT } from '../emotes.ts';

/** 카메라를 향하는 머리 위 말풍선. 글자가 바뀔 때만 텍스처를 갱신한다. */
export class EmoteBubble {
  readonly sprite: Sprite;
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D | null;
  private readonly texture: CanvasTexture;
  private kind: EmoteId | null = null;
  constructor() {
    this.canvas.width = 384;
    this.canvas.height = 160;
    this.context = this.canvas.getContext('2d');
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.sprite = new Sprite(
      new SpriteMaterial({
        map: this.texture,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.sprite.scale.set(24, 10, 1);
    this.sprite.renderOrder = 20;
    this.sprite.visible = false;
  }
  update(kind: EmoteId | null) {
    this.sprite.visible = kind !== null;
    if (!kind || kind === this.kind || !this.context) return;
    this.kind = kind;
    const ctx = this.context;
    ctx.clearRect(0, 0, 384, 160);
    ctx.fillStyle = '#fff8e9';
    ctx.strokeStyle = '#533622';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(8, 8, 368, 126, 30);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(170, 132);
    ctx.lineTo(192, 155);
    ctx.lineTo(214, 132);
    ctx.fill();
    ctx.font = 'bold 62px "Malgun Gothic", "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3b291e';
    ctx.fillText(EMOTE_TEXT[kind], 192, 76);
    this.texture.needsUpdate = true;
  }
  dispose() {
    this.sprite.material.dispose();
    this.texture.dispose();
  }
}
