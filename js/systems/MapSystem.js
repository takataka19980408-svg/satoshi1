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
      case 1: // 草: ランダム風のドット
        ctx.fillStyle = '#3a7a22';
        ctx.fillRect(dx+4,  dy+4,  3, 3);
        ctx.fillRect(dx+18, dy+10, 3, 3);
        ctx.fillRect(dx+10, dy+22, 3, 3);
        break;
      case 2: // 道: 粒感
        ctx.fillStyle = '#9a7020';
        ctx.fillRect(dx+2, dy+6, 2, 2);
        ctx.fillRect(dx+16, dy+20, 2, 2);
        break;
      case 4: // 木
        ctx.fillStyle = '#2a5a15';
        ctx.fillRect(dx+4, dy+4, TS-8, TS-8);
        ctx.fillStyle = '#1a4a0a';
        ctx.fillRect(dx+8, dy+8, TS-16, TS-16);
        break;
      case 5: // 壁
        ctx.fillStyle = '#2a2035';
        ctx.fillRect(dx, dy, TS, 3);
        ctx.fillStyle = '#4a3a55';
        ctx.fillRect(dx, dy+8, TS, 2);
        ctx.fillRect(dx, dy+16, TS, 2);
        ctx.fillRect(dx, dy+24, TS, 2);
        break;
      case 6: // 木の床
        ctx.fillStyle = '#6a4428';
        ctx.fillRect(dx, dy, TS, 2);
        ctx.fillRect(dx, dy+16, TS, 1);
        ctx.fillRect(dx+16, dy, 1, TS);
        break;
      case 8: // 森の地面
        ctx.fillStyle = '#1a2810';
        ctx.fillRect(dx+2,  dy+6,  2, 2);
        ctx.fillRect(dx+14, dy+18, 2, 2);
        ctx.fillRect(dx+22, dy+8,  2, 2);
        break;
      case 12: // 井戸
        ctx.fillStyle = '#5a5a7a';
        ctx.fillRect(dx+6, dy+6, TS-12, TS-12);
        ctx.fillStyle = '#1a1a3a';
        ctx.fillRect(dx+9, dy+9, TS-18, TS-18);
        ctx.fillStyle = '#8a8aaa';
        ctx.fillRect(dx+6, dy+4, TS-12, 4);
        break;
      case 13: // ドア
        ctx.fillStyle = '#7a5030';
        ctx.fillRect(dx+6, dy+4, TS-12, TS-6);
        ctx.fillStyle = '#c0a060';
        ctx.fillRect(dx+20, dy+14, 4, 4);
        break;
    }
  }

  _drawObject(ctx, id, dx, dy) {
    const TS = TILE_SIZE;
    switch (id) {
      case 1: // 木（オブジェクト）
        ctx.fillStyle = '#4a2a10';
        ctx.fillRect(dx+12, dy+20, 8, 12);
        ctx.fillStyle = '#2a5a15';
        ctx.fillRect(dx+2, dy+2, TS-4, TS-8);
        ctx.fillStyle = '#1a4a0a';
        ctx.fillRect(dx+6, dy+6, TS-12, TS-14);
        break;
      case 2: // 家（下部）
        ctx.fillStyle = '#5a4535';
        ctx.fillRect(dx, dy, TS, TS);
        ctx.fillStyle = '#3a2520';
        ctx.fillRect(dx+2, dy+2, TS-4, TS-4);
        break;
      case 3: // 家（屋根）
        ctx.fillStyle = '#7a3530';
        ctx.fillRect(dx, dy, TS, TS);
        ctx.fillStyle = '#9a4540';
        ctx.fillRect(dx+4, dy+4, TS-8, TS-10);
        break;
      case 4: // 光る石
        ctx.fillStyle = '#304070';
        ctx.fillRect(dx+8, dy+16, 16, 12);
        ctx.fillStyle = '#7aadff';
        ctx.fillRect(dx+10, dy+14, 12, 10);
        ctx.fillStyle = '#aaddff';
        ctx.fillRect(dx+12, dy+12, 8, 8);
        // 発光エフェクト
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 400);
        ctx.fillStyle = '#aaeeff';
        ctx.fillRect(dx+4, dy+8, 24, 20);
        ctx.globalAlpha = 1;
        break;
      case 5: // 棚・家具
        ctx.fillStyle = '#7a5030';
        ctx.fillRect(dx+2, dy+4, TS-4, TS-6);
        ctx.fillStyle = '#5a3820';
        ctx.fillRect(dx+4, dy+8, TS-8, TS-12);
        break;
      case 6: // ベッド
        ctx.fillStyle = '#4a3060';
        ctx.fillRect(dx+2, dy+4, TS-4, TS-8);
        ctx.fillStyle = '#8a60a0';
        ctx.fillRect(dx+4, dy+6, TS-8, 10);
        ctx.fillStyle = '#f0f0e0';
        ctx.fillRect(dx+4, dy+16, TS-8, TS-20);
        break;
    }
  }

  _drawNpc(ctx, npc, dx, dy) {
    const TS = TILE_SIZE;
    const colors = {
      elder:      { body: '#8a6020', hair: '#e0e0e0' },
      mom:        { body: '#cc6080', hair: '#402010' },
      villager_a: { body: '#406080', hair: '#301800' },
      villager_b: { body: '#804060', hair: '#201010' },
      villager_c: { body: '#408040', hair: '#302010' },
      ril:        { body: '#6080c0', hair: '#f0f0a0' },
      mofu:       null,
    };

    if (npc.sprite === 'mofu') {
      this._drawMofu(ctx, dx, dy);
      return;
    }

    const c = colors[npc.sprite] || { body: '#606060', hair: '#303030' };
    // 髪
    ctx.fillStyle = c.hair;
    ctx.fillRect(dx+10, dy+4, 12, 8);
    // 顔
    ctx.fillStyle = '#f0c080';
    ctx.fillRect(dx+10, dy+8, 12, 12);
    // 目
    ctx.fillStyle = '#000';
    ctx.fillRect(dx+13, dy+12, 2, 2);
    ctx.fillRect(dx+19, dy+12, 2, 2);
    // 体
    ctx.fillStyle = c.body;
    ctx.fillRect(dx+8, dy+20, 16, 14);
    // 足
    ctx.fillStyle = '#303050';
    ctx.fillRect(dx+8,  dy+34, 6, 8);
    ctx.fillRect(dx+18, dy+34, 6, 8);
  }

  _drawSatoshi(ctx, dx, dy, dir) {
    const TS = TILE_SIZE;
    // 足元のシャドウ
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(dx+6, dy+TS-4, TS-12, 4);
    // 足
    ctx.fillStyle = '#222244';
    ctx.fillRect(dx+8,  dy+34, 6, 8);
    ctx.fillRect(dx+18, dy+34, 6, 8);
    // 靴
    ctx.fillStyle = '#111';
    ctx.fillRect(dx+7,  dy+39, 7, 4);
    ctx.fillRect(dx+17, dy+39, 7, 4);
    // 体（青いシャツ）
    ctx.fillStyle = '#1a3a99';
    ctx.fillRect(dx+8, dy+18, 16, 16);
    // 腕
    ctx.fillStyle = '#f0c080';
    ctx.fillRect(dx+4,  dy+20, 4, 10);
    ctx.fillRect(dx+24, dy+20, 4, 10);
    // 首
    ctx.fillStyle = '#f0c080';
    ctx.fillRect(dx+13, dy+15, 6, 5);
    // 頭
    ctx.fillStyle = '#f0c080';
    ctx.fillRect(dx+9, dy+4, 14, 13);
    // 髪（黒）
    ctx.fillStyle = '#151010';
    ctx.fillRect(dx+9, dy+4, 14, 7);
    // 目（方向に応じて）
    if (dir !== 'up') {
      ctx.fillStyle = '#1a2a50';
      if (dir === 'left') {
        ctx.fillRect(dx+10, dy+12, 2, 2);
      } else if (dir === 'right') {
        ctx.fillRect(dx+20, dy+12, 2, 2);
      } else {
        ctx.fillRect(dx+12, dy+12, 2, 2);
        ctx.fillRect(dx+19, dy+12, 2, 2);
      }
    }
    // リュック（後ろ向き時）
    if (dir === 'up') {
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(dx+7, dy+18, 5, 12);
      ctx.fillRect(dx+20, dy+18, 5, 12);
      ctx.fillStyle = '#7a5030';
      ctx.fillRect(dx+6, dy+20, 6, 10);
      ctx.fillRect(dx+20, dy+20, 6, 10);
    }
  }

  _drawMofu(ctx, dx, dy) {
    // 体（クリーム色）
    ctx.fillStyle = '#f0ece0';
    ctx.fillRect(dx+6, dy+18, 20, 16);
    // 頭
    ctx.fillRect(dx+8, dy+8, 16, 16);
    // 耳
    ctx.fillRect(dx+5,  dy+5, 7, 9);
    ctx.fillRect(dx+20, dy+5, 7, 9);
    // 耳の内側（ピンク）
    ctx.fillStyle = '#f0a0b0';
    ctx.fillRect(dx+7,  dy+7, 3, 5);
    ctx.fillRect(dx+22, dy+7, 3, 5);
    // 目
    ctx.fillStyle = '#0a0a20';
    ctx.fillRect(dx+11, dy+14, 3, 3);
    ctx.fillRect(dx+18, dy+14, 3, 3);
    // 目の光
    ctx.fillStyle = '#fff';
    ctx.fillRect(dx+12, dy+14, 1, 1);
    ctx.fillRect(dx+19, dy+14, 1, 1);
    // 鼻
    ctx.fillStyle = '#d07090';
    ctx.fillRect(dx+15, dy+19, 2, 2);
    // 尻尾
    ctx.fillStyle = '#f0ece0';
    ctx.fillRect(dx+25, dy+20, 6, 6);
    // 足
    ctx.fillStyle = '#e0dcd0';
    ctx.fillRect(dx+7,  dy+30, 6, 6);
    ctx.fillRect(dx+19, dy+30, 6, 6);
  }
}
