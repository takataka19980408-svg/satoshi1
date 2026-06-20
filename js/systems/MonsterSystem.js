// 仲間モンスターの管理
export class MonsterSystem {
  constructor(game) {
    this.game = game;
  }

  // 仲間モンスターリストを取得
  getMonsters() {
    return this.game.state.monsters || [];
  }

  // 仲間モンスターが戦闘に参加できるか
  getActiveMonsters() {
    return this.getMonsters().filter(m => m.hp > 0);
  }

  // 現在の全戦闘メンバー（サトシ + 仲間モンスター）
  getAllMembers() {
    return [...this.game.state.party, ...this.getActiveMonsters()];
  }
}
