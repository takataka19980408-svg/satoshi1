// NPCエンティティ。データはdata/npcs/から読み込む。
export class NPC {
  constructor(mapNpcDef, npcData) {
    this.id     = mapNpcDef.id;
    this.x      = mapNpcDef.x;
    this.y      = mapNpcDef.y;
    this.dir    = mapNpcDef.dir || 'down';
    this.sprite = npcData?.sprite || mapNpcDef.id;
    this.name   = npcData?.name   || mapNpcDef.id;
    this._data  = npcData || {};
  }

  // ゲーム状態に応じた会話テキストを返す
  getDialog(flags) {
    const dialog = this._data.dialog || {};
    // 条件付きダイアログを上から評価（先に書いた条件が優先）
    for (const [key, lines] of Object.entries(dialog)) {
      if (key === 'default') continue;
      if (flags[key]) return lines;
    }
    return dialog.default || ['...'];
  }
}
