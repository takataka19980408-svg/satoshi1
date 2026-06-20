// ドラクエ風ターンベース戦闘の計算ロジック
export class BattleSystem {
  constructor(game) {
    this.game = game;
  }

  // ダメージ計算（基本）
  calcDamage(attacker, defender) {
    const base = attacker.atk - Math.floor(defender.def / 2);
    const rand = Math.floor(Math.random() * Math.floor(base * 0.25 + 1));
    return Math.max(1, base + rand - rand * 2 + rand); // ±25%揺れ
  }

  calcDamageSimple(atk, def) {
    const base = atk - Math.floor(def / 2);
    const variance = Math.floor(base * 0.2);
    const rand = Math.floor(Math.random() * (variance * 2 + 1)) - variance;
    return Math.max(1, base + rand);
  }

  // スキルダメージ
  calcSkillDamage(skill, attacker, defender) {
    const base = (attacker.mat || attacker.atk) * skill.power - Math.floor(defender.mdf || defender.def / 2);
    return Math.max(1, base);
  }

  // 命中判定（必中の場合は無視）
  hitCheck(attacker, defender) {
    if (attacker.hitRate === undefined) return true;
    const rate = attacker.hitRate - (defender.agi || 0) * 0.5;
    return Math.random() * 100 < rate;
  }

  // 逃走成功率
  runChance(party, enemy) {
    const avgSpd = party.reduce((s, m) => s + (m.spd || 5), 0) / party.length;
    return Math.min(0.9, Math.max(0.1, (avgSpd - (enemy.spd || 4)) * 0.1 + 0.5));
  }

  // 敵AIの行動決定
  enemyAction(enemy, party) {
    if (!enemy.skills?.length || Math.random() > 0.3) {
      return { type: 'attack' };
    }
    const skill = enemy.skills[Math.floor(Math.random() * enemy.skills.length)];
    return { type: 'skill', skill };
  }

  // 経験値・ゴールド取得
  getBattleRewards(enemy) {
    return { exp: enemy.exp || 0, gold: enemy.gold || 0 };
  }

  // レベルアップ判定
  checkLevelUp(member) {
    const thresholds = [0, 10, 25, 50, 90, 150, 240, 370, 540, 770, 1070];
    const currentLv = member.level || 1;
    const nextLv = currentLv + 1;
    if (nextLv < thresholds.length && member.exp >= thresholds[nextLv]) {
      return nextLv;
    }
    return null;
  }

  // レベルアップ時のパラメータ増加
  applyLevelUp(member, newLevel) {
    member.level = newLevel;
    const gains = {
      satoshi: { maxHp: 8, maxMp: 3, atk: 2, def: 1, spd: 1 },
      mofu:    { maxHp: 6, maxMp: 2, atk: 2, def: 1, spd: 2 },
    };
    const g = gains[member.id] || { maxHp: 5, atk: 1, def: 1 };
    member.maxHp  = (member.maxHp  || 0) + g.maxHp;
    member.maxMp  = (member.maxMp  || 0) + (g.maxMp || 0);
    member.atk    = (member.atk    || 0) + g.atk;
    member.def    = (member.def    || 0) + g.def;
    member.hp = Math.min(member.hp + g.maxHp, member.maxHp);
    return g;
  }
}
