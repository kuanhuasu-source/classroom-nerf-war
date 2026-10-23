// A transport moves strings between the two ends of a game.
// QueueTransport is for tests and the in-page fake link; PeerTransport (PeerJS) comes next.
export class QueueTransport {
  constructor() { this.outbox = []; this.handlers = []; this.closed = false; }
  get open() { return !this.closed; }
  send(str) { if (!this.closed) this.outbox.push(str); }
  onMessage(fn) { this.handlers.push(fn); }
  receive(str) { for (const h of this.handlers) h(str); }
  drain() { const o = this.outbox; this.outbox = []; return o; }
  close() { this.closed = true; }
}
