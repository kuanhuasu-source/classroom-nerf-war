// A transport moves strings between a host and its guests. Messages carry the sender's id on the
// way in and an optional recipient on the way out (undefined = everyone).
// QueueTransport is for tests and the in-page fake link; PeerTransport (PeerJS) is the real one.
export class QueueTransport {
  constructor(id = 'peer') { this.id = id; this.outbox = []; this.handlers = []; this.closed = false; }
  get open() { return !this.closed; }
  get count() { return 1; }
  send(str, to) { if (!this.closed) this.outbox.push({ to: to || null, from: this.id, str }); }
  onMessage(fn) { this.handlers.push(fn); }
  receive(str, from = 'peer') { for (const h of this.handlers) h(str, from); }
  drain() { const o = this.outbox; this.outbox = []; return o; }
  close() { this.closed = true; }
}
