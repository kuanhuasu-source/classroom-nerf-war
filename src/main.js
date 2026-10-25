import { Game } from './game.js';
import { QueueTransport } from './net/transport.js';
import { initLobby } from './lobby.js';
import { TEACHERS, BOSSES, GANG } from './teachers.js';
import { Badges } from './badges.js';

async function boot() {
  try { await document.fonts.ready; } catch (e) { /* fonts optional */ }
  // ?role=host / ?role=guest with a queue transport is the fake link used by the tests;
  // real rooms (PeerJS) come in the next step.
  window.__teachers = TEACHERS; window.__bosses = BOSSES; window.__gang = GANG; window.__badges = Badges;
  const mapParam = new URLSearchParams(location.search).get('map'), modeParam = new URLSearchParams(location.search).get('mode'); // handy for tests and for the ?teacher=id debug switch
  const q = new URLSearchParams(location.search), role = q.get('role');
  if (role === 'host' || role === 'guest') {
    // a guest page is ?role=guest&slot=g1 (g1 by default); its persistent id is derived from the slot so tests are deterministic
    const id = role === 'host' ? 'host' : (q.get('slot') || 'g1');
    const transport = new QueueTransport(id); window.__transport = transport;
    window.__game = new Game({ role, transport, pid: role === 'host' ? null : 'test-' + id }); if (mapParam) window.__game.mapChoice = mapParam; if (modeParam) window.__game.mode = modeParam;
    document.getElementById('btn-start').addEventListener('click', () => window.__game.start()); // no lobby in the fake link
  } else { window.__game = new Game(); initLobby(window.__game); }
  if (mapParam) window.__game.mapChoice = mapParam; if (modeParam) window.__game.mode = modeParam;
}
boot();
