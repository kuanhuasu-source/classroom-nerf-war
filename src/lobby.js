import { PeerTransport, roomCode, normalizeCode } from './net/peer.js';
import { $ } from './ui.js';
import { LOOKS } from './config.js';
import { Draw } from './draw.js';
import QRCode from 'qrcode';

// The front page: solo, open a room, or join one by code.
export function initLobby(game) {
  const q = new URLSearchParams(location.search);
  const peerOpts = q.get('peer') === 'local' ? { host: 'localhost', port: 9000, path: '/', secure: false } : null;
  let transport = null;
  const status = (t) => { $('lobby-status').textContent = t; };
  const show = (mode) => {
    $('menu-buttons').hidden = mode !== 'menu'; $('lobby').hidden = mode === 'menu';
    $('lobby-code-wrap').hidden = mode !== 'host'; $('lobby-join').hidden = mode !== 'join'; $('btn-begin').hidden = true;
  };
  const leave = () => { if (transport) { transport.close(); transport = null; } game.detachTransport(); show('menu'); };
  // the single-file build (Claude Artifact) runs in a sandbox without WebRTC: solo only
  // QR codes: the front page shows the game's own address (phones scan it to open the game); a room shows a link with its code
  const siteUrl = location.origin + location.pathname;
  const drawQr = (id, text) => { QRCode.toCanvas($(id), text, { width: 132, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2b2622', light: '#fbf6e6' } }, () => {}); };
  if (import.meta.env.VITE_SOLO_ONLY !== '1' && /^https?:/.test(location.protocol)) { $('qr-site-wrap').hidden = false; drawQr('qr-site', siteUrl); }
  if (import.meta.env.VITE_SOLO_ONLY === '1') { $('btn-host').hidden = true; $('btn-join-open').hidden = true; $('menu-note').textContent = '建議用電腦與滑鼠遊玩。連線模式（最多四人）在網站版才有。'; }

  // mode: the classroom war or the gate siege; remembered per browser
  const MODE_NOTES = { class: '下課大戰：六波同學加一位老師，撿地上的泡棉彈補充。', siege: '守校門：惡霸軍團從校門、圍牆、水溝蓋闖進操場，守住十波。彈藥無限，第 3、6、9 波有頭目，第 10 波是會瘋狂丟板擦的大王。', toilet: '搶廁所：下課想上廁所，清潔隊卻在打掃。只有三滴血、90 秒；被水潑到慢 5 秒，通馬桶一連 3 到 5 支。射破最裡面小便斗架上和洗手台上的 8 個罐子就贏。', lunch: '午餐大作戰（兩人限定）：一個推餐車去蒸飯室裝菜再推回六年二班，一個站在車上擋搶菜的同學；裝完菜換手。回程撞到、被打中、被搶都會灑湯，回班時剩多少湯決定星星。開房間找剛好一位隊友再開始。' };
  let mode = 'class'; try { const saved = localStorage.getItem('cnw-mode'); if (saved && MODE_NOTES[saved]) mode = saved; } catch (e) { /* ignore */ }
  const applyMode = (m) => { mode = m; game.mode = m; document.querySelectorAll('.seg-btn[data-mode]').forEach(b => { const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }); $('mode-note').textContent = MODE_NOTES[m]; $('map-row').classList.toggle('dim', m !== 'class'); $('map-note').textContent = m === 'siege' ? '守校門固定在操場' : m === 'toilet' ? '搶廁所固定在廁所' : m === 'lunch' ? '午餐大作戰固定在走廊' : ''; try { localStorage.setItem('cnw-mode', m); } catch (e) { /* ignore */ } };
  document.querySelectorAll('.seg-btn[data-mode]').forEach(b => { b.setAttribute('role', 'radio'); b.addEventListener('click', () => applyMode(b.dataset.mode)); });
  applyMode(mode);
  // difficulty: remembered per browser
  const NOTES = { easy: '小考：少一點同學、準度低、一次只有一個同學開火，每清一波回 2 顆心。', normal: '段考：同時最多兩個同學開火，每清一波回 1 顆心。', hard: '模擬考：人多、準、三個同學同時射你，不回血，大 Boss 機率高。', exam: '會考：同學更多更準、四個同時開火、彈速更快、老師更兇，六成機率遇到大 Boss。給能穩過模擬考的人。' };
  let level = 'normal'; try { const saved = localStorage.getItem('cnw-difficulty'); if (saved && NOTES[saved]) level = saved; } catch (e) { /* ignore */ }
  const applyLevel = (l) => { level = l; game.setDifficulty(l); document.querySelectorAll('.seg-btn[data-level]').forEach(b => { const on = b.dataset.level === l; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }); $('difficulty-note').textContent = NOTES[l]; try { localStorage.setItem('cnw-difficulty', l); } catch (e) { /* ignore */ } };
  document.querySelectorAll('.seg-btn[data-level]').forEach(b => { b.setAttribute('role', 'radio'); b.addEventListener('click', () => applyLevel(b.dataset.level)); });
  applyLevel(level);
  // room choice: random or a specific classroom
  let mapChoice = 'random'; try { const saved = localStorage.getItem('cnw-map'); if (saved) mapChoice = saved; } catch (e) { /* ignore */ }
  const applyMap = (m) => { mapChoice = m; game.mapChoice = m; document.querySelectorAll('.map-btn').forEach(b => { const on = b.dataset.map === m; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }); try { localStorage.setItem('cnw-map', m); } catch (e) { /* ignore */ } };
  document.querySelectorAll('.map-btn').forEach(b => { b.setAttribute('role', 'radio'); b.addEventListener('click', () => applyMap(b.dataset.map)); });
  applyMap(mapChoice);
  // who am I in a room: a typed name (up to 6 characters) and one of the looks; remembered per browser
  const nameEl = $('my-name'), lookRow = $('look-row');
  nameEl.value = game.profile.name;
  nameEl.addEventListener('input', () => { game.profile.name = nameEl.value.trim().slice(0, 6); try { localStorage.setItem('cnw-name', game.profile.name); } catch (e) { /* ignore */ } });
  const applyLook = (id) => { game.profile.look = id; try { localStorage.setItem('cnw-look', id); } catch (e) { /* ignore */ } lookRow.querySelectorAll('button').forEach(b => { const on = b.dataset.look === id; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }); };
  for (const l of LOOKS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'look-btn'; b.dataset.look = l.id; b.title = l.label; b.setAttribute('role', 'radio');
    const c = document.createElement('canvas'); c.width = 44; c.height = 88; c.getContext('2d').drawImage(Draw.kid(l.v, 'normal'), 0, 0, 44, 88); b.appendChild(c);
    b.addEventListener('click', () => applyLook(l.id)); lookRow.appendChild(b);
  }
  applyLook(LOOKS.some(l => l.id === game.profile.look) ? game.profile.look : LOOKS[0].id);
  $('btn-start').addEventListener('click', () => { leave(); game.start(); });

  $('btn-host').addEventListener('click', () => {
    leave(); show('host');
    const code = roomCode(); $('lobby-code').textContent = code; status('正在開房間……'); drawQr('qr-room', `${siteUrl}?room=${code}`);
    transport = new PeerTransport(peerOpts);
    const roster = () => {
      const names = game.lobbyNames();
      if (!names.length) status('房間開好了。把房號告訴隊友（最多三個人），等他們進來。');
      else status(`${names.join('、')}連上了（${names.length}/3）。人到齊就按「開始」。`);
      $('btn-begin').hidden = !names.length;
    };
    game.onLobbyChange = roster;
    transport.onStatus((s, info) => {
      if (s === 'listening') roster();
      else if (s === 'open') game.onPeerOpen(info);
      else if (s === 'closed') { game.onPeerClosed(info); if (game.state === 'menu') roster(); else status('有人斷線了，30 秒內用同一個房號可以回來。'); }
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
    game.onWelcome = (m) => status(`連上了！你是${m.name}，等房主按開始。`);
    game.onFull = () => status('這間教室滿了（最多四個人），找別的房號。');
    transport.onStatus((s, info) => {
      if (s === 'connecting') status('連線中……');
      else if (s === 'open') { status('連上了，正在報到……'); game.sendHello(); }
      else if (s === 'closed') { status('房主離開了教室。'); game.onPeerClosed(info); }
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
  const toMenu = () => { game.toMenu(); leave(); };
  $('btn-menu-pause').addEventListener('click', toMenu);
  $('btn-menu-over').addEventListener('click', toMenu);

  // ?room=CODE opens the join panel with the code filled in (share-link friendly)
  const pre = normalizeCode(q.get('room'));
  if (pre.length === 4) { show('join'); $('join-code').value = pre; status('房號已填好，正在加入……'); setTimeout(join, 300); } // a scanned QR joins by itself
}
