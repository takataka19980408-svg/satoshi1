export class AssetLoader {
  constructor() {
    this._cache = {};
  }

  async loadJSON(path) {
    if (this._cache[path]) return this._cache[path];
    try {
      const res = await fetch(path);
      if (!res.ok) { console.warn(`AssetLoader: ${path} → ${res.status}`); return null; }
      const data = await res.json();
      this._cache[path] = data;
      return data;
    } catch (e) {
      console.warn(`AssetLoader: ${path} の読み込みに失敗`, e);
      return null;
    }
  }

  // 必要なデータを一括ロード（個別の失敗は無視して続行）
  async loadAll() {
    const paths = [
      'data/characters/party.json',
      'data/items/items.json',
      'data/enemies/enemies.json',
      'data/npcs/chapter1.json',
      'data/npcs/chapter2.json',
      'data/npcs/chapter3.json',
      'data/npcs/chapter4.json',
      'data/events/chapter1.json',
      'data/events/chapter2.json',
      'data/events/chapter3.json',
      'data/events/chapter4.json',
      'data/events/chapter4b.json',
      'data/events/chapter5.json',
    ];
    await Promise.allSettled(paths.map(p => this.loadJSON(p)));
  }

  async loadMap(mapId) {
    return this.loadJSON(`data/maps/${mapId}.json`);
  }

  get(path) {
    return this._cache[path] || null;
  }
}
