// Link quality as seen from one end: round trip, snapshot rate and jitter, bytes in/out, lost or stale snapshots,
// and the clock offset to the host that the interpolation buffer needs.
export class NetStats {
  constructor() { this.reset(); }
  reset() {
    this.rtt = 0; this.offset = null; this.jitter = 0; this.meanIv = 1000 / 15; this.lastArrival = 0; this.ivs = [];
    this.bytesIn = 0; this.bytesOut = 0; this.kbIn = 0; this.kbOut = 0; this.snaps = 0; this.snapHz = 0; this.lost = 0; this.stale = 0; this.lastSeq = -1;
    this.acc = 0; this.delay = 130; this.peers = {};
  }
  // a snapshot arrived; false = older than one we already applied (unordered channel), drop it
  onSnapshot(seq, ts, now) {
    if (seq <= this.lastSeq) { this.stale++; return false; }
    if (this.lastSeq >= 0 && seq > this.lastSeq + 1) this.lost += seq - this.lastSeq - 1;
    this.lastSeq = seq;
    // host clock minus local clock, tracked on the fastest packets (later packets only push it down)
    const off = ts - now; this.offset = this.offset === null ? off : Math.max(off, this.offset - 1);
    if (this.lastArrival) { this.ivs.push(now - this.lastArrival); if (this.ivs.length > 30) this.ivs.shift(); }
    this.lastArrival = now; this.snaps++;
    if (this.ivs.length >= 3) { const m = this.ivs.reduce((a, b) => a + b, 0) / this.ivs.length; this.meanIv = m; this.jitter = Math.sqrt(this.ivs.reduce((a, b) => a + (b - m) ** 2, 0) / this.ivs.length); }
    this.delay = Math.min(350, Math.max(80, this.meanIv * 2 + this.jitter * 2));
    return true;
  }
  onPong(sentAt, now) { const r = now - sentAt; this.rtt = this.rtt ? this.rtt * 0.7 + r * 0.3 : r; }
  toLocal(hostTs) { return hostTs - (this.offset || 0); }
  // once a second: turn byte counters into rates; returns true on the second boundary
  tick(dt) {
    this.acc += dt; if (this.acc < 1) return false;
    this.kbIn = this.bytesIn / this.acc / 1024; this.kbOut = this.bytesOut / this.acc / 1024; this.snapHz = this.snaps / this.acc;
    this.bytesIn = this.bytesOut = 0; this.snaps = 0; this.acc = 0; return true;
  }
  guestText() { return `往返 ${Math.round(this.rtt)} ms・快照 ${this.snapHz.toFixed(0)} Hz・抖動 ${this.jitter.toFixed(0)} ms・緩衝 ${this.delay.toFixed(0)} ms・掉 ${this.lost}・收 ${this.kbIn.toFixed(1)} KB/s`; }
  hostText(names) { const ps = Object.entries(this.peers).map(([slot, r]) => `${names[slot] || slot} ${Math.round(r)} ms`); return `送 ${this.kbOut.toFixed(1)} KB/s・收 ${this.kbIn.toFixed(1)} KB/s` + (ps.length ? '・' + ps.join('・') : ''); }
}
