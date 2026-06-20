import { TILE_SIZE, LAYOUT, TILE_COLORS, TILE_PASSABLE, TILE_ENCOUNTER, CANVAS_W } from '../constants.js';

const TILE_H = LAYOUT.game.h;
const TILE_Y0 = LAYOUT.game.y;

export class MapSystem {
  constructor(game) {
    this.game = game;
    this.mapData = null;
    this.camX = 0;
    this.camY = 0;
  }

  async load(mapId) {
    this.mapData = await this.game.loader.loadMap(mapId);
    return this.mapData;
  }

  isWalkable(tx, ty) {
    if (!this.mapData) return false;
    const { width, height, layers } = this.mapData;
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return false;
    const tileId = layers.ground[ty][tx];
    // オブジェクト層にあるタイルは通行不可
    const obj = layers.objects ? layers.objects[ty][tx] : 0;
    if (obj !== 0) return false;
    return TILE_PASSABLE.has(tileId);
  }

  isEncounterTile(tx, ty) {
    if (!this.mapData) return false;
    const id = this.mapData.layers.ground[ty]?.[tx];
    return TILE_ENCOUNTER.has(id);
  }

  getExit(tx, ty) {
    if (!this.mapData?.exits) return null;
    return this.mapData.exits.find(e => e.x === tx && e.y === ty) || null;
  }

  getNpcAt(tx, ty) {
    if (!this.mapData?.npcs) return null;
    return this.mapData.npcs.find(n => n.x === tx && n.y === ty) || null;
  }

  getEventAt(tx, ty) {
    if (!this.mapData?.posEvents) return null;
    return this.mapData.posEvents.find(e => e.x === tx && e.y === ty) || null;
  }

  updateCamera(playerPixelX, playerPixelY) {
    const maxCamX = this.mapData ? this.mapData.width  * TILE_SIZE - CANVAS_W : 0;
    const maxCamY = this.mapData ? this.mapData.height * TILE_SIZE - TILE_H   : 0;
    this.camX = Math.max(0, Math.min(playerPixelX - CANVAS_W / 2 + TILE_SIZE / 2, maxCamX));
    this.camY = Math.max(0, Math.min(playerPixelY - TILE_H   / 2 + TILE_SIZE / 2, maxCamY));
  }

  render(ctx, npcs = [], playerSprite = null) {
    if (!this.mapData) return;
    const { width, height, layers } = this.mapData;

    // タイル描画範囲
    const startTX = Math.floor(this.camX / TILE_SIZE);
    const startTY = Math.floor(this.camY / TILE_SIZE);
    const endTX   = Math.min(width  - 1, startTX + Math.ceil(CANVAS_W / TILE_SIZE) + 1);
    const endTY   = Math.min(height - 1, startTY + Math.ceil(TILE_H   / TILE_SIZE) + 1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TILE_Y0, CANVAS_W, TILE_H);
    ctx.clip();

    // グラウンド層
    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const id = layers.ground[ty]?.[tx] ?? 0;
        const dx = tx * TILE_SIZE - this.camX;
        const dy = TILE_Y0 + ty * TILE_SIZE - this.camY;
        ctx.fillStyle = TILE_COLORS[id] ?? '#000';
        ctx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
        this._drawTileDetail(ctx, id, dx, dy);
      }
    }

    // オブジェクト層
    if (layers.objects) {
      for (let ty = startTY; ty <= endTY; ty++) {
        for (let tx = startTX; tx <= endTX; tx++) {
          const id = layers.objects[ty]?.[tx] ?? 0;
          if (id === 0) continue;
          const dx = tx * TILE_SIZE - this.camX;
          const dy = TILE_Y0 + ty * TILE_SIZE - this.camY;
          this._drawObject(ctx, id, dx, dy);
        }
      }
    }

    // NPC描画
    for (const npc of npcs) {
      const dx = npc.x * TILE_SIZE - this.camX;
      const dy = TILE_Y0 + npc.y * TILE_SIZE - this.camY;
      this._drawNpc(ctx, npc, dx, dy);
    }

    // プレイヤー描画
    if (playerSprite) {
      const dx = playerSprite.px - this.camX;
      const dy = TILE_Y0 + playerSprite.py - this.camY;
      this._drawSatoshi(ctx, dx, dy, playerSprite.dir);
    }

    ctx.restore();
  }

  _drawTileDetail(ctx, id, dx, dy) {
    const TS = TILE_SIZE;
    switch (id) {
      case 1: { // 草 — 草丈の表現
        const blades = [[3,20],[8,8],[14,24],[20,14],[26,6],[10,4],[24,22],[6,16]];
        for (const [bx, by] of blades) {
          ctx.fillStyle = '#4a9030';
          ctx.fillRect(dx+bx, dy+by, 2, 5);
          ctx.fillStyle = '#5aaa3a';
          ctx.fillRect(dx+bx, dy+by, 2, 2);   // 先端ハイライト
        }
        // 影エッジ
        ctx.fillStyle = '#244814';
        ctx.fillRect(dx, dy, TS, 1);
        ctx.fillRect(dx, dy, 1, TS);
        break;
      }
      case 2: { // 道 — 砂利感
        const pebbles = [[3,5],[9,17],[17,9],[23,21],[5,25],[13,3],[27,14]];
        for (const [px, py] of pebbles) {
          ctx.fillStyle = '#aa8828';
          ctx.fillRect(dx+px, dy+py, 3, 2);
          ctx.fillStyle = '#cc9a30';
          ctx.fillRect(dx+px, dy+py, 2, 1);
        }
        // わだち
        ctx.fillStyle = '#6a4a10';
        ctx.fillRect(dx+8, dy, 2, TS);
        ctx.fillRect(dx+22, dy, 2, TS);
        break;
      }
      case 4: { // 木タイル
        ctx.fillStyle = '#224a12';
        ctx.fillRect(dx+4, dy+4, TS-8, TS-8);
        ctx.fillStyle = '#1a3a0a';
        ctx.fillRect(dx+8, dy+8, TS-16, TS-16);
        ctx.fillStyle = '#3a6a1e';
        ctx.fillRect(dx+6, dy+4, 4, 4);
        break;
      }
      case 5: { // 石壁 — ブロック模様
        ctx.fillStyle = '#3a2a48';
        ctx.fillRect(dx, dy, TS, 2);    // 上モルタル
        ctx.fillRect(dx, dy+16, TS, 2);
        ctx.fillRect(dx+16, dy+2, 2, 14);  // 縦目地
        ctx.fillRect(dx+8, dy+18, 2, 14);
        // 影
        ctx.fillStyle = '#221828';
        ctx.fillRect(dx, dy+14, TS, 2);
        break;
      }
      case 6: { // 木の床 — 板目
        ctx.fillStyle = '#7a5030';
        ctx.fillRect(dx, dy, TS, 2);
        ctx.fillRect(dx, dy+10, TS, 1);
        ctx.fillRect(dx, dy+21, TS, 2);
        ctx.fillRect(dx+11, dy, 1, 10);
        ctx.fillRect(dx+22, dy+11, 1, 11);
        // 光沢
        ctx.fillStyle = '#9a6838';
        ctx.fillRect(dx+1, dy+1, 9, 1);
        ctx.fillRect(dx+13, dy+11, 8, 1);
        break;
      }
      case 8: { // 森の地面 — 苔・落ち葉
        const marks = [[4,8],[12,22],[20,6],[26,18],[8,28],[22,28]];
        for (const [mx2, my2] of marks) {
          ctx.fillStyle = '#1e3214';
          ctx.fillRect(dx+mx2, dy+my2, 4, 2);
          ctx.fillStyle = '#243c18';
          ctx.fillRect(dx+mx2, dy+my2, 2, 1);
        }
        // 暗いエッジ
        ctx.fillStyle = '#0e1a08';
        ctx.fillRect(dx, dy, TS, 1);
        ctx.fillRect(dx, dy, 1, TS);
        break;
      }
      case 12: { // 井戸
        ctx.fillStyle = '#6a6a8a';
        ctx.fillRect(dx+6, dy+8, TS-12, TS-12);
        ctx.fillStyle = '#12122a';
        ctx.fillRect(dx+10, dy+12, TS-20, TS-18);
        // 縁木
        ctx.fillStyle = '#7a5a30';
        ctx.fillRect(dx+4, dy+6, TS-8, 4);
        // つるべ支柱
        ctx.fillStyle = '#5a4220';
        ctx.fillRect(dx+4, dy+2, 4, 6);
        ctx.fillRect(dx+24, dy+2, 4, 6);
        ctx.fillRect(dx+4, dy+2, TS-8, 2);
        break;
      }
      case 13: { // ドア — 木目と取っ手
        ctx.fillStyle = '#8a5c34';
        ctx.fillRect(dx+5, dy+4, TS-10, TS-6);
        // 木目
        ctx.fillStyle = '#6a4224';
        ctx.fillRect(dx+5, dy+12, TS-10, 1);
        ctx.fillRect(dx+5, dy+20, TS-10, 1);
        // 取っ手
        ctx.fillStyle = '#d4a040';
        ctx.fillRect(dx+19, dy+14, 4, 4);
        ctx.fillStyle = '#f0c060';
        ctx.fillRect(dx+20, dy+15, 2, 2);
        break;
      }
    }
  }

  _drawObject(ctx, id, dx, dy) {
    const TS = TILE_SIZE;
    switch (id) {
      case 1: { // 木（オブジェクト）— 幹+葉の重ね
        // 幹
        ctx.fillStyle = '#5a3810';
        ctx.fillRect(dx+13, dy+22, 6, 10);
        ctx.fillStyle = '#3a2008';
        ctx.fillRect(dx+16, dy+22, 3, 10);
        // 葉（外）
        ctx.fillStyle = '#286018';
        ctx.fillRect(dx+3, dy+4, TS-6, 22);
        // 葉（中）
        ctx.fillStyle = '#369022';
        ctx.fillRect(dx+6, dy+2, TS-12, 18);
        // 葉（ハイライト）
        ctx.fillStyle = '#44aa2c';
        ctx.fillRect(dx+8, dy+2, 8, 6);
        ctx.fillRect(dx+14, dy+6, 5, 4);
        // 葉の縁陰影
        ctx.fillStyle = '#1a4010';
        ctx.fillRect(dx+3, dy+22, TS-6, 2);
        break;
      }
      case 2: { // 家（壁）
        // 壁
        ctx.fillStyle = '#6a5545';
        ctx.fillRect(dx, dy, TS, TS);
        // 石積み模様
        ctx.fillStyle = '#4a3a2e';
        ctx.fillRect(dx, dy+8, TS, 1);
        ctx.fillRect(dx, dy+16, TS, 1);
        ctx.fillRect(dx, dy+24, TS, 1);
        ctx.fillRect(dx+16, dy, 1, 8);
        ctx.fillRect(dx+8, dy+8, 1, 8);
        ctx.fillRect(dx+20, dy+16, 1, 8);
        // 窓
        ctx.fillStyle = '#223050';
        ctx.fillRect(dx+4, dy+4, 10, 8);
        ctx.fillStyle = '#3a5088';
        ctx.fillRect(dx+5, dy+5, 4, 3);
        ctx.fillRect(dx+9, dy+5, 4, 3);
        break;
      }
      case 3: { // 家（屋根）
        ctx.fillStyle = '#7a2e28';
        ctx.fillRect(dx, dy, TS, TS);
        // 瓦の筋
        ctx.fillStyle = '#9a3e38';
        ctx.fillRect(dx+4, dy+4, TS-8, TS-8);
        ctx.fillStyle = '#602020';
        ctx.fillRect(dx, dy+8, TS, 1);
        ctx.fillRect(dx, dy+16, TS, 1);
        ctx.fillRect(dx, dy+24, TS, 1);
        // ハイライト
        ctx.fillStyle = '#aa4a44';
        ctx.fillRect(dx+4, dy+4, 6, 2);
        break;
      }
      case 4: { // 光る石（オブジェクト）
        const glow = 0.25 + 0.2 * Math.sin(Date.now() / 400);
        // 台座
        ctx.fillStyle = '#283858';
        ctx.fillRect(dx+8, dy+20, 16, 8);
        // 石本体
        ctx.fillStyle = '#2a4a90';
        ctx.fillRect(dx+10, dy+14, 12, 10);
        ctx.fillStyle = '#5888cc';
        ctx.fillRect(dx+12, dy+12, 8, 8);
        ctx.fillStyle = '#90b8f0';
        ctx.fillRect(dx+14, dy+10, 4, 6);
        // グロー
        ctx.globalAlpha = glow;
        ctx.fillStyle = '#aaddff';
        ctx.fillRect(dx+6, dy+8, 20, 16);
        ctx.globalAlpha = 1;
        // コア白
        ctx.fillStyle = '#e0f4ff';
        ctx.fillRect(dx+15, dy+11, 2, 2);
        break;
      }
      case 5: { // 棚・家具
        ctx.fillStyle = '#8a5830';
        ctx.fillRect(dx+2, dy+4, TS-4, TS-6);
        // 棚板
        ctx.fillStyle = '#6a4020';
        ctx.fillRect(dx+2, dy+4, TS-4, 2);
        ctx.fillRect(dx+2, dy+14, TS-4, 2);
        ctx.fillRect(dx+2, dy+24, TS-4, 2);
        // 側面の影
        ctx.fillStyle = '#4a2810';
        ctx.fillRect(dx+26, dy+4, 4, TS-6);
        break;
      }
      case 6: { // ベッド
        // フレーム
        ctx.fillStyle = '#5a3870';
        ctx.fillRect(dx+2, dy+2, TS-4, TS-4);
        // 枕
        ctx.fillStyle = '#9870c0';
        ctx.fillRect(dx+4, dy+4, TS-8, 10);
        ctx.fillStyle = '#b890e0';
        ctx.fillRect(dx+5, dy+5, TS-12, 6);
        // 布団
        ctx.fillStyle = '#ece8dc';
        ctx.fillRect(dx+4, dy+14, TS-8, 14);
        // 縫い目
        ctx.fillStyle = '#c8c0aa';
        ctx.fillRect(dx+4, dy+20, TS-8, 1);
        ctx.fillRect(dx+14, dy+14, 1, 14);
        break;
      }
    }
  }

  _drawNpc(ctx, npc, dx, dy) {
    if (npc.sprite === 'mofu') {
      this._drawMofu(ctx, dx, dy);
      return;
    }

    const cx = dx + 16;
    const palette = {
      elder:      { body: '#7a5818', trim: '#b08828', hair: '#d0d0c8', skin: '#d8a870', pants: '#3a2a10' },
      mom:        { body: '#c85878', trim: '#e888b0', hair: '#2a1008', skin: '#f0c080', pants: '#3a2040' },
      villager_a: { body: '#385878', trim: '#5888a8', hair: '#1e0e04', skin: '#e8b870', pants: '#1e2840' },
      villager_b: { body: '#783858', trim: '#a05878', hair: '#120404', skin: '#e8b870', pants: '#282038' },
      villager_c: { body: '#387838', trim: '#509850', hair: '#1a1008', skin: '#f0c080', pants: '#203820' },
      ril:        { body: '#5070b8', trim: '#80a0e0', hair: '#e8d840', skin: '#f0c880', pants: '#1c1c40' },
    };
    const c = palette[npc.sprite] || { body: '#505058', trim: '#707078', hair: '#282828', skin: '#e8b870', pants: '#202030' };

    // 足元シャドウ
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx-8, dy+30, 16, 4);

    // ===== 輪郭シルエット =====
    ctx.fillStyle = '#04040e';
    ctx.fillRect(cx-7, dy-1, 14, 14);   // 頭
    ctx.fillRect(cx-8, dy+10, 16, 14);  // 体
    ctx.fillRect(cx-8, dy+22, 16, 10);  // 足

    // 靴
    ctx.fillStyle = '#14141e';
    ctx.fillRect(cx-7, dy+28, 6, 4);
    ctx.fillRect(cx+1, dy+28, 6, 4);
    ctx.fillStyle = '#1e2030';
    ctx.fillRect(cx-6, dy+28, 3, 1);
    ctx.fillRect(cx+2, dy+28, 3, 1);

    // 足（ズボン）
    ctx.fillStyle = c.pants || '#202030';
    ctx.fillRect(cx-7, dy+22, 5, 8);
    ctx.fillRect(cx+2, dy+22, 5, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(cx-7, dy+22, 2, 7);
    ctx.fillRect(cx+2, dy+22, 2, 7);

    // 腕（肌）
    ctx.fillStyle = c.skin;
    ctx.fillRect(cx-11, dy+12, 4, 9);
    ctx.fillRect(cx+7, dy+12, 4, 9);
    // 袖
    ctx.fillStyle = c.body;
    ctx.fillRect(cx-11, dy+11, 4, 5);
    ctx.fillRect(cx+7, dy+11, 4, 5);

    // 胴体
    ctx.fillStyle = c.body;
    ctx.fillRect(cx-6, dy+11, 12, 12);
    // 衿・トリム
    ctx.fillStyle = c.trim;
    ctx.fillRect(cx-6, dy+11, 12, 3);
    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(cx+4, dy+11, 2, 12);
    ctx.fillRect(cx-6, dy+11, 2, 12);

    // 首
    ctx.fillStyle = c.skin;
    ctx.fillRect(cx-2, dy+8, 4, 5);

    // 頭（顔）
    ctx.fillStyle = c.skin;
    ctx.fillRect(cx-5, dy+1, 10, 9);
    // 頬の立体感
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(cx-5, dy+1, 2, 9);
    ctx.fillRect(cx+3, dy+1, 2, 9);

    // 髪
    ctx.fillStyle = c.hair;
    ctx.fillRect(cx-6, dy, 12, 4);
    ctx.fillRect(cx-7, dy+2, 3, 8);
    ctx.fillRect(cx+4, dy+2, 3, 8);

    // 目
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(cx-4, dy+5, 3, 3);
    ctx.fillRect(cx+1, dy+5, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx-3, dy+5, 1, 1);
    ctx.fillRect(cx+2, dy+5, 1, 1);
    // 眉
    ctx.fillStyle = c.hair;
    ctx.fillRect(cx-4, dy+4, 3, 1);
    ctx.fillRect(cx+1, dy+4, 3, 1);
    // 鼻
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(cx, dy+7, 1, 1);
  }

  _drawSatoshi(ctx, dx, dy, dir) {
    const cx = dx + 16;

    // 足元シャドウ
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(cx-9, dy+30, 18, 5);

    // ===== 輪郭シルエット（先に塗る） =====
    ctx.fillStyle = '#03030c';
    ctx.fillRect(cx-8, dy-1, 16, 13);   // 頭
    if (dir === 'up') {
      ctx.fillRect(cx-12, dy+10, 24, 13); // 体+リュック
    } else {
      ctx.fillRect(cx-12, dy+10, 24, 13); // 体+腕
    }
    ctx.fillRect(cx-9, dy+21, 18, 12);  // 足+靴

    // ===== 靴 =====
    ctx.fillStyle = '#161624';
    ctx.fillRect(cx-8, dy+28, 7, 5);
    ctx.fillRect(cx+1, dy+28, 7, 5);
    ctx.fillStyle = '#22223a';
    ctx.fillRect(cx-7, dy+28, 3, 1);
    ctx.fillRect(cx+2, dy+28, 3, 1);

    // ===== ズボン =====
    ctx.fillStyle = '#1a1e50';
    ctx.fillRect(cx-7, dy+22, 5, 8);
    ctx.fillRect(cx+2, dy+22, 5, 8);
    ctx.fillStyle = '#2a2e68';
    ctx.fillRect(cx-7, dy+22, 2, 7);
    ctx.fillRect(cx+2, dy+22, 2, 7);

    // ===== ベルト =====
    ctx.fillStyle = '#28160a';
    ctx.fillRect(cx-7, dy+21, 14, 2);
    ctx.fillStyle = '#c08828';
    ctx.fillRect(cx-2, dy+21, 4, 2);
    ctx.fillStyle = '#e8b040';
    ctx.fillRect(cx-1, dy+21, 2, 1);

    // ===== 体・腕 =====
    if (dir === 'up') {
      // リュック（背面）
      ctx.fillStyle = '#6a4418';
      ctx.fillRect(cx-11, dy+11, 6, 10);
      ctx.fillRect(cx+5, dy+11, 6, 10);
      ctx.fillStyle = '#8a5820';
      ctx.fillRect(cx-10, dy+12, 4, 8);
      ctx.fillRect(cx+6, dy+12, 4, 8);
      ctx.fillStyle = '#c08838';
      ctx.fillRect(cx-10, dy+12, 1, 8);
      ctx.fillRect(cx+6, dy+12, 1, 8);
      // リュックのバックル
      ctx.fillStyle = '#d4a040';
      ctx.fillRect(cx-8, dy+16, 2, 2);
      ctx.fillRect(cx+6, dy+16, 2, 2);
      // シャツ背面
      ctx.fillStyle = '#1c44bb';
      ctx.fillRect(cx-5, dy+11, 10, 11);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(cx-5, dy+11, 2, 11);
      ctx.fillRect(cx+3, dy+11, 2, 11);
    } else {
      // 腕（肌）
      ctx.fillStyle = '#f2c484';
      ctx.fillRect(cx-11, dy+12, 4, 9);
      ctx.fillRect(cx+7, dy+12, 4, 9);
      // 袖
      ctx.fillStyle = '#1c44bb';
      ctx.fillRect(cx-11, dy+11, 4, 5);
      ctx.fillRect(cx+7, dy+11, 4, 5);
      // 手
      ctx.fillStyle = '#e8b878';
      ctx.fillRect(cx-11, dy+20, 4, 3);
      ctx.fillRect(cx+7, dy+20, 4, 3);
      // 手の指先（少し暗め）
      ctx.fillStyle = '#d4a064';
      ctx.fillRect(cx-11, dy+22, 4, 1);
      ctx.fillRect(cx+7, dy+22, 4, 1);

      // シャツ正面
      ctx.fillStyle = '#1c44bb';
      ctx.fillRect(cx-5, dy+11, 10, 11);
      // 胴の陰影
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(cx-5, dy+11, 2, 11);
      ctx.fillRect(cx+3, dy+11, 2, 11);
      // シャツライン（スポーティ）
      ctx.fillStyle = '#3060dd';
      ctx.fillRect(cx-3, dy+13, 6, 1);
      ctx.fillRect(cx-3, dy+16, 6, 1);
    }

    // ===== 首 =====
    ctx.fillStyle = '#f2c484';
    ctx.fillRect(cx-2, dy+8, 4, 5);

    // ===== 頭（顔） =====
    ctx.fillStyle = '#f2c484';
    ctx.fillRect(cx-5, dy+1, 10, 9);
    // 頬の立体感（左右に影）
    ctx.fillStyle = '#e0ae70';
    ctx.fillRect(cx-5, dy+1, 2, 9);
    ctx.fillRect(cx+3, dy+1, 2, 9);
    // 頬の赤み
    ctx.fillStyle = 'rgba(220,100,80,0.22)';
    ctx.fillRect(cx-4, dy+6, 2, 2);
    ctx.fillRect(cx+2, dy+6, 2, 2);

    // ===== 髪 =====
    ctx.fillStyle = '#120e12';
    ctx.fillRect(cx-6, dy, 12, 4);      // 前髪
    ctx.fillRect(cx-7, dy+2, 3, 8);     // 左サイド
    ctx.fillRect(cx+4, dy+2, 3, 8);     // 右サイド
    ctx.fillRect(cx-6, dy+9, 2, 2);     // もみあげ
    ctx.fillRect(cx+4, dy+9, 2, 2);
    // 髪のハイライト
    ctx.fillStyle = '#28182a';
    ctx.fillRect(cx-1, dy, 5, 2);
    ctx.fillRect(cx-2, dy+1, 1, 1);

    // ===== 目・表情（方向別） =====
    if (dir !== 'up') {
      if (dir === 'left') {
        // 左向き（片目）
        ctx.fillStyle = '#100e30';
        ctx.fillRect(cx-5, dy+5, 3, 3);
        ctx.fillStyle = '#3848b8';
        ctx.fillRect(cx-5, dy+5, 3, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx-5, dy+5, 1, 1);
        ctx.fillStyle = '#7890e0';
        ctx.fillRect(cx-4, dy+6, 1, 1);
      } else if (dir === 'right') {
        // 右向き（片目）
        ctx.fillStyle = '#100e30';
        ctx.fillRect(cx+2, dy+5, 3, 3);
        ctx.fillStyle = '#3848b8';
        ctx.fillRect(cx+2, dy+5, 3, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx+4, dy+5, 1, 1);
        ctx.fillStyle = '#7890e0';
        ctx.fillRect(cx+2, dy+6, 1, 1);
      } else {
        // 正面（両目）
        ctx.fillStyle = '#100e30';
        ctx.fillRect(cx-4, dy+5, 3, 3);
        ctx.fillRect(cx+1, dy+5, 3, 3);
        ctx.fillStyle = '#3848b8';
        ctx.fillRect(cx-4, dy+5, 3, 2);
        ctx.fillRect(cx+1, dy+5, 3, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx-4, dy+5, 1, 1);
        ctx.fillRect(cx+3, dy+5, 1, 1);
        ctx.fillStyle = '#7890e0';
        ctx.fillRect(cx-3, dy+6, 1, 1);
        ctx.fillRect(cx+2, dy+6, 1, 1);
      }
      // 眉毛
      ctx.fillStyle = '#1a1218';
      if (dir === 'left')       ctx.fillRect(cx-5, dy+4, 3, 1);
      else if (dir === 'right') ctx.fillRect(cx+2, dy+4, 3, 1);
      else {
        ctx.fillRect(cx-4, dy+4, 3, 1);
        ctx.fillRect(cx+1, dy+4, 3, 1);
      }
      // 鼻
      ctx.fillStyle = '#c89060';
      ctx.fillRect(cx, dy+7, 1, 1);
      // 口（正面のみ）
      if (dir === 'down') {
        ctx.fillStyle = '#b07050';
        ctx.fillRect(cx-1, dy+8, 3, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(cx, dy+8, 1, 1);
      }
    }
  }

  _drawMofu(ctx, dx, dy) {
    const cx = dx + 16;

    // 足元シャドウ
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(cx-8, dy+28, 16, 4);

    // ===== 輪郭シルエット =====
    ctx.fillStyle = '#04040c';
    ctx.fillRect(cx-11, dy+1, 22, 13);  // 頭+耳
    ctx.fillRect(cx-10, dy+12, 20, 14); // 体
    ctx.fillRect(cx-9, dy+23, 18, 7);   // 足
    ctx.fillRect(cx+7, dy+13, 10, 10);  // 尻尾

    // ===== 足（前足） =====
    ctx.fillStyle = '#dedad2';
    ctx.fillRect(cx-8, dy+24, 5, 7);
    ctx.fillRect(cx+3, dy+24, 5, 7);
    // 肉球
    ctx.fillStyle = '#c4a0b0';
    ctx.fillRect(cx-8, dy+29, 5, 2);
    ctx.fillRect(cx+3, dy+29, 5, 2);
    ctx.fillStyle = '#d8b0c0';
    ctx.fillRect(cx-8, dy+29, 2, 1);
    ctx.fillRect(cx+3, dy+29, 2, 1);

    // ===== 体 =====
    ctx.fillStyle = '#f0ede0';
    ctx.fillRect(cx-9, dy+14, 18, 12);
    // 体の陰影
    ctx.fillStyle = '#d0ccc0';
    ctx.fillRect(cx+7, dy+14, 2, 12);
    ctx.fillRect(cx-9, dy+23, 18, 3);
    // お腹の明るい部分
    ctx.fillStyle = '#f8f5ec';
    ctx.fillRect(cx-5, dy+16, 10, 6);

    // ===== 尻尾（ふわふわ円形） =====
    ctx.fillStyle = '#f0ede0';
    ctx.fillRect(cx+7, dy+14, 8, 8);
    ctx.fillRect(cx+8, dy+13, 6, 2);
    ctx.fillRect(cx+8, dy+22, 6, 2);
    ctx.fillStyle = '#d0ccc0';
    ctx.fillRect(cx+13, dy+14, 2, 8);
    ctx.fillStyle = '#f8f5ec';
    ctx.fillRect(cx+8, dy+16, 4, 4);

    // ===== 頭 =====
    ctx.fillStyle = '#f0ede0';
    ctx.fillRect(cx-7, dy+4, 14, 12);
    // 頭の丸み（角を少し削る）
    ctx.fillStyle = '#04040c';
    ctx.fillRect(cx-7, dy+4, 1, 1);
    ctx.fillRect(cx+6, dy+4, 1, 1);
    ctx.fillRect(cx-7, dy+15, 1, 1);
    ctx.fillRect(cx+6, dy+15, 1, 1);
    // 頭の陰影
    ctx.fillStyle = '#d0ccc0';
    ctx.fillRect(cx+5, dy+4, 2, 12);
    ctx.fillRect(cx-7, dy+14, 14, 2);
    // 頭の明るい部分
    ctx.fillStyle = '#f8f5ec';
    ctx.fillRect(cx-4, dy+5, 8, 6);

    // ===== 耳（垂れ耳） =====
    ctx.fillStyle = '#e6e2d6';
    ctx.fillRect(cx-11, dy+2, 6, 12);
    ctx.fillRect(cx+5, dy+2, 6, 12);
    // 耳先の丸み
    ctx.fillStyle = '#04040c';
    ctx.fillRect(cx-11, dy+2, 1, 1);
    ctx.fillRect(cx+10, dy+2, 1, 1);
    // 耳の内側（ピンク）
    ctx.fillStyle = '#e898aa';
    ctx.fillRect(cx-10, dy+3, 4, 8);
    ctx.fillRect(cx+6, dy+3, 4, 8);
    ctx.fillStyle = '#f0b0c0';
    ctx.fillRect(cx-9, dy+4, 2, 5);
    ctx.fillRect(cx+7, dy+4, 2, 5);
    // 耳の縁陰影
    ctx.fillStyle = '#c0bcb0';
    ctx.fillRect(cx-11, dy+12, 6, 2);
    ctx.fillRect(cx+5, dy+12, 6, 2);

    // ===== 目（大きく可愛く） =====
    // 目の白目
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx-5, dy+7, 4, 4);
    ctx.fillRect(cx+1, dy+7, 4, 4);
    // 瞳
    ctx.fillStyle = '#100818';
    ctx.fillRect(cx-4, dy+8, 3, 3);
    ctx.fillRect(cx+1, dy+8, 3, 3);
    // 虹彩（茶色）
    ctx.fillStyle = '#602010';
    ctx.fillRect(cx-4, dy+8, 2, 2);
    ctx.fillRect(cx+2, dy+8, 2, 2);
    // 目の光（大きめ）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx-4, dy+8, 2, 2);
    ctx.fillRect(cx+2, dy+8, 2, 2);
    // 目の光（小）
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(cx-3, dy+10, 1, 1);
    ctx.fillRect(cx+3, dy+10, 1, 1);

    // ===== 鼻（ハート型風） =====
    ctx.fillStyle = '#c06080';
    ctx.fillRect(cx-2, dy+12, 4, 2);
    ctx.fillRect(cx-1, dy+11, 2, 1);
    ctx.fillStyle = '#e080a0';
    ctx.fillRect(cx-2, dy+12, 1, 1);
    ctx.fillRect(cx+1, dy+12, 1, 1);

    // ===== 口 =====
    ctx.fillStyle = '#905060';
    ctx.fillRect(cx-1, dy+14, 1, 1);
    ctx.fillRect(cx+0, dy+14, 1, 1);
    // ひげ（ウィスカー）
    ctx.fillStyle = 'rgba(200,190,180,0.8)';
    ctx.fillRect(cx-11, dy+12, 4, 1);
    ctx.fillRect(cx+7, dy+12, 4, 1);
    ctx.fillRect(cx-11, dy+13, 3, 1);
    ctx.fillRect(cx+8, dy+13, 3, 1);
  }
}
