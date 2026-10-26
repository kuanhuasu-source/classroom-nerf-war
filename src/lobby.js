import { PeerTransport, roomCode, normalizeCode } from './net/peer.js';
import { $ } from './ui.js';
import { LOOKS } from './config.js';
import { Draw } from './draw.js';
import QRCode from 'qrcode';
import { STORY, Progress, starText } from './story.js';
import { Ach } from './achievements.js';
import { Badges } from './badges.js';
import { Profile } from './profile.js';
import { Records } from './records.js';

// The front page: solo, open a room, or join one by code.
export function initLobby(game) {
  const q = new URLSearchParams(location.search);
  const afterId = [], whenId = (fn) => { if (Profile.id) fn(); else afterId.push(fn); }; // things that wait until an ID is entered
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
  nameEl.addEventListener('input', () => { game.profile.name = nameEl.value.trim().slice(0, 6) || Profile.id; Profile.put('name', game.profile.name); });
  const applyLook = (id, save = true) => { game.profile.look = id; if (save) Profile.put('look', id); lookRow.querySelectorAll('button').forEach(b => { const on = b.dataset.look === id; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }); };
  for (const l of LOOKS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'look-btn'; b.dataset.look = l.id; b.title = l.label; b.setAttribute('role', 'radio');
    const c = document.createElement('canvas'); c.width = 44; c.height = 88; c.getContext('2d').drawImage(Draw.kid(l.v, 'normal'), 0, 0, 44, 88); b.appendChild(c);
    b.addEventListener('click', () => applyLook(l.id)); lookRow.appendChild(b);
  }
  applyLook(LOOKS.some(l => l.id === game.profile.look) ? game.profile.look : LOOKS[0].id);
  $('btn-start').addEventListener('click', () => { leave(); game.start(); });

  // ---------- 故事模式：Jason 的畢業週 ----------
  const storyNote = () => { const total = STORY.chapters.filter(c => !c.hidden).reduce((a, c) => a + Progress.stars(c.id), 0); $('story-note').textContent = total ? `★ ${total}/18${Progress.allThree() ? '　隱藏章已解鎖' : ''}` : ''; };
  const renderStory = () => {
    const list = $('story-list'); list.innerHTML = '';
    for (const ch of STORY.chapters) {
      if (ch.hidden && !Progress.allThree()) { const row = document.createElement('button'); row.type = 'button'; row.className = 'chapter'; row.disabled = true; row.innerHTML = '<span class="day">？？？</span><span>🔒</span><span>五章全三星才會出現的一章</span><span class="stars"></span>'; list.appendChild(row); continue; }
      const open = Progress.unlocked(ch), st = Progress.stars(ch.id), row = document.createElement('button'); row.type = 'button'; row.className = 'chapter'; row.disabled = !open;
      row.innerHTML = '<span class="day"></span><span class="w"></span><span class="t"></span><span class="stars"></span>';
      row.querySelector('.day').textContent = ch.day; row.querySelector('.w').textContent = open ? ch.weather : '🔒'; row.querySelector('.t').textContent = ch.title; row.querySelector('.stars').textContent = open ? starText(st) : '';
      row.addEventListener('click', () => showDiary(ch)); list.appendChild(row);
    }
  };
  let diaryChapter = null;
  const showDiary = (ch) => {
    diaryChapter = ch; $('story').hidden = true; $('diary').hidden = false;
    $('diary-day').textContent = ch.day; $('diary-weather').textContent = ch.weather; $('diary-title').textContent = ch.title; $('diary-text').textContent = ch.diary.join('\n'); $('diary-goal').textContent = ch.goal;
    const st = Progress.stars(ch.id); $('diary-stars').textContent = st ? `上次：${starText(st)}` : '';
  };
  const showAlbum = () => {
    $('album').hidden = false; $('album-text').textContent = STORY.epilogue.join('\n');
    const list = $('album-list'); list.innerHTML = '';
    for (const ch of STORY.chapters) { if (ch.hidden && !Progress.stars(ch.id)) continue; const row = document.createElement('div'); row.className = 'chapter'; row.innerHTML = '<span class="day"></span><span class="w"></span><span class="t"></span><span class="stars"></span>'; row.querySelector('.day').textContent = ch.day; row.querySelector('.w').textContent = ch.weather; row.querySelector('.t').textContent = ch.end; row.querySelector('.stars').textContent = starText(Progress.stars(ch.id)); list.appendChild(row); }
    $('album-stickers').textContent = `貼紙 ${Ach.count()} / 26${Progress.allThree() ? '　全章三星！' : ''}`;
  };
  $('btn-story').addEventListener('click', () => { leave(); renderStory(); $('story').hidden = false; });
  $('btn-story-close').addEventListener('click', () => { $('story').hidden = true; });
  $('btn-diary-back').addEventListener('click', () => { $('diary').hidden = true; renderStory(); $('story').hidden = false; });
  $('btn-diary-go').addEventListener('click', () => { if (!diaryChapter) return; $('diary').hidden = true; game.startStory(diaryChapter); if (game.state !== 'playing') { renderStory(); $('story').hidden = false; } });
  $('btn-next').addEventListener('click', () => { const ch = game.story; const nx = ch ? Progress.next(ch) : null; const album = !ch || ch.finale || ch.hidden || !nx; game.toMenu(); storyNote(); if (album) showAlbum(); else showDiary(nx); });
  $('btn-album-close').addEventListener('click', () => { $('album').hidden = true; storyNote(); });
  // ---------- 徽章 ----------
  const badgeNote = () => { const w = Badges.worn(), sets = Badges.activeSets(); $('badge-note').textContent = sets.length ? sets.map(s => s.name).join('＋') : w.length ? w.map(b => Badges.label(b)).join('・') : (Badges.load().list.length ? '還沒佩戴' : ''); };
  const slotHint = () => { const n = game.badgeSlots(); return `可以佩戴 ${n} 枚` + (n < 2 ? '（破完故事模式開第二格）' : n < 3 ? '（故事每章三顆星，或集滿 12 張貼紙，開第三格）' : ''); };
  $('btn-badges').addEventListener('click', () => { Badges.render(game.badgeSlots(), badgeNote); $('badge-status').textContent = slotHint(); $('badges').hidden = false; });
  $('btn-badges-close').addEventListener('click', () => { $('badges').hidden = true; badgeNote(); });
  $('btn-badge-merge').addEventListener('click', () => { const n = Badges.merge(); $('badge-status').textContent = n ? `合成了 ${n} 枚，同類型升了一級！` : '沒有三枚同類同級的。'; Badges.render(game.badgeSlots(), badgeNote); badgeNote(); });
  badgeNote();
  // ---------- 貼紙簿 ----------
  $('btn-stickers').addEventListener('click', () => { Ach.renderBook(); $('stickers').hidden = false; });
  // what's new: shown once per NEWS_VER, the first time this browser opens the new build
  const NEWS_VER = 'records1';
  let seenNews = null; try { seenNews = localStorage.getItem('cnw-news'); } catch (e) { /* ignore */ }
  const closeNews = () => { $('news').hidden = true; try { localStorage.setItem('cnw-news', NEWS_VER); } catch (e) { /* ignore */ } };
  $('btn-news-close').addEventListener('click', closeNews);
  $('btn-news-badges').addEventListener('click', () => { closeNews(); $('btn-badges').click(); });
  whenId(() => { if (seenNews !== NEWS_VER && ![...q.keys()].some(k => k !== 'id')) $('news').hidden = false; }); // only on a plain open (an ?id= alone is fine): not through a room link, not on the ?map= / ?role= debug and test links // only on a plain open: not through a room link, not on the ?map= / ?role= debug and test links
  $('btn-stickers-close').addEventListener('click', () => { $('stickers').hidden = true; });
  storyNote();

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
  if (pre.length === 4) whenId(() => { show('join'); $('join-code').value = pre; status('房號已填好，正在加入……'); setTimeout(join, 300); }); // a scanned QR joins by itself, once there is an ID

  // ---------- 個人 ID：沒有就先問，之後首頁可以切換；紀錄、星星、貼紙、徽章、名字、造型都跟著 ID ----------
  const gate = $('idgate'), idIn = $('id-input');
  const refreshAll = () => { game.loadProfile(); nameEl.value = game.profile.name === Profile.id ? '' : game.profile.name; applyLook(LOOKS.some(l => l.id === game.profile.look) ? game.profile.look : LOOKS[0].id, false); storyNote(); badgeNote(); $('id-show').textContent = Profile.id; };
  const showGate = (switching) => {
    gate.hidden = false; idIn.value = switching ? Profile.id : ''; $('btn-id-cancel').hidden = !switching; $('id-error').textContent = '';
    const kb = $('id-known'); kb.innerHTML = ''; for (const k of Profile.known().filter(k => k !== Profile.id)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'mini'; b.textContent = k; b.addEventListener('click', () => { idIn.value = k; applyId(); }); kb.appendChild(b); }
    setTimeout(() => idIn.focus(), 50);
  };
  const applyId = () => { const id = Profile.clean(idIn.value); if (!Profile.valid(id)) { $('id-error').textContent = '請輸入 1 到 10 碼的英文或數字'; return; } Profile.set(id); gate.hidden = true; refreshAll(); while (afterId.length) afterId.shift()(); };
  idIn.addEventListener('input', () => { const v = Profile.clean(idIn.value); if (v !== idIn.value) idIn.value = v; });
  idIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyId(); });
  $('btn-id-ok').addEventListener('click', applyId); $('btn-id-cancel').addEventListener('click', () => { gate.hidden = true; });
  $('btn-id-switch').addEventListener('click', () => showGate(true));

  // ---------- 紀錄頁、成績卡、搬家代碼 ----------
  const totalStars = () => STORY.chapters.reduce((a, c) => a + Progress.stars(c.id), 0);
  const kidCanvas = () => { const l = LOOKS.find(l => l.id === game.profile.look) || LOOKS[0]; return Draw.kid(l.v, 'normal'); };
  const wornLabels = () => Badges.worn().map(b => Badges.label(b));
  $('btn-records').addEventListener('click', () => { Records.render(game.profile, { stickers: Ach.count(), stars: totalStars() }); $('records').hidden = false; });
  $('btn-records-close').addEventListener('click', () => { $('records').hidden = true; });
  const showCard = (url) => { $('card-img').src = url; $('card-dl').href = url; $('card-dl').download = `課桌大戰-${Profile.id}.png`; $('cardview').hidden = false; };
  $('btn-card-close').addEventListener('click', () => { $('cardview').hidden = true; });
  $('btn-rec-card').addEventListener('click', () => showCard(Records.card({ profile: game.profile, kidCanvas: kidCanvas(), stickers: Ach.count(), stars: totalStars(), worn: wornLabels() })));
  $('btn-card-over').addEventListener('click', () => { // this round's card from what the result screen shows
    const lines = [['分數', $('st-score').textContent], ['打倒', $('st-kills').textContent], ['命中率', $('st-acc').textContent], [game.lunch ? '星星' : '撐到', $('st-wave').textContent]];
    showCard(Records.card({ profile: game.profile, kidCanvas: kidCanvas(), stickers: Ach.count(), stars: totalStars(), worn: wornLabels(), round: { title: $('over-title').textContent, lines }, broken: game.recordBroken || [] }));
  });
  // moving code: everything under this ID packed into one string (deflated when the browser can), also as a QR that opens the game with ?move=
  const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = (str) => { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const bin = atob(str), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  const encode = async (obj) => { const bytes = new TextEncoder().encode(JSON.stringify(obj)); if (typeof CompressionStream === 'function') { try { const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(bytes); w.close(); return 'D' + b64(new Uint8Array(await new Response(cs.readable).arrayBuffer())); } catch (e) { /* fall through */ } } return 'P' + b64(bytes); };
  const decode = async (code) => { code = (code || '').trim(); const bytes = unb64(code.slice(1)); if (code[0] === 'D') { const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(bytes); w.close(); return JSON.parse(await new Response(ds.readable).text()); } if (code[0] === 'P') return JSON.parse(new TextDecoder().decode(bytes)); throw new Error('bad code'); };
  const importCode = async (code, quiet = false) => {
    let d; try { d = await decode(code); } catch (e) { if (!quiet) $('move-status').textContent = '這串代碼讀不出來，再貼一次'; return false; }
    const id = Profile.clean(d.id || ''); if (!Profile.valid(id)) { if (!quiet) $('move-status').textContent = '代碼裡沒有 ID'; return false; }
    if (!window.confirm(`要把 ID ${id} 的紀錄搬進這台裝置嗎？這台上 ${id} 原本的資料會被蓋掉。`)) return false;
    Profile.restore(d); gate.hidden = true; refreshAll(); while (afterId.length) afterId.shift()(); $('move-status').textContent = `搬好了，現在是 ${id}`; return true;
  };
  $('btn-rec-move').addEventListener('click', async () => {
    $('records').hidden = true; $('move').hidden = false; $('move-status').textContent = ''; $('move-in').value = '';
    const code = await encode(Profile.dump()); $('move-code').value = code;
    const url = `${siteUrl}?move=${code}`, fits = url.length <= 1800 && import.meta.env.VITE_SOLO_ONLY !== '1' && /^https?:/.test(location.protocol);
    $('qr-move-wrap').hidden = !fits; if (fits) drawQr('qr-move', url); $('move-note').textContent = fits ? '另一台手機掃這個 QR，或把上面的代碼貼到另一台的「貼上代碼」。' : '代碼太長畫不成 QR，把上面的代碼複製到另一台的「貼上代碼」。';
  });
  $('btn-move-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('move-code').value); $('move-status').textContent = '複製好了'; } catch (e) { $('move-code').select(); $('move-status').textContent = '全選後自己複製'; } });
  $('btn-move-in').addEventListener('click', () => importCode($('move-in').value));
  $('btn-move-close').addEventListener('click', () => { $('move').hidden = true; });
  // opened from a moving QR: import first, then the ID is set by it
  if (q.get('id') && !Profile.id && Profile.valid(Profile.clean(q.get('id')))) Profile.set(Profile.clean(q.get('id'))); // ?id=XYZ skips the gate (debug and test links)
  const mv = q.get('move');
  if (mv) importCode(mv, true).then((ok) => { if (!ok && !Profile.id) showGate(false); try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ } });
  else if (!Profile.id) showGate(false);
  if (Profile.id) { refreshAll(); while (afterId.length) afterId.shift()(); }
}
