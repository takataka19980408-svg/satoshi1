const SAVE_KEY = 'satoshi_stone_save';
const SAVE_VERSION = 1;

export class SaveManager {
  save(state) {
    try {
      const data = {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        ...state,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch(e) {
      console.warn('セーブ失敗:', e);
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.version !== SAVE_VERSION) return null;
      return data;
    } catch(e) {
      return null;
    }
  }

  hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }
}
