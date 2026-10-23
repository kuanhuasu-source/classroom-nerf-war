import { PeerTransport, roomCode, normalizeCode } from './net/peer.js';
import { $ } from './ui.js';

// The front page: solo, open a room, or join one by code.
export function initLobby(game) {
  const q = new URLSearchParams(location.search);
  const peerOpts = q.get('peer') === 'local' ? { host: 'localhost', port: 9000, path: '/', secure: false } : null;
  let transport = null, reconnectTimer = 0;
  const status = (t) => { $('lobby-status').textContent = t; };
  const show = (mode) => {
    $('menu-buttons').hidden = mode !== 'menu'; $('lobby').hidden = mode === 'menu';
    $('lobby-code-wrap').hidden = mode !== 'host'; $('lobby-join').hidden = mode !== 'join'; $('btn-begin').hidden = true;
  };
  const leave = () => { if (transport) { transport.close(); transport = null; } game.detachTransport(); show('menu'); };
  // the single-file build (Claude Artifact) runs in a sandbox without WebRTC: solo only
  if (import.meta.env.VITE_SOLO_ONLY === '1') { $('btn-host').hidden = true; $('btn-join-open').hidden = true; $('menu-note').textContent = '建議用電腦與滑鼠遊玩。雙人連線模式在網站版才有。'; }

  // difficulty: remembered per browser
  const NOTES = { easy: '少一點同學、準度低、一次只有一個同學開火，每清一波回 2 顆心。', normal: '同時最多兩個同學開火，每清一波回 1 顆心。', hard: '原本的難度：人多、準、四個同學同時射你，不回血。' };
  let level = 'normal'; try { const saved = localStorage.getItem('cnw-difficulty'); if (saved && NOTES[saved]) level = saved; } catch (e) { /* ignore */ }
  const applyLevel = (l) => { level = l; game.setDifficulty(l); document.querySelectorAll('.seg-btn[data-level]').forEach(b => { const on = b.dataset.level === l; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }); $('difficulty-note').textContent = NOTES[l]; try { localStorage.setItem('cnw-difficulty', l); } catch (e) { /* ignore */ } };
  document.querySelectorAll('.seg-btn[data-level]').forEach(b => { b.setAttribute('role', 'radio'); b.addEventListener('click', () => applyLevel(b.dataset.level)); });
  applyLevel(level);
  // room choice: random or a specific classroom
  let mapChoice = 'random'; try { const saved = localStorage.getItem('cnw-map'); if (saved) mapChoice = saved; } catch (e) { /* ignore */ }
  const applyMap = (m) => { mapChoice = m; game.mapChoice = m; document.querySelectorAll('.map-btn').forEach(b => { const on = b.dataset.map === m; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }); try { localStorage.setItem('cnw-map', m); } catch (e) { /* ignore */ } };
  document.querySelectorAll('.map-btn').forEach(b => { b.setAttribute('role', 'radio'); b.addEventListener('click', () => applyMap(b.dataset.map)); });
  applyMap(mapChoice);
  $('btn-start').addEventListener('click', () => { leave(); game.start(); });

  $('btn-host').addEventListener('click', () => {
    leave(); show('host');
    const code = roomCode(); $('lobby-code').textContent = code; status('正在開房間……');
    transport = new PeerTransport(peerOpts);
    transport.onStatus((s, info) => {
      if (s === 'listening') status('房間開好了。把房號告訴隊友，等她進來。');
      else if (s === 'open') { status('小美連上了！按「開始」就上課……不，開戰。'); $('btn-begin').hidden = false; clearTimeout(reconnectTimer); game.onPeerOpen(); }
      else if (s === 'closed') { status('隊友斷線了，30 秒內用同一個房號可以回來。'); game.onPeerClosed(); reconnectTimer = setTimeout(() => game.onPeerGone(), 30000); }
      else if (s === 'error') status(info);
    });
    game.attachTransport('host', transport);
    transport.host(code);
  });

  $('btn-join-open').addEventListener('click', () => { leave(); show('join'); status('輸入房主給你的四個字母。'); $('join-code').focus(); });
  const join = () => {
    const code = normalizeCode($('join-code').value); if (code.length !== 4) { status('房號是四個字母。'); return; }
    if (transport) { transport.close(); transport = null; }
    transport = new PeerTransport(peerOpts);
    transport.onStatus((s, info) => {
      if (s === 'connecting') status('連線中……');
      else if (s === 'open') status('連上了！等房主按開始。');
      else if (s === 'closed') { status('房主離開了教室。'); game.onPeerClosed(); }
      else if (s === 'error') status(info);
    });
    game.attachTransport('guest', transport);
    transport.join(code);
  };
  $('btn-join').addEventListener('click', join);
  $('join-code').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
  $('join-code').addEventListener('input', e => { e.target.value = normalizeCode(e.target.value); });
  $('btn-copy').addEventListener('click', () => { const code = $('lobby-code').textContent; try { navigator.clipboard.writeText(code).catch(() => {}); } catch (e) { /* ignore */ } status('房號 ' + code + ' 複製好了。'); });
  $('btn-begin').addEventListener('click', () => game.start());
  $('btn-lobby-back').addEventListener('click', leave);
  const toMenu = () => { clearTimeout(reconnectTimer); game.toMenu(); leave(); };
  $('btn-menu-pause').addEventListener('click', toMenu);
  $('btn-menu-over').addEventListener('click', toMenu);

  // ?room=CODE opens the join panel with the code filled in (share-link friendly)
  const pre = normalizeCode(q.get('room'));
  if (pre.length === 4) { show('join'); $('join-code').value = pre; status('房號已填好，按「加入」。'); }
}
