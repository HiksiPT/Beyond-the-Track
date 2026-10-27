// Entry point: WebGL check, load the career save, start the game loop and show the title screen.
import './styles/main.css';
import { Game } from './game/Game.js';
import { UI } from './ui/UI.js';
import { loadProfile, hasProfile, saveProfile } from './game/SaveSystem.js';
import { newProfile } from './game/GameState.js';
import * as Menus from './ui/Menus.js';

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2')); } catch { return false; }
}

function boot() {
  if (!webglOk()) {
    document.getElementById('loading').hidden = true;
    document.getElementById('nowebgl').hidden = false;
    return;
  }
  const { profile, notes } = loadProfile();
  const ui = new UI();
  let game;
  try {
    game = new Game(document.getElementById('view'), profile || newProfile(), ui);
  } catch (e) {
    document.getElementById('loading').hidden = true;
    ui.fatal(e);
    return;
  }
  ui.attach(game);
  window.__game = game;   // debugging handle
  if (import.meta.env.DEV) import('./dev/autoplay.js').then(m => m.installAutoplay(game));
  document.body.classList.toggle('big-text', !!game.profile.settings.bigText);
  if (!profile) saveProfile(game.profile);
  game.start();
  Menus.loading('Preparing the Main Range…', 0.05);
  game.loadMountain('kosciuszko', 'summer', (m, f) => Menus.loading(m, f))
    .catch(e => { console.error(e); ui.toast('Terrain could not be loaded: ' + e.message, 9000); })
    .finally(() => { Menus.loading(false); Menus.title(game, !!profile && hasProfile(), notes); });
  addEventListener('error', (e) => { if (e.error) console.error(e.error); });
  addEventListener('unhandledrejection', (e) => console.error(e.reason));
}
boot();
