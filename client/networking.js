(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** WebSocket wrapper: JSON messages, ping/RTT measurement, automatic reconnect with backoff. */
  class Net {
    constructor(url) { this.url = url; this.ws = null; this.handlers = {}; this.ping = 0; this.open = false; this.retry = 0; this.wantOpen = false; this.bytesIn = 0; this.msgsIn = 0; }
    on(type, fn) { this.handlers[type] = fn; return this; }
    connect() {
      this.wantOpen = true;
      const ws = (this.ws = new WebSocket(this.url));
      ws.onopen = () => { this.open = true; this.retry = 0; this._pinger = setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 2000); this.handlers.open && this.handlers.open(); };
      ws.onmessage = (ev) => {
        this.bytesIn += ev.data.length; this.msgsIn++;
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'pong') { this.ping = Math.round(performance.now() - m.ts); return; }
        const h = this.handlers[m.t]; if (h) h(m);
      };
      ws.onclose = () => {
        this.open = false; clearInterval(this._pinger);
        this.handlers.close && this.handlers.close();
        if (this.wantOpen) setTimeout(() => this.connect(), Math.min(5000, 400 * Math.pow(2, this.retry++)));
      };
      ws.onerror = () => {};
    }
    send(o) { if (this.open) this.ws.send(JSON.stringify(o)); }
    close() { this.wantOpen = false; if (this.ws) this.ws.close(); }
  }
  M.Net = Net;
  if (typeof module !== 'undefined') module.exports = { Net };
})(typeof window !== 'undefined' ? window : globalThis);
