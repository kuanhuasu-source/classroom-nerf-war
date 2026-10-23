import { Game } from './game.js';
import { QueueTransport } from './net/transport.js';
import { initLobby } from './lobby.js';
import { TEACHERS, BOSSES } from './teachers.js';

async function boot() {
  try { await document.fonts.ready; } catch (e) { /* fonts optional */ }
  // ?role=host / ?role=guest with a queue transport is the fake link used by the tests;
  // real rooms (PeerJS) come in the next step.
  window.__teachers = TEACHERS; window.__bosses = BOSSES;
  const mapParam = new URLSearchParams(location.search).get('map'); // handy for tests and for the ?teacher=id debug switch
  const role = new URLSearchParams(location.search).get('role');
  if (role === 'host' || role === 'guest') {
    const transport = new QueueTransport(); window.__transport = transport;
    window.__game = new Game({ role, transport }); if (mapParam) window.__game.mapChoice = mapParam;
    document.getElementById('btn-start').addEventListener('click', () => window.__game.start()); // no lobby in the fake link
  } else { window.__game = new Game(); initLobby(window.__game); }
  if (mapParam) window.__game.mapChoice = mapParam;
}
boot();
