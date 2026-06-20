import { Game } from './engine/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.start().catch(e => {
    console.error('起動エラー:', e);
  });
});
