import { Peer } from 'peerjs';

// Room codes: four letters, no I/O so nobody mistakes them for 1/0.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PREFIX = 'classroom-nerf-war-';
export function roomCode() { let s = ''; for (let i = 0; i < 4; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)]; return s; }
export function normalizeCode(s) { return (s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); }

// PeerJS point-to-point transport. One host, one guest. Status events:
//   'listening' (host is waiting), 'connecting', 'open', 'closed', 'error' (with a reason)
export class PeerTransport {
  constructor(peerOpts = null) {
    this.peerOpts = peerOpts; this.peer = null; this.conn = null;
    this.handlers = []; this.statusHandlers = []; this.closed = false; this.role = null; this.code = null;
    this.lastRecv = 0; this.beat = null;
  }
  onMessage(fn) { this.handlers.push(fn); }
  onStatus(fn) { this.statusHandlers.push(fn); }
  emit(status, info) { for (const h of this.statusHandlers) h(status, info); }
  send(str) { if (this.conn && this.conn.open) { try { this.conn.send(str); } catch (e) { /* dropped */ } } }
  get open() { return !!(this.conn && this.conn.open); }
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
    this.peer.on('connection', c => {
      // a second connection replaces the first (that is how a guest reconnects)
      if (this.conn && this.conn !== c) { try { this.conn.close(); } catch (e) { /* ignore */ } }
      this.attach(c);
    });
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
    this.conn = c; this.lastRecv = performance.now();
    const opened = () => { this.lastRecv = performance.now(); this.startHeartbeat(); this.emit('open'); };
    c.on('open', opened);
    c.on('data', d => { this.lastRecv = performance.now(); if (d === 'ping' || (d && d.t === 'ping')) return; const s = typeof d === 'string' ? d : JSON.stringify(d); for (const h of this.handlers) h(s); });
    c.on('close', () => this.dropped(c));
    c.on('error', err => this.emit('error', this.reason(err)));
    if (c.open) opened();
  }
  // WebRTC can take a long time to notice the other side is gone, so we ping every second
  startHeartbeat() {
    clearInterval(this.beat);
    this.beat = setInterval(() => {
      const c = this.conn; if (!c) { clearInterval(this.beat); return; }
      if (performance.now() - this.lastRecv > 5000) { this.dropped(c); try { c.close(); } catch (e) { /* ignore */ } return; }
      if (c.open) { try { c.send('ping'); } catch (e) { /* ignore */ } }
    }, 1000);
  }
  dropped(c) { if (this.conn === c) { this.conn = null; clearInterval(this.beat); this.emit('closed'); } }
  close() { this.closed = true; clearInterval(this.beat); try { if (this.conn) this.conn.close(); } catch (e) { /* ignore */ } try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ } }
}
