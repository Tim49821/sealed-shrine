// PixiJS renderer: display only. Reads GameCore state, never mutates it.
// Visual-effect randomness lives here (own LCG), never touches gameplay RNG.
//
// Performance: entities are pooled Sprites from baked textures (no per-frame
// allocation after init). Sprite pools are sized == their sim pools so every
// active bullet is drawn (an invisible-but-lethal bullet is a correctness bug,
// not a perf caveat). One small fx Graphics is redrawn per frame for rings
// and bars; static background/frame are drawn once. Field content is masked so
// nothing draws over the HUD.
import * as PIXI from 'pixi.js';
import { BALANCE as B } from '../core/config.js';
import type { GameCore } from '../core/gameCore.js';
import type { StageVisualId } from '../content/data.js';
import { themePalette } from './themes.js';
import { syncPoolSprites, type SyncStats } from './spriteSync.js';

export interface Overlay {
  title: string;
  lines: string[];
  selected: number; // -1 = no selection cursor
  footer: string;
}

export interface Look {
  playerId: string;
  shotId: string;
  visualTheme: StageVisualId;
}

function bake(app: PIXI.Application, draw: (g: PIXI.Graphics) => void): PIXI.Texture {
  const g = new PIXI.Graphics();
  draw(g);
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

export class Renderer {
  app!: PIXI.Application;
  private world!: PIXI.Container;
  private backgroundLayer!: PIXI.Container;
  private lastTheme: StageVisualId | '' = '';
  private fx!: PIXI.Graphics;
  private hudText!: PIXI.Text;
  private overlayText!: PIXI.Text;
  private lastHud = '';
  private lastOverlay = '';
  private lastLookKey = '';

  private texBullet!: PIXI.Texture;
  private texPower!: PIXI.Texture;
  private texPoint!: PIXI.Texture;
  private texMote!: PIXI.Texture;
  private texWeaver!: PIXI.Texture;
  private texBoss!: PIXI.Texture;
  private texPlayer: Record<string, PIXI.Texture> = {};
  private texShot: Record<string, PIXI.Texture> = {};
  private texOption!: PIXI.Texture;

  private bulletPool: PIXI.Sprite[] = [];
  private shotPool: PIXI.Sprite[] = [];
  private itemPool: PIXI.Sprite[] = [];
  private enemyPool: PIXI.Sprite[] = [];
  private optionPool: PIXI.Sprite[] = [];
  private bossSprite!: PIXI.Sprite;
  private playerSprite!: PIXI.Sprite;
  private shownBullets = 0;
  private shownShots = 0;
  private shownItems = 0;
  /** per-frame sync counts: skipped must stay 0 (pools sized == sim pools) */
  lastBulletSync: SyncStats = { shown: 0, skipped: 0 };
  lastShotSync: SyncStats = { shown: 0, skipped: 0 };
  /** actual renderer backend, reported for QA (item 15) */
  rendererName = 'unknown';
  isWebGL = false;

  async init(parent: HTMLElement): Promise<void> {
    this.app = new PIXI.Application();
    await this.app.init({ width: B.canvasW, height: B.canvasH, background: '#060510', preference: 'webgl' });
    this.isWebGL = this.app.renderer.type === PIXI.RendererType.WEBGL;
    this.rendererName = this.isWebGL ? 'webgl' : `non-webgl(${this.app.renderer.type})`;
    // eslint-disable-next-line no-console
    console.info(`[renderer] backend=${this.rendererName}`);
    parent.appendChild(this.app.canvas);
    this.fit();
    window.addEventListener('resize', () => this.fit());

    this.bakeTextures();

    // world container masked to the playfield
    this.world = new PIXI.Container();
    const mask = new PIXI.Graphics();
    mask.rect(B.fieldX, B.fieldY, B.fieldW, B.fieldH).fill({ color: 0xffffff });
    this.world.addChild(mask);
    this.world.mask = mask;
    this.app.stage.addChild(this.world);

    this.backgroundLayer = new PIXI.Container();
    this.world.addChild(this.backgroundLayer);
    this.paintTheme('mist');

    const mkPool = (n: number, tex: PIXI.Texture): PIXI.Sprite[] => {
      const arr: PIXI.Sprite[] = [];
      for (let i = 0; i < n; i++) {
        const s = new PIXI.Sprite(tex);
        s.anchor.set(0.5);
        s.visible = false;
        this.world.addChild(s);
        arr.push(s);
      }
      return arr;
    };
    this.bulletPool = mkPool(B.enemyBulletPool, this.texBullet);
    this.shotPool = mkPool(B.playerShotPool, this.shotFallback());
    this.itemPool = mkPool(B.itemPool, this.texPoint);
    this.enemyPool = mkPool(B.enemyPool, this.texMote);
    this.optionPool = mkPool(4, this.texOption);
    this.bossSprite = new PIXI.Sprite(this.texBoss);
    this.bossSprite.anchor.set(0.5);
    this.bossSprite.visible = false;
    this.world.addChild(this.bossSprite);
    this.playerSprite = new PIXI.Sprite(this.texPlayer.aria);
    this.playerSprite.anchor.set(0.5);
    this.world.addChild(this.playerSprite);

    this.fx = new PIXI.Graphics();
    this.world.addChild(this.fx);

    this.drawStaticFrame();

    this.hudText = new PIXI.Text({
      text: '',
      style: { fontFamily: '"Courier New", monospace', fontSize: 12, fill: '#e8e4d8', wordWrap: true, wordWrapWidth: 196 },
    });
    this.hudText.x = B.fieldX + B.fieldW + 10;
    this.hudText.y = 48; // below the title block (8..42), never overlapping it
    this.app.stage.addChild(this.hudText);

    this.overlayText = new PIXI.Text({
      text: '',
      style: {
        fontFamily: '"Courier New", monospace', fontSize: 14, fill: '#f2ecd8',
        wordWrap: true, wordWrapWidth: 500,
        dropShadow: { color: '#000000', blur: 0, angle: 0, distance: 2 },
      },
    });
    this.overlayText.x = 70;
    this.overlayText.y = 110;
    this.app.stage.addChild(this.overlayText);
  }

  private shotFallback(): PIXI.Texture {
    return this.texShot['aria-a']!;
  }

  private bakeTextures(): void {
    const app = this.app;
    // enemy bullet: white rim baked around a red core (readable at speed)
    this.texBullet = bake(app, (g) => {
      g.circle(10, 10, 9).fill({ color: 0xffffff });
      g.circle(10, 10, 6.5).fill({ color: 0xe03040 });
      g.circle(8, 8, 2).fill({ color: 0xffc0c8 });
    });
    this.texPower = bake(app, (g) => {
      g.poly([0, -7, 5, 0, 0, 7, -5, 0]).fill({ color: 0x51d651 });
      g.poly([0, -7, 5, 0, 0, 7, -5, 0]).stroke({ color: 0xd8ffd8, width: 1 });
    });
    this.texPoint = bake(app, (g) => {
      g.circle(5, 5, 4.5).fill({ color: 0x4aa3ff });
      g.circle(5, 5, 4.5).stroke({ color: 0xd8ecff, width: 1 });
    });
    // mote: small wisp; weaver: larger knot
    this.texMote = bake(app, (g) => {
      g.circle(10, 10, 8).fill({ color: 0x6a4fc0 });
      g.circle(10, 10, 8).stroke({ color: 0xd8ccff, width: 1.5 });
      g.circle(10, 12, 3).fill({ color: 0x2c1e5e });
    });
    this.texWeaver = bake(app, (g) => {
      g.poly([0, -12, 11, -4, 7, 10, -7, 10, -11, -4]).fill({ color: 0xa03fb0 });
      g.poly([0, -12, 11, -4, 7, 10, -7, 10, -11, -4]).stroke({ color: 0xffd8f2, width: 1.5 });
      g.circle(12, 12, 4).fill({ color: 0x3c1038 });
    });
    this.texBoss = bake(app, (g) => {
      g.circle(20, 20, 18).fill({ color: 0xc0a030 });
      g.circle(20, 20, 18).stroke({ color: 0xfff2c0, width: 2.5 });
      g.circle(20, 20, 9).fill({ color: 0x4a3208 });
      g.circle(20, 17, 3).fill({ color: 0xffe9a0 });
    });
    // Aria (draft shrine keeper): white/red; Rin (draft crafter): violet/gold
    this.texPlayer.aria = bake(app, (g) => {
      g.circle(10, 10, 8).fill({ color: 0xf2f2f2 });
      g.circle(10, 10, 8).stroke({ color: 0xc02020, width: 2 });
      g.rect(8, 2, 4, 6).fill({ color: 0xc02020 });
    });
    this.texPlayer.rin = bake(app, (g) => {
      g.circle(10, 10, 8).fill({ color: 0x5e3fa0 });
      g.circle(10, 10, 8).stroke({ color: 0xffd24a, width: 2 });
      g.circle(10, 10, 3).fill({ color: 0xffd24a });
    });
    // shot variants per shot type (shape + color differ, not just tint)
    this.texShot['aria-a'] = bake(app, (g) => {
      g.rect(2, 0, 5, 16).fill({ color: 0x4ff0e8 });
      g.rect(2, 0, 5, 4).fill({ color: 0xdffffb });
    });
    this.texShot['aria-b'] = bake(app, (g) => {
      g.rect(4, 0, 2, 18).fill({ color: 0xffffff });
      g.rect(3, 0, 4, 3).fill({ color: 0xffb0b0 });
    });
    this.texShot['rin-a'] = bake(app, (g) => {
      g.poly([4, 0, 5.5, 5.5, 11, 7, 5.5, 8.5, 4, 14, 2.5, 8.5, -3, 7, 2.5, 5.5]).fill({ color: 0xffe95f });
    });
    this.texShot['rin-b'] = bake(app, (g) => {
      g.circle(7, 7, 6).fill({ color: 0xff9040 });
      g.circle(7, 7, 6).stroke({ color: 0xffe0b0, width: 1.5 });
      g.circle(5.5, 5.5, 2).fill({ color: 0xfff2d8 });
    });
    this.texOption = bake(app, (g) => {
      g.circle(5, 5, 4).fill({ color: 0xf0e8ff });
      g.circle(5, 5, 4).stroke({ color: 0x8f86c0, width: 1 });
    });
  }

  private fit(): void {
    const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / B.canvasW, window.innerHeight / B.canvasH)));
    const c = this.app.canvas;
    c.style.width = `${B.canvasW * scale}px`;
    c.style.height = `${B.canvasH * scale}px`;
  }

  /** Procedural theme backdrop, repainted only when the stage theme changes. */
  private paintTheme(id: StageVisualId): void {
    for (const child of this.backgroundLayer.children) child.destroy();
    this.backgroundLayer.removeChildren();
    this.lastTheme = id;
    const pal = themePalette(id);
    const g = new PIXI.Graphics();
    const ox = B.fieldX, oy = B.fieldY, W = B.fieldW, H = B.fieldH;
    g.rect(ox, oy, W, H).fill({ color: 0x0d0b1e });
    g.rect(ox, oy, W, 120).fill({ color: pal.sky, alpha: 0.8 });
    g.rect(ox, oy + H - 90, W, 90).fill({ color: pal.ground, alpha: 0.9 });
    // fixed visual-only LCG (never the gameplay RNG)
    let s = 123456789 + id.length * 7919;
    const rnd = (): number => {
      s = (Math.imul(s ^ (s >>> 15), s | 1) + 0x6d2b79f5) | 0;
      return ((s >>> 0) % 10000) / 10000;
    };
    for (let i = 0; i < 90; i++) {
      g.circle(ox + rnd() * W, oy + rnd() * H, 0.5 + rnd() * 1.1).fill({ color: 0x3a3560 });
    }
    if (id === 'mist') {
      // torii silhouette across the top (original draft shape)
      const torii = 0x3a1420;
      g.rect(ox + 40, oy + 18, 12, 46).fill({ color: torii });
      g.rect(ox + W - 52, oy + 18, 12, 46).fill({ color: torii });
      g.rect(ox + 24, oy + 8, W - 48, 12).fill({ color: torii });
      g.rect(ox + 34, oy + 24, W - 68, 5).fill({ color: torii });
      // stone lanterns at the sides
      for (const lx of [ox + 14, ox + W - 14]) {
        g.rect(lx - 4, oy + 120, 8, 60).fill({ color: 0x232033 });
        g.rect(lx - 9, oy + 108, 18, 12).fill({ color: 0x2c2942 });
        g.circle(lx, oy + 114, 3).fill({ color: pal.accent, alpha: 0.85 });
      }
    } else if (id === 'cedar') {
      // dark cedar trunks + amber lantern points
      for (let i = 0; i < 9; i++) {
        const tx = ox + 20 + i * 42;
        g.rect(tx, oy, 10, H).fill({ color: 0x141a12 });
        g.rect(tx + 3, oy, 3, H).fill({ color: 0x1e2a1a, alpha: 0.7 });
      }
      for (let i = 0; i < 12; i++) {
        g.circle(ox + rnd() * W, oy + 40 + rnd() * (H - 80), 2.4).fill({ color: pal.accent, alpha: 0.9 });
      }
    } else if (id === 'river') {
      // horizontal water bands + upward pale streaks
      for (let i = 0; i < 7; i++) {
        g.rect(ox, oy + 30 + i * 58, W, 12).fill({ color: 0x16324a, alpha: 0.55 });
      }
      for (let i = 0; i < 26; i++) {
        const sx = ox + rnd() * W;
        const sy = oy + rnd() * H;
        g.rect(sx, sy - 26, 2, 26).fill({ color: pal.accent, alpha: 0.35 });
      }
    } else if (id === 'forge') {
      // mountain silhouette + dull red furnace squares
      g.poly([ox, oy + 200, ox + 90, oy + 110, ox + 180, oy + 200]).fill({ color: 0x1c1210 });
      g.poly([ox + 170, oy + 220, ox + 290, oy + 90, ox + W, oy + 220]).fill({ color: 0x201412 });
      for (let i = 0; i < 10; i++) {
        g.rect(ox + 30 + rnd() * (W - 60), oy + 240 + rnd() * (H - 270), 9, 9).fill({ color: pal.accent, alpha: 0.5 });
      }
    } else if (id === 'inverted') {
      // mirrored shrine lines above/below center
      const cy = oy + H / 2;
      for (const dir of [1, -1]) {
        g.rect(ox + 60, cy + dir * 60 - 2, W - 120, 4).fill({ color: 0x3a2a4a });
        g.rect(ox + 120, cy + dir * 110 - 2, W - 240, 3).fill({ color: 0x2c1e3a });
        g.circle(ox + W / 2, cy + dir * 60, 4).fill({ color: pal.accent, alpha: 0.8 });
      }
      g.rect(ox, cy - 1, W, 2).fill({ color: pal.accent, alpha: 0.4 });
    } else {
      // seal: concentric broken rings + sparse glyph rectangles
      const cx = ox + W / 2, cy = oy + 150;
      for (let r = 0; r < 5; r++) {
        g.circle(cx, cy, 24 + r * 22).stroke({ color: pal.accent, width: 1.5, alpha: 0.4 });
      }
      for (let i = 0; i < 8; i++) {
        g.rect(ox + 40 + rnd() * (W - 80), oy + 260 + rnd() * 140, 10, 5).fill({ color: pal.accent, alpha: 0.35 });
      }
    }
    // collect line
    g.moveTo(ox, oy + B.collectLineY).lineTo(ox + W, oy + B.collectLineY)
      .stroke({ color: 0x3a3658, width: 1 });
    this.backgroundLayer.addChild(g);
  }

  /** Static frame + HUD panel boxes, drawn once. */
  private drawStaticFrame(): void {
    const g = new PIXI.Graphics();
    g.rect(B.fieldX, B.fieldY, B.fieldW, B.fieldH).stroke({ color: 0x8f86c0, width: 2 });
    const hx = B.fieldX + B.fieldW + 6;
    g.rect(hx, 8, 204, 34).stroke({ color: 0x8f86c0, width: 1 });
    g.rect(hx, 48, 204, 264).stroke({ color: 0x4a4468, width: 1 });
    const title = new PIXI.Text({
      text: 'SEALED SHRINE\ndraft v0.2 (M2)',
      style: { fontFamily: '"Courier New", monospace', fontSize: 11, fill: '#b8b0d8' },
    });
    title.x = hx + 8;
    title.y = 11;
    this.app.stage.addChild(g);
    this.app.stage.addChild(title);
  }

  draw(core: GameCore | null, overlay: Overlay | null, hud: string, look: Look | null): void {
    const ox = B.fieldX, oy = B.fieldY;
    const theme = look?.visualTheme ?? 'mist';
    if (theme !== this.lastTheme) this.paintTheme(theme);
    const lookKey = look ? `${look.playerId}:${look.shotId}` : 'aria:aria-a';
    if (lookKey !== this.lastLookKey) {
      this.lastLookKey = lookKey;
      const [pid, sid] = lookKey.split(':');
      if (this.texPlayer[pid!]) this.playerSprite.texture = this.texPlayer[pid!]!;
      const st = this.texShot[sid!];
      if (st) for (const s of this.shotPool) s.texture = st;
    }

    if (core) {
      // enemy bullets: EVERY active bullet gets a sprite (pools sized == caps)
      this.lastBulletSync = syncPoolSprites(this.bulletPool, core.bullets, ox, oy, 8, this.shownBullets);
      this.shownBullets = this.lastBulletSync.shown;
      // player shots
      this.lastShotSync = syncPoolSprites(this.shotPool, core.shots, ox, oy, 4, this.shownShots);
      this.shownShots = this.lastShotSync.shown;
      // items
      let ii = 0;
      for (const it of core.items) {
        if (!it.active) continue;
        const sp = this.itemPool[ii++]!;
        sp.texture = it.kind === 'power' ? this.texPower : this.texPoint;
        sp.visible = true;
        sp.position.set(ox + it.x, oy + it.y);
        sp.scale.set(1);
      }
      for (let i = ii; i < this.shownItems; i++) this.itemPool[i]!.visible = false;
      this.shownItems = ii;
      // enemies (fixed slot mapping = reuse)
      for (let i = 0; i < core.enemies.length; i++) {
        const e = core.enemies[i]!;
        const sp = this.enemyPool[i]!;
        if (!e.active) { sp.visible = false; continue; }
        sp.texture = e.type === 'weaver' ? this.texWeaver : this.texMote;
        sp.visible = true;
        sp.position.set(ox + e.x, oy + e.y);
      }
      // boss
      const b = core.boss;
      if (b) {
        this.bossSprite.visible = true;
        this.bossSprite.position.set(ox + b.x, oy + b.y);
      } else {
        this.bossSprite.visible = false;
      }
      // player + options
      const blink = core.invuln > 0 && Math.floor(core.tick / 4) % 2 === 0;
      this.playerSprite.visible = !blink;
      this.playerSprite.position.set(ox + core.px, oy + core.py);
      const focused = (core.prevMask & 64) !== 0;
      const nOpt = Math.min(4, Math.floor(core.power));
      for (let i = 0; i < this.optionPool.length; i++) {
        const sp = this.optionPool[i]!;
        if (i >= nOpt || blink) { sp.visible = false; continue; }
        const a = core.tick * 0.05 + (i * Math.PI * 2) / Math.max(1, nOpt);
        const rad = focused ? 12 : 20;
        sp.visible = true;
        sp.position.set(ox + core.px + Math.cos(a) * rad, oy + core.py + Math.sin(a) * rad);
      }
      this.drawFx(core, ox, oy);
    } else {
      for (const p of [this.bulletPool, this.shotPool, this.itemPool, this.enemyPool, this.optionPool]) {
        for (const s of p) s.visible = false;
      }
      this.bossSprite.visible = false;
      this.playerSprite.visible = false;
      this.shownBullets = this.shownShots = this.shownItems = 0;
      this.fx.clear();
    }

    if (hud !== this.lastHud) { this.hudText.text = hud; this.lastHud = hud; }
    if (overlay) {
      const txt = `${overlay.title}\n\n${overlay.lines.map((l, i) => (i === overlay.selected ? '> ' + l : '  ' + l)).join('\n')}\n\n${overlay.footer}`;
      if (txt !== this.lastOverlay) { this.overlayText.text = txt; this.lastOverlay = txt; }
      this.overlayText.visible = true;
    } else {
      if (this.lastOverlay !== '') { this.overlayText.text = ''; this.lastOverlay = ''; }
      this.overlayText.visible = false;
    }
  }

  private drawFx(core: GameCore, ox: number, oy: number): void {
    const g = this.fx;
    g.clear();
    // boss HP bar
    const b = core.boss;
    if (b) {
      const def = b.def.phases[b.phaseIdx]!;
      if (def.kind === 'normal' || def.kind === 'spell') {
        const w = B.fieldW - 40;
        const frac = Math.max(0, b.hp / Math.max(1, def.hp));
        g.rect(ox + 20, oy + 8, w, 6).fill({ color: 0x302a20 });
        g.rect(ox + 20, oy + 8, w * frac, 6).fill({ color: def.kind === 'spell' ? 0xff5f5f : 0x7fbf5f });
      }
    }
    // bomb effect: expanding ring in the character's color
    if (core.bombActive > 0) {
      const prog = 1 - core.bombActive / B.bombDuration;
      const col = core.opts.playerId === 'rin' ? 0xffd24a : 0x8fe8ff;
      const rad = 20 + prog * 240;
      g.circle(ox + core.px, oy + core.py, Math.min(rad, 300)).stroke({ color: col, width: 3, alpha: 1 - prog * 0.7 });
      g.circle(ox + core.px, oy + core.py, Math.min(rad * 0.6, 200)).fill({ color: col, alpha: 0.12 * (1 - prog) });
    }
    const showDot = (core.prevMask & 64) !== 0 || core.pendingDeath >= 0;
    if (showDot && this.playerSprite.visible) {
      g.circle(ox + core.px, oy + core.py, 2.5).fill({ color: 0xffffff });
      g.circle(ox + core.px, oy + core.py, 2.5).stroke({ color: 0xff3040, width: 1 });
    }
    if (core.pendingDeath >= 0) {
      g.circle(ox + core.px, oy + core.py, 12 + (core.tick % 6)).stroke({ color: 0xff9040, width: 2 });
    }
  }
}
