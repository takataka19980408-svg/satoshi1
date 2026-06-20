export class AssetLoader {
  constructor() {
    this._cache = {};
  }

  async loadJSON(path) {
    if (this._cache[path]) return this._cache[path];
    const res = await fetch(path);
    if (!res.ok) throw new Error(`ロード失敗: ${path}`);
    const data = await res.json();
    this._cache[path] = data;
    return data;
  }

  // 必要なデータを一括ロード
  async loadAll() {
    const paths = [
      'data/characters/party.json',
      'data/items/items.json',
      'data/enemies/enemies.json',
      'data/npcs/chapter1.json',
      'data/events/chapter1.json',
    ];
    await Promise.all(paths.map(p => this.loadJSON(p)));
  }

  async loadMap(mapId) {
    return this.loadJSON(`data/maps/${mapId}.json`);
  }

  get(path) {
    return this._cache[path] || null;
  }
}
