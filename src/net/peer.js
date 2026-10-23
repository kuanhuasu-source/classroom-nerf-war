import { Peer } from 'peerjs';

// Room codes: four letters, no I/O so nobody mistakes them for 1/0.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PREFIX = 'classroom-nerf-war-';
export function roomCode() { let s = ''; for (let i = 0; i < 4; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)]; return s; }
export function normalizeCode(s) { return (s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); }

// PeerJS star transport: the host keeps one connection per guest, a guest has one connection to the host.
// Status events: 'listening' (host is waiting), 'connecting', 'open' (info = connection id),
// 'closed' (info = connection id), 'error' (with a reason)
export class PeerTransport {
  constructor(peerOpts = null) {
    this.peerOpts = peerOpts; this.peer = null; this.conns = new Map(); // id -> DataConnection
    this.handlers = []; this.statusHandlers = []; this.closed = false; this.role = null; this.code = null;
    this.beat = null;
  }
  onMessage(fn) { this.handlers.push(fn); }
  onStatus(fn) { this.statusHandlers.push(fn); }
  emit(status, info) { for (const h of this.statusHandlers) h(status, info); }
  send(str, to) {
    for (const [id, c] of this.conns) { if (to && id !== to) continue; if (c.open) { try { c.send(str); } catch (e) { /* dropped */ } } }
  }
  get open() { for (const c of this.conns.values()) if (c.open) return true; return false; }
  get count() { let n = 0; for (const c of this.conns.values()) if (c.open) n++; return n; }
  makePeer(id) {
    const p = this.peerOpts ? new Peer(id, this.peerOpts) : new Peer(id);
    p.on('error', err => this.emit('error', this.reason(err)));
    p.on('disconnected', () => { if (!this.closed) { try { p.reconnect(); } catch (e) { /* ignore */ } } });
    return p;
  }
  reason(err) {
    const t = err && err.type;
    if (t === 'peer-unavailable') return '找不到這個房號';
    if (t === 'unavailable-id') return '這個房號剛好有人在用，再開一次';
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return '連不上連線伺服器，檢查網路';
    if (t === 'browser-incompatible') return '這個瀏覽器不支援點對點連線';
    return '連線錯誤：' + (err && err.message ? err.message : t || '未知');
  }
  host(code) {
    this.role = 'host'; this.code = code;
    this.peer = this.makePeer(PREFIX + code);
    this.peer.on('open', () => this.emit('listening', code));
    this.peer.on('connection', c => this.attach(c)); // every guest gets its own connection; the game sorts out who is who
  }
  join(code) {
    this.role = 'guest'; this.code = code; this.emit('connecting', code);
    this.peer = this.makePeer(undefined);
    this.peer.on('open', () => {
      const c = this.peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      this.attach(c);
    });
  }
  attach(c) {
    const id = this.role === 'guest' ? 'host' : c.peer + '#' + (++PeerTransport.seq);
    c.lastRecv = performance.now(); this.conns.set(id, c);
    const opened = () => { c.lastRecv = performance.now(); this.startHeartbeat(); this.emit('open', id); };
    c.on('open', opened);
    c.on('data', d => { c.lastRecv = performance.now(); if (d === 'ping' || (d && d.t === 'ping')) return; const s = typeof d === 'string' ? d : JSON.stringify(d); for (const h of this.handlers) h(s, id); });
    c.on('close', () => this.dropped(id));
    c.on('error', err => this.emit('error', this.reason(err)));
    if (c.open) opened();
  }
  // WebRTC can take a long time to notice the other side is gone, so we ping every second
  startHeartbeat() {
    if (this.beat) return;
    this.beat = setInterval(() => {
      for (const [id, c] of this.conns) {
        if (performance.now() - c.lastRecv > 5000) { this.dropped(id); try { c.close(); } catch (e) { /* ignore */ } continue; }
        if (c.open) { try { c.send('ping'); } catch (e) { /* ignore */ } }
      }
    }, 1000);
  }
  dropped(id) { if (this.conns.has(id)) { this.conns.delete(id); this.emit('closed', id); } }
  close() { this.closed = true; clearInterval(this.beat); this.beat = null; for (const c of this.conns.values()) { try { c.close(); } catch (e) { /* ignore */ } } this.conns.clear(); try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ } }
}
PeerTransport.seq = 0;
