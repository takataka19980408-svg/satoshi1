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

  render(ctx, npcs = [], playerSprite = null, follower = null) {
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

    // 追従キャラ描画（リル）
    if (follower) {
      const fdx = follower.px - this.camX;
      const fdy = TILE_Y0 + follower.py - this.camY;
      this._drawNpc(ctx, { sprite: 'ril', dir: follower.dir }, fdx, fdy);
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
      case 1: { // 草 — 鮮やか草むら
        const blades = [[3,20],[7,10],[12,26],[17,15],[23,8],[27,20],[5,4],[21,28],[9,18],[15,6],[29,12]];
        for (const [bx, by] of blades) {
          const h = 5 + (bx % 3);
          ctx.fillStyle = '#2aaa16';
          ctx.fillRect(dx+bx, dy+by, 2, h);
          ctx.fillStyle = '#46dd28';
          ctx.fillRect(dx+bx, dy+by, 2, 2);
        }
        ctx.fillStyle = '#183808';
        ctx.fillRect(dx, dy, TS, 1);
        ctx.fillRect(dx, dy, 1, TS);
        break;
      }
      case 2: { // 道 — 温かみのある砂利
        const pebbles = [[3,5],[9,17],[17,9],[23,21],[5,25],[13,3],[27,14],[7,29],[20,27]];
        for (const [px, py] of pebbles) {
          ctx.fillStyle = '#c09a30';
          ctx.fillRect(dx+px, dy+py, 3, 2);
          ctx.fillStyle = '#e0b840';
          ctx.fillRect(dx+px, dy+py, 2, 1);
        }
        ctx.fillStyle = '#805010';
        ctx.fillRect(dx+8, dy, 2, TS);
        ctx.fillRect(dx+22, dy, 2, TS);
        break;
      }
      case 4: { // 木タイル
        ctx.fillStyle = '#1e4810';
        ctx.fillRect(dx+4, dy+4, TS-8, TS-8);
        ctx.fillStyle = '#153808';
        ctx.fillRect(dx+8, dy+8, TS-16, TS-16);
        ctx.fillStyle = '#30641c';
        ctx.fillRect(dx+6, dy+4, 4, 4);
        break;
      }
      case 5: { // 石壁 — ブロック模様
        ctx.fillStyle = '#362248';
        ctx.fillRect(dx, dy, TS, 2);
        ctx.fillRect(dx, dy+16, TS, 2);
        ctx.fillRect(dx+16, dy+2, 2, 14);
        ctx.fillRect(dx+8, dy+18, 2, 14);
        ctx.fillStyle = '#201224';
        ctx.fillRect(dx, dy+14, TS, 2);
        break;
      }
      case 6: { // 木の床 — 温かみのある板目
        ctx.fillStyle = '#8a5838';
        ctx.fillRect(dx, dy, TS, 2);
        ctx.fillRect(dx, dy+10, TS, 1);
        ctx.fillRect(dx, dy+21, TS, 2);
        ctx.fillRect(dx+11, dy, 1, 10);
        ctx.fillRect(dx+22, dy+11, 1, 11);
        ctx.fillStyle = '#b07848';
        ctx.fillRect(dx+1, dy+1, 9, 1);
        ctx.fillRect(dx+13, dy+11, 8, 1);
        break;
      }
      case 8: { // 森の地面 — 暗く神秘的
        const marks = [[4,8],[12,22],[20,6],[26,18],[8,28],[22,28],[14,14]];
        for (const [mx2, my2] of marks) {
          ctx.fillStyle = '#162610';
          ctx.fillRect(dx+mx2, dy+my2, 4, 2);
          ctx.fillStyle = '#1e3018';
          ctx.fillRect(dx+mx2, dy+my2, 2, 1);
        }
        ctx.fillStyle = 'rgba(60,120,20,0.12)';
        ctx.fillRect(dx+6, dy+6, 3, 3);
        ctx.fillRect(dx+22, dy+20, 4, 2);
        ctx.fillStyle = '#0a1206';
        ctx.fillRect(dx, dy, TS, 1);
        ctx.fillRect(dx, dy, 1, TS);
        break;
      }
      case 12: { // 井戸
        ctx.fillStyle = '#585878';
        ctx.fillRect(dx+6, dy+8, TS-12, TS-12);
        ctx.fillStyle = '#0e0e26';
        ctx.fillRect(dx+10, dy+12, TS-20, TS-18);
        ctx.fillStyle = '#8a6438';
        ctx.fillRect(dx+4, dy+6, TS-8, 4);
        ctx.fillStyle = '#62481e';
        ctx.fillRect(dx+4, dy+2, 4, 6);
        ctx.fillRect(dx+24, dy+2, 4, 6);
        ctx.fillRect(dx+4, dy+2, TS-8, 2);
        ctx.fillStyle = 'rgba(80,120,200,0.25)';
        ctx.fillRect(dx+10, dy+16, TS-20, TS-22);
        break;
      }
      case 13: { // ドア
        ctx.fillStyle = '#9a6838';
        ctx.fillRect(dx+5, dy+4, TS-10, TS-6);
        ctx.fillStyle = '#7a4e28';
        ctx.fillRect(dx+5, dy+12, TS-10, 1);
        ctx.fillRect(dx+5, dy+20, TS-10, 1);
        ctx.fillStyle = '#d09020';
        ctx.fillRect(dx+19, dy+14, 5, 5);
        ctx.fillStyle = '#f0c040';
        ctx.fillRect(dx+20, dy+15, 3, 3);
        break;
      }
    }
  }

  _drawObject(ctx, id, dx, dy) {
    const TS = TILE_SIZE;
    switch (id) {
      case 1: { // 木 — より鮮やかな多段グリーン
        ctx.fillStyle = '#3a2008';
        ctx.fillRect(dx+13, dy+20, 6, 12);
        ctx.fillStyle = '#5e3812';
        ctx.fillRect(dx+13, dy+20, 3, 12);
        ctx.fillStyle = '#9a6020';
        ctx.fillRect(dx+14, dy+20, 1, 12);
        // 葉（外層 - 暗め）
        ctx.fillStyle = '#195010';
        ctx.fillRect(dx+2, dy+2, TS-4, 22);
        // 葉（中層 - メイン）
        ctx.fillStyle = '#2a9018';
        ctx.fillRect(dx+4, dy+0, TS-8, 20);
        // 葉（内層 - 明るい）
        ctx.fillStyle = '#3dbb20';
        ctx.fillRect(dx+7, dy+0, TS-14, 16);
        // ハイライト
        ctx.fillStyle = '#58dd30';
        ctx.fillRect(dx+9, dy+0, 8, 5);
        ctx.fillRect(dx+15, dy+4, 4, 3);
        // 輝き
        ctx.fillStyle = '#78f048';
        ctx.fillRect(dx+10, dy+1, 4, 2);
        // 縁陰影
        ctx.fillStyle = '#102808';
        ctx.fillRect(dx+2, dy+20, TS-4, 2);
        break;
      }
      case 2: { // 家（壁）
        ctx.fillStyle = '#7a6050';
        ctx.fillRect(dx, dy, TS, TS);
        ctx.fillStyle = '#4e3c30';
        ctx.fillRect(dx, dy+8, TS, 1);
        ctx.fillRect(dx, dy+16, TS, 1);
        ctx.fillRect(dx, dy+24, TS, 1);
        ctx.fillRect(dx+16, dy, 1, 8);
        ctx.fillRect(dx+8, dy+8, 1, 8);
        ctx.fillRect(dx+20, dy+16, 1, 8);
        ctx.fillStyle = '#1a2e60';
        ctx.fillRect(dx+4, dy+4, 10, 8);
        ctx.fillStyle = '#2a4a98';
        ctx.fillRect(dx+5, dy+5, 4, 3);
        ctx.fillRect(dx+9, dy+5, 4, 3);
        ctx.fillStyle = 'rgba(180,220,255,0.22)';
        ctx.fillRect(dx+5, dy+5, 2, 3);
        break;
      }
      case 3: { // 家（屋根）
        ctx.fillStyle = '#8a2820';
        ctx.fillRect(dx, dy, TS, TS);
        ctx.fillStyle = '#aa3e34';
        ctx.fillRect(dx+4, dy+4, TS-8, TS-8);
        ctx.fillStyle = '#6a1a14';
        ctx.fillRect(dx, dy+8, TS, 1);
        ctx.fillRect(dx, dy+16, TS, 1);
        ctx.fillRect(dx, dy+24, TS, 1);
        ctx.fillStyle = '#c05048';
        ctx.fillRect(dx+4, dy+4, 7, 2);
        break;
      }
      case 4: { // 光る石 — ドラマチックな多重グロー
        const t = Date.now() / 400;
        const glow1 = 0.20 + 0.14 * Math.sin(t);
        const glow2 = 0.11 + 0.09 * Math.sin(t + 0.9);
        const glow3 = 0.06 + 0.05 * Math.sin(t + 1.8);
        // 最外グロー
        ctx.globalAlpha = glow3;
        ctx.fillStyle = '#78beff';
        ctx.fillRect(dx, dy+2, 32, 26);
        // 中間グロー
        ctx.globalAlpha = glow2;
        ctx.fillStyle = '#9ad4ff';
        ctx.fillRect(dx+3, dy+5, 26, 22);
        // 内グロー
        ctx.globalAlpha = glow1;
        ctx.fillStyle = '#c0ecff';
        ctx.fillRect(dx+7, dy+8, 18, 16);
        ctx.globalAlpha = 1;
        // 台座
        ctx.fillStyle = '#1e2c4a';
        ctx.fillRect(dx+8, dy+20, 16, 8);
        ctx.fillStyle = '#162036';
        ctx.fillRect(dx+10, dy+24, 12, 4);
        // 石本体
        ctx.fillStyle = '#183880';
        ctx.fillRect(dx+10, dy+14, 12, 10);
        ctx.fillStyle = '#2c5cb0';
        ctx.fillRect(dx+12, dy+12, 8, 8);
        ctx.fillStyle = '#4888e0';
        ctx.fillRect(dx+14, dy+10, 4, 6);
        // コア発光
        const core = 0.75 + 0.25 * Math.sin(t * 1.8);
        ctx.fillStyle = `rgba(150,215,255,${core})`;
        ctx.fillRect(dx+13, dy+10, 6, 5);
        ctx.fillStyle = `rgba(220,242,255,${core})`;
        ctx.fillRect(dx+14, dy+10, 4, 3);
        // 最明部
        ctx.fillStyle = '#f0faff';
        ctx.fillRect(dx+15, dy+10, 2, 2);
        break;
      }
      case 5: { // 棚・家具
        ctx.fillStyle = '#9a6438';
        ctx.fillRect(dx+2, dy+4, TS-4, TS-6);
        ctx.fillStyle = '#724a24';
        ctx.fillRect(dx+2, dy+4, TS-4, 2);
        ctx.fillRect(dx+2, dy+14, TS-4, 2);
        ctx.fillRect(dx+2, dy+24, TS-4, 2);
        ctx.fillStyle = '#c09840';
        ctx.fillRect(dx+4, dy+6, 5, 7);
        ctx.fillStyle = '#e8b850';
        ctx.fillRect(dx+5, dy+7, 3, 5);
        ctx.fillStyle = '#4a2810';
        ctx.fillRect(dx+28, dy+4, 4, TS-6);
        break;
      }
      case 6: { // ベッド
        ctx.fillStyle = '#5a3070';
        ctx.fillRect(dx+2, dy+2, TS-4, TS-4);
        ctx.fillStyle = '#8060b0';
        ctx.fillRect(dx+4, dy+4, TS-8, 10);
        ctx.fillStyle = '#c0a0e0';
        ctx.fillRect(dx+5, dy+5, TS-12, 6);
        ctx.fillStyle = '#f0ecdc';
        ctx.fillRect(dx+4, dy+14, TS-8, 14);
        ctx.fillStyle = '#d4ccbc';
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
      elder:      { body: '#8a6020', trim: '#ccaa30', hair: '#e0e0d0', skin: '#e8b878', pants: '#402a10' },
      mom:        { body: '#e05888', trim: '#ff99cc', hair: '#2a1008', skin: '#f8d090', pants: '#3c1848' },
      villager_a: { body: '#3868a0', trim: '#60a8d8', hair: '#200e04', skin: '#f0c080', pants: '#1c2c4a' },
      villager_b: { body: '#903a68', trim: '#c06898', hair: '#180404', skin: '#f0c080', pants: '#301840' },
      villager_c: { body: '#389840', trim: '#55c060', hair: '#1a1008', skin: '#f8d090', pants: '#1e4020' },
      ril:        { body: '#5880d8', trim: '#90b8ff', hair: '#f0e040', skin: '#f8d898', pants: '#1c1c48' },
    };
    const c = palette[npc.sprite] || { body: '#505058', trim: '#707078', hair: '#282828', skin: '#e8b870', pants: '#202030' };

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
    ctx.fillStyle = '#283050';
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
    ctx.fillStyle = '#1a1630';
    ctx.fillRect(cx+4, dy+11, 2, 12);
    ctx.fillRect(cx-6, dy+11, 2, 12);

    if (npc.dir === 'up') {
      // 後ろ向き — 後頭部と髪のみ
      ctx.fillStyle = c.hair;
      ctx.fillRect(cx-6, dy, 12, 11);
      ctx.fillRect(cx-7, dy+2, 3, 8);
      ctx.fillRect(cx+4, dy+2, 3, 8);
    } else {
      // 首
      ctx.fillStyle = c.skin;
      ctx.fillRect(cx-2, dy+8, 4, 5);

      // 頭（顔）
      ctx.fillStyle = c.skin;
      ctx.fillRect(cx-5, dy+1, 10, 9);
      ctx.fillStyle = '#d49060';
      ctx.fillRect(cx-5, dy+1, 2, 9);
      ctx.fillRect(cx+3, dy+1, 2, 9);

      // 髪
      ctx.fillStyle = c.hair;
      ctx.fillRect(cx-6, dy, 12, 4);
      ctx.fillRect(cx-7, dy+2, 3, 8);
      ctx.fillRect(cx+4, dy+2, 3, 8);

      // 目（大きく、白目あり）
      ctx.fillStyle = '#080616';
      ctx.fillRect(cx-4, dy+4, 3, 4);
      ctx.fillRect(cx+1, dy+4, 3, 4);
      ctx.fillStyle = '#1a1830';
      ctx.fillRect(cx-4, dy+4, 3, 3);
      ctx.fillRect(cx+1, dy+4, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx-4, dy+7, 3, 1);
      ctx.fillRect(cx+1, dy+7, 3, 1);
      ctx.fillRect(cx-4, dy+4, 1, 1);
      ctx.fillRect(cx+3, dy+4, 1, 1);
      ctx.fillStyle = c.hair;
      ctx.fillRect(cx-4, dy+3, 3, 1);
      ctx.fillRect(cx+1, dy+3, 3, 1);
      ctx.fillStyle = '#b08050';
      ctx.fillRect(cx, dy+7, 1, 1);
    }
  }

  _drawSatoshi(ctx, dx, dy, dir) {
    const cx = dx + 16;

    // ===== 輪郭シルエット =====
    ctx.fillStyle = '#02020a';
    ctx.fillRect(cx-9, dy-2, 18, 15);   // 頭（やや大きく）
    ctx.fillRect(cx-12, dy+10, 24, 14); // 体+腕
    ctx.fillRect(cx-9,  dy+22, 18, 12); // 足+靴

    // ===== 靴 =====
    ctx.fillStyle = '#14142a';
    ctx.fillRect(cx-8, dy+28, 7, 5);
    ctx.fillRect(cx+1, dy+28, 7, 5);
    ctx.fillStyle = '#22223c';
    ctx.fillRect(cx-7, dy+28, 4, 1);
    ctx.fillRect(cx+2, dy+28, 4, 1);

    // ===== ズボン =====
    ctx.fillStyle = '#181c52';
    ctx.fillRect(cx-7, dy+22, 5, 8);
    ctx.fillRect(cx+2, dy+22, 5, 8);
    ctx.fillStyle = '#2a306a';
    ctx.fillRect(cx-7, dy+22, 2, 7);
    ctx.fillRect(cx+2, dy+22, 2, 7);

    // ===== ベルト =====
    ctx.fillStyle = '#261408';
    ctx.fillRect(cx-7, dy+21, 14, 2);
    ctx.fillStyle = '#c89030';
    ctx.fillRect(cx-2, dy+21, 4, 2);
    ctx.fillStyle = '#f0c040';
    ctx.fillRect(cx-1, dy+21, 2, 1);

    // ===== 体・腕 =====
    if (dir === 'up') {
      ctx.fillStyle = '#6a4418';
      ctx.fillRect(cx-11, dy+11, 6, 10);
      ctx.fillRect(cx+5, dy+11, 6, 10);
      ctx.fillStyle = '#8a5820';
      ctx.fillRect(cx-10, dy+12, 4, 8);
      ctx.fillRect(cx+6, dy+12, 4, 8);
      ctx.fillStyle = '#c09040';
      ctx.fillRect(cx-10, dy+12, 1, 8);
      ctx.fillRect(cx+6, dy+12, 1, 8);
      ctx.fillStyle = '#d4a840';
      ctx.fillRect(cx-8, dy+16, 2, 2);
      ctx.fillRect(cx+6, dy+16, 2, 2);
      ctx.fillStyle = '#1e50e8';
      ctx.fillRect(cx-5, dy+11, 10, 11);
      ctx.fillStyle = '#1438b0';
      ctx.fillRect(cx-5, dy+11, 2, 11);
      ctx.fillRect(cx+3, dy+11, 2, 11);
    } else {
      ctx.fillStyle = '#f5c888';
      ctx.fillRect(cx-11, dy+12, 4, 9);
      ctx.fillRect(cx+7, dy+12, 4, 9);
      ctx.fillStyle = '#1e50e8';
      ctx.fillRect(cx-11, dy+11, 4, 5);
      ctx.fillRect(cx+7, dy+11, 4, 5);
      ctx.fillStyle = '#f0bc7c';
      ctx.fillRect(cx-11, dy+20, 4, 3);
      ctx.fillRect(cx+7, dy+20, 4, 3);
      ctx.fillStyle = '#d8a46a';
      ctx.fillRect(cx-11, dy+22, 4, 1);
      ctx.fillRect(cx+7, dy+22, 4, 1);
      ctx.fillStyle = '#1e50e8';
      ctx.fillRect(cx-5, dy+11, 10, 11);
      ctx.fillStyle = '#1438b0';
      ctx.fillRect(cx-5, dy+11, 2, 11);
      ctx.fillRect(cx+3, dy+11, 2, 11);
      ctx.fillStyle = '#4070ff';
      ctx.fillRect(cx-3, dy+13, 6, 1);
      ctx.fillRect(cx-3, dy+16, 6, 1);
    }

    // ===== 首 =====
    ctx.fillStyle = '#f5c888';
    ctx.fillRect(cx-2, dy+8, 4, 5);

    // ===== 頭（顔）=====
    if (dir === 'up') {
      // 後ろ向き — 後頭部（髪色）
      ctx.fillStyle = '#0e0a14';
      ctx.fillRect(cx-6, dy, 12, 11);
      ctx.fillStyle = '#1a1226';
      ctx.fillRect(cx-4, dy+2, 8, 6);
    } else {
      ctx.fillStyle = '#f5c888';
      ctx.fillRect(cx-6, dy, 12, 11);
      ctx.fillStyle = '#02020a';
      ctx.fillRect(cx-6, dy, 1, 1);
      ctx.fillRect(cx+5, dy, 1, 1);
      ctx.fillStyle = '#dba870';
      ctx.fillRect(cx-6, dy, 2, 11);
      ctx.fillRect(cx+4, dy, 2, 11);
      ctx.fillStyle = '#d85040';
      ctx.fillRect(cx-5, dy+6, 3, 3);
      ctx.fillRect(cx+2, dy+6, 3, 3);
    }

    // ===== 髪 =====
    ctx.fillStyle = '#0e0a14';
    ctx.fillRect(cx-7, dy-1, 14, 4);
    ctx.fillRect(cx-8, dy+1, 3, 10);
    ctx.fillRect(cx+5, dy+1, 3, 10);
    ctx.fillRect(cx-6, dy+10, 2, 2);
    ctx.fillRect(cx+4, dy+10, 2, 2);
    ctx.fillStyle = '#261a2e';
    ctx.fillRect(cx, dy-1, 5, 2);
    ctx.fillRect(cx-1, dy, 1, 1);

    // ===== 帽子（赤キャップ）=====
    ctx.fillStyle = '#c01818';
    ctx.fillRect(cx-6, dy-7, 13, 7);
    ctx.fillStyle = '#e02020';
    ctx.fillRect(cx-5, dy-7, 11, 5);
    ctx.fillStyle = '#901010';
    ctx.fillRect(cx-6, dy-2, 13, 1);
    if (dir === 'up') {
      ctx.fillStyle = '#901010';
      ctx.fillRect(cx-5, dy-8, 11, 2);
    } else {
      ctx.fillStyle = '#c01818';
      ctx.fillRect(cx-8, dy-1, 18, 3);
      ctx.fillStyle = '#901010';
      ctx.fillRect(cx-8, dy+1, 18, 1);
    }
    ctx.fillStyle = '#780c0c';
    ctx.fillRect(cx-1, dy-8, 2, 1);

    // ===== 目・表情（方向別）— 大きくてかわいい =====
    if (dir !== 'up') {
      if (dir === 'left') {
        // 左向き（片目、4×4）
        ctx.fillStyle = '#080620';
        ctx.fillRect(cx-6, dy+3, 4, 4);
        ctx.fillStyle = '#1e44cc';
        ctx.fillRect(cx-5, dy+3, 3, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx-6, dy+3, 2, 2);
        ctx.fillStyle = '#5577ee';
        ctx.fillRect(cx-4, dy+5, 1, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx-6, dy+6, 4, 1);  // 白目（下）
      } else if (dir === 'right') {
        // 右向き（片目、4×4）
        ctx.fillStyle = '#080620';
        ctx.fillRect(cx+2, dy+3, 4, 4);
        ctx.fillStyle = '#1e44cc';
        ctx.fillRect(cx+2, dy+3, 3, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx+2, dy+3, 2, 2);
        ctx.fillStyle = '#5577ee';
        ctx.fillRect(cx+4, dy+5, 1, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx+2, dy+6, 4, 1);
      } else {
        // 正面（両目、各4×4）
        ctx.fillStyle = '#080620';
        ctx.fillRect(cx-5, dy+3, 4, 4);
        ctx.fillRect(cx+1, dy+3, 4, 4);
        ctx.fillStyle = '#1e44cc';
        ctx.fillRect(cx-4, dy+3, 3, 3);
        ctx.fillRect(cx+2, dy+3, 3, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx-5, dy+3, 2, 2);  // 左目ハイライト
        ctx.fillRect(cx+1, dy+3, 2, 2);  // 右目ハイライト
        ctx.fillStyle = '#5577ee';
        ctx.fillRect(cx-3, dy+5, 1, 1);
        ctx.fillRect(cx+4, dy+5, 1, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx-5, dy+6, 4, 1);  // 白目（下）
        ctx.fillRect(cx+1, dy+6, 4, 1);
      }
      // 眉毛
      ctx.fillStyle = '#160e1c';
      if (dir === 'left')       ctx.fillRect(cx-6, dy+2, 4, 1);
      else if (dir === 'right') ctx.fillRect(cx+2, dy+2, 4, 1);
      else {
        ctx.fillRect(cx-5, dy+2, 4, 1);
        ctx.fillRect(cx+1, dy+2, 4, 1);
      }
      // 鼻
      ctx.fillStyle = '#c89060';
      ctx.fillRect(cx, dy+7, 1, 1);
      // 口（正面のみ）
      if (dir === 'down') {
        ctx.fillStyle = '#c07860';
        ctx.fillRect(cx-1, dy+9, 3, 1);
      }
    }
  }

  _drawMofu(ctx, dx, dy) {
    const cx = dx + 16;

    // ===== 輪郭シルエット =====
    ctx.fillStyle = '#03030a';
    ctx.fillRect(cx-11, dy+1, 22, 13);
    ctx.fillRect(cx-10, dy+12, 20, 14);
    ctx.fillRect(cx-9,  dy+23, 18, 7);
    ctx.fillRect(cx+7,  dy+13, 10, 10);

    // ===== 足（前足） =====
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(cx-8, dy+24, 5, 7);
    ctx.fillRect(cx+3, dy+24, 5, 7);
    ctx.fillStyle = '#d0a8b8';
    ctx.fillRect(cx-8, dy+29, 5, 2);
    ctx.fillRect(cx+3, dy+29, 5, 2);
    ctx.fillStyle = '#e8bece';
    ctx.fillRect(cx-8, dy+29, 2, 1);
    ctx.fillRect(cx+3, dy+29, 2, 1);

    // ===== 体 =====
    ctx.fillStyle = '#f5f2e8';
    ctx.fillRect(cx-9, dy+14, 18, 12);
    ctx.fillStyle = '#d8d4c8';
    ctx.fillRect(cx+7, dy+14, 2, 12);
    ctx.fillRect(cx-9, dy+23, 18, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx-5, dy+16, 10, 6);

    // ===== 尻尾（ふわふわ） =====
    ctx.fillStyle = '#f5f2e8';
    ctx.fillRect(cx+7, dy+14, 8, 8);
    ctx.fillRect(cx+8, dy+13, 6, 2);
    ctx.fillRect(cx+8, dy+22, 6, 2);
    ctx.fillStyle = '#d8d4c8';
    ctx.fillRect(cx+13, dy+14, 2, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx+8, dy+16, 4, 4);

    // ===== 頭 =====
    ctx.fillStyle = '#f5f2e8';
    ctx.fillRect(cx-7, dy+4, 14, 12);
    ctx.fillStyle = '#03030a';
    ctx.fillRect(cx-7, dy+4, 1, 1);
    ctx.fillRect(cx+6, dy+4, 1, 1);
    ctx.fillRect(cx-7, dy+15, 1, 1);
    ctx.fillRect(cx+6, dy+15, 1, 1);
    ctx.fillStyle = '#d8d4c8';
    ctx.fillRect(cx+5, dy+4, 2, 12);
    ctx.fillRect(cx-7, dy+14, 14, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx-4, dy+5, 8, 5);

    // ===== 耳（垂れ耳） =====
    ctx.fillStyle = '#eae6da';
    ctx.fillRect(cx-11, dy+2, 6, 12);
    ctx.fillRect(cx+5,  dy+2, 6, 12);
    ctx.fillStyle = '#03030a';
    ctx.fillRect(cx-11, dy+2, 1, 1);
    ctx.fillRect(cx+10, dy+2, 1, 1);
    // 耳内側（明るいピンク）
    ctx.fillStyle = '#ff90bb';
    ctx.fillRect(cx-10, dy+3, 4, 8);
    ctx.fillRect(cx+6,  dy+3, 4, 8);
    ctx.fillStyle = '#ffb8d0';
    ctx.fillRect(cx-9,  dy+4, 2, 5);
    ctx.fillRect(cx+7,  dy+4, 2, 5);
    ctx.fillStyle = '#c8c4b8';
    ctx.fillRect(cx-11, dy+12, 6, 2);
    ctx.fillRect(cx+5,  dy+12, 6, 2);

    // ===== 目（超大きくアニメ猫風） =====
    // 白目（大）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx-6, dy+5, 5, 7);  // 左目白目（5×7）
    ctx.fillRect(cx+1, dy+5, 5, 7);  // 右目白目（5×7）
    // 虹彩（紫がかった琥珀色）
    ctx.fillStyle = '#060412';
    ctx.fillRect(cx-6, dy+5, 5, 6);  // 左虹彩（白目の上6行）
    ctx.fillRect(cx+1, dy+5, 5, 6);
    ctx.fillStyle = '#8844aa';
    ctx.fillRect(cx-5, dy+5, 4, 5);
    ctx.fillRect(cx+2, dy+5, 4, 5);
    // 瞳（縦長）
    ctx.fillStyle = '#050310';
    ctx.fillRect(cx-4, dy+5, 2, 5);
    ctx.fillRect(cx+3, dy+5, 2, 5);
    // 大ハイライト（上左）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx-6, dy+5, 3, 3);  // 左目 大ハイライト
    ctx.fillRect(cx+1, dy+5, 3, 3);  // 右目 大ハイライト
    // 小ハイライト（下右）
    ctx.fillStyle = '#c8e8c0';
    ctx.fillRect(cx-3, dy+9, 1, 1);
    ctx.fillRect(cx+5, dy+9, 1, 1);

    // ===== 鼻（ハート型） =====
    ctx.fillStyle = '#e85090';
    ctx.fillRect(cx-2, dy+12, 4, 2);
    ctx.fillRect(cx-1, dy+11, 2, 1);
    ctx.fillStyle = '#ff80b8';
    ctx.fillRect(cx-2, dy+12, 1, 1);
    ctx.fillRect(cx+1, dy+12, 1, 1);

    // ===== 口 =====
    ctx.fillStyle = '#a05870';
    ctx.fillRect(cx-1, dy+14, 1, 1);
    ctx.fillRect(cx+0, dy+14, 1, 1);
    // ひげ
    ctx.fillStyle = '#c8c0b4';
    ctx.fillRect(cx-11, dy+11, 4, 1);
    ctx.fillRect(cx+7,  dy+11, 4, 1);
    ctx.fillRect(cx-11, dy+12, 3, 1);
    ctx.fillRect(cx+8,  dy+12, 3, 1);
  }

  renderEventIcons(ctx, flags, time) {
    if (!this.mapData?.posEvents) return;
    const bob = Math.sin(time * 3.2) * 3;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TILE_Y0, CANVAS_W, TILE_H);
    ctx.clip();

    const seen = new Set();
    for (const ev of this.mapData.posEvents) {
      if (flags[ev.flag]) continue;
      const key = `${ev.x},${ev.y}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const dx = ev.x * TILE_SIZE - this.camX;
      const dy = TILE_Y0 + ev.y * TILE_SIZE - this.camY;
      if (dx < -TILE_SIZE || dx > CANVAS_W || dy < TILE_Y0 - TILE_SIZE || dy > TILE_Y0 + TILE_H) continue;

      const cx = Math.round(dx + TILE_SIZE / 2);
      const cy = Math.round(dy - 6 + bob);

      ctx.globalAlpha = 1;
      switch (ev.iconType) {
        case 'mofu':   this._drawIconMofu(ctx, cx, cy);   break;
        case 'puni':   this._drawIconPuni(ctx, cx, cy);   break;
        case 'stairs': this._drawIconStairs(ctx, cx, cy); break;
        default:       this._drawIconExclaim(ctx, cx, cy); break;
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawIconExclaim(ctx, cx, cy) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx, cy + 1, 8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#ffe033';
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b87800'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3a2800';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', cx, cy + 0.5);
    ctx.textBaseline = 'alphabetic';
  }

  _drawIconStairs(ctx, cx, cy) {
    // 影
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 8, cy + 5, 16, 3);
    ctx.globalAlpha = 1;

    const L = '#d4c494'; // 踏み面（明）
    const D = '#8a7044'; // 蹴上げ（暗）
    const S = '#5a4828'; // 影エッジ

    // 踏み面（上から薄くハイライト）
    // 上段
    ctx.fillStyle = L;
    ctx.fillRect(cx - 7, cy - 6, 6, 3);
    ctx.fillStyle = '#e8d8a8';
    ctx.fillRect(cx - 7, cy - 6, 6, 1); // 上エッジ

    // 中段
    ctx.fillStyle = L;
    ctx.fillRect(cx - 7, cy - 1, 10, 3);
    ctx.fillStyle = '#e8d8a8';
    ctx.fillRect(cx - 7, cy - 1, 10, 1);

    // 下段
    ctx.fillStyle = L;
    ctx.fillRect(cx - 7, cy + 4, 14, 3);
    ctx.fillStyle = '#e8d8a8';
    ctx.fillRect(cx - 7, cy + 4, 14, 1);

    // 蹴上げ（縦面）
    ctx.fillStyle = D;
    ctx.fillRect(cx - 7, cy - 3, 6, 2);  // 上段の蹴上げ
    ctx.fillRect(cx - 7, cy + 2, 10, 2); // 中段の蹴上げ

    // 段差エッジ（右側の縦ライン）
    ctx.fillStyle = S;
    ctx.fillRect(cx - 1, cy - 6, 1, 5);  // 上段→中段 エッジ
    ctx.fillRect(cx + 3, cy - 1, 1, 5);  // 中段→下段 エッジ
  }

  _drawIconMofu(ctx, cx, cy) {
    // 小さいモフ（約16×18px）を canvas scaling で描画
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.53, 0.53);
    // _drawMofu は (dx, dy) = top-left origin、視覚中心は (dx+16, dy+14) 付近
    this._drawMofu(ctx, -16, -12);
    ctx.restore();
  }

  _drawIconPuni(ctx, cx, cy) {
    // ミニプニキング（王冠付きの紫スライム）
    // 王冠
    ctx.fillStyle = '#c8a408';
    ctx.fillRect(cx - 6, cy - 9, 12, 3);  // 王冠ベース
    ctx.fillRect(cx - 6, cy - 12, 3, 3);  // 左突起
    ctx.fillRect(cx - 2, cy - 13, 3, 4);  // 中央突起（最大）
    ctx.fillRect(cx + 3, cy - 12, 3, 3);  // 右突起
    // 宝石
    ctx.fillStyle = '#ff1850';
    ctx.fillRect(cx - 5, cy - 11, 2, 2);
    ctx.fillRect(cx - 1, cy - 12, 2, 2);
    ctx.fillRect(cx + 4, cy - 11, 2, 2);
    ctx.fillStyle = '#ff90b0';
    ctx.fillRect(cx - 5, cy - 11, 1, 1);
    ctx.fillRect(cx - 1, cy - 12, 1, 1);
    ctx.fillRect(cx + 4, cy - 11, 1, 1);

    // 体（紫スライム）
    ctx.fillStyle = '#6e10a0';
    ctx.fillRect(cx - 6, cy - 6, 12, 11); // 胴体
    ctx.fillRect(cx - 4, cy - 8, 8,  4);  // 上部（丸み）
    // ハイライト
    ctx.fillStyle = '#9820d8';
    ctx.fillRect(cx - 4, cy - 7, 5, 3);
    // つや
    ctx.fillStyle = '#c060ff';
    ctx.fillRect(cx - 3, cy - 7, 2, 2);

    // 目（赤）
    ctx.fillStyle = '#ff1040';
    ctx.fillRect(cx - 4, cy - 2, 3, 3);
    ctx.fillRect(cx + 1, cy - 2, 3, 3);
    ctx.fillStyle = '#ff90a8';
    ctx.fillRect(cx - 4, cy - 2, 1, 1);
    ctx.fillRect(cx + 1, cy - 2, 1, 1);

    // 口（ニタリ）
    ctx.fillStyle = '#1a0820';
    ctx.fillRect(cx - 3, cy + 2, 7, 2);
    ctx.fillStyle = '#f0a000'; // 歯
    ctx.fillRect(cx - 3, cy + 2, 2, 1);
    ctx.fillRect(cx - 1, cy + 2, 2, 1);
    ctx.fillRect(cx + 1, cy + 2, 2, 1);
  }
}
