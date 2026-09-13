// Minimal RFC 6455 WebSocket server built on Node's http module.
//
// Written by hand rather than pulling in `ws` so that running a Fount server
// needs nothing but Node itself — no npm install, no lockfile, no supply
// chain. The subset implemented here is what a game needs: text frames,
// fragmentation, ping/pong keepalive and a clean close handshake.

import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OP_CONTINUATION = 0x0;
const OP_TEXT = 0x1;
const OP_BINARY = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xa;

// A game message is small; anything larger is malformed or hostile.
const MAX_MESSAGE_BYTES = 512 * 1024;

export class WebSocketConnection {
  constructor(socket, request) {
    this.socket = socket;
    this.request = request;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentOpcode = null;
    this.closed = false;
    this.isAlive = true;
    this.handlers = { message: [], close: [], error: [] };

    // X-Forwarded-For matters because a public deployment usually sits behind
    // a proxy, and otherwise every player looks like they came from 127.0.0.1.
    const forwarded = request.headers['x-forwarded-for'];
    this.remoteAddress = forwarded
      ? String(forwarded).split(',')[0].trim()
      : socket.remoteAddress;

    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => this.finish());
    socket.on('error', (err) => {
      this.emit('error', err);
      this.finish();
    });
    socket.setTimeout(0);
    socket.setNoDelay(true);
  }

  on(event, fn) {
    if (this.handlers[event]) this.handlers[event].push(fn);
    return this;
  }

  emit(event, ...args) {
    for (const fn of this.handlers[event] || []) {
      try { fn(...args); } catch (err) { console.error('[ws] handler error:', err.message); }
    }
  }

  onData(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    // TCP gives no message boundaries, so keep pulling frames until the
    // buffer holds only a partial one.
    while (!this.closed) {
      const frame = this.readFrame();
      if (!frame) break;
      this.handleFrame(frame);
    }
  }

  readFrame() {
    const buf = this.buffer;
    if (buf.length < 2) return null;

    const first = buf[0];
    const second = buf[1];
    const fin = (first & 0x80) !== 0;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (buf.length < offset + 2) return null;
      length = buf.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (buf.length < offset + 8) return null;
      const big = buf.readBigUInt64BE(offset);
      if (big > BigInt(MAX_MESSAGE_BYTES)) {
        this.close(1009, 'message too large');
        return null;
      }
      length = Number(big);
      offset += 8;
    }

    if (length > MAX_MESSAGE_BYTES) {
      this.close(1009, 'message too large');
      return null;
    }

    let mask = null;
    if (masked) {
      if (buf.length < offset + 4) return null;
      mask = buf.subarray(offset, offset + 4);
      offset += 4;
    }

    if (buf.length < offset + length) return null;

    const payload = Buffer.from(buf.subarray(offset, offset + length));
    if (mask) {
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    }

    this.buffer = buf.subarray(offset + length);
    return { fin, opcode, payload };
  }

  handleFrame(frame) {
    const { fin, opcode, payload } = frame;

    if (opcode === OP_CLOSE) {
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1005;
      this.close(code === 1005 ? 1000 : code, '');
      return;
    }
    if (opcode === OP_PING) {
      this.sendFrame(OP_PONG, payload);
      return;
    }
    if (opcode === OP_PONG) {
      this.isAlive = true;
      // Round-trip time, measured where it is cheapest to measure: the
      // keepalive already runs, so latency costs no extra protocol traffic.
      // The server uses it to size how far it rewinds players when checking a
      // shot, so it has to come from the transport rather than from the client.
      if (this.pingSentAt) {
        const sample = Date.now() - this.pingSentAt;
        this.latencyMs = this.latencyMs == null ? sample : this.latencyMs * 0.7 + sample * 0.3;
        this.pingSentAt = 0;
      }
      return;
    }

    if (opcode === OP_TEXT || opcode === OP_BINARY) {
      if (fin) {
        this.deliver(opcode, payload);
      } else {
        this.fragmentOpcode = opcode;
        this.fragments = [payload];
      }
      return;
    }

    if (opcode === OP_CONTINUATION) {
      if (this.fragmentOpcode === null) return; // continuation with no start
      this.fragments.push(payload);
      const total = this.fragments.reduce((n, b) => n + b.length, 0);
      if (total > MAX_MESSAGE_BYTES) {
        this.close(1009, 'message too large');
        return;
      }
      if (fin) {
        const joined = Buffer.concat(this.fragments);
        const op = this.fragmentOpcode;
        this.fragments = [];
        this.fragmentOpcode = null;
        this.deliver(op, joined);
      }
    }
  }

  deliver(opcode, payload) {
    if (opcode === OP_TEXT) this.emit('message', payload.toString('utf8'));
    else this.emit('message', payload);
  }

  sendFrame(opcode, payload) {
    if (this.closed || this.socket.destroyed) return;
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
    const length = data.length;

    let header;
    if (length < 126) {
      header = Buffer.alloc(2);
      header[1] = length;
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }
    header[0] = 0x80 | opcode; // FIN set; server frames are never masked

    try {
      this.socket.write(Buffer.concat([header, data]));
    } catch {
      this.finish();
    }
  }

  send(text) {
    this.sendFrame(OP_TEXT, text);
  }

  ping() {
    this.isAlive = false;
    this.pingSentAt = Date.now();
    this.sendFrame(OP_PING, Buffer.alloc(0));
  }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    const payload = Buffer.alloc(2 + Buffer.byteLength(reason));
    payload.writeUInt16BE(code, 0);
    payload.write(reason, 2);
    this.sendFrame(OP_CLOSE, payload);
    this.finish();
    try { this.socket.end(); } catch { /* already gone */ }
  }

  finish() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close');
  }
}

/**
 * Attach WebSocket upgrade handling to an existing http.Server.
 * onConnection(connection) is called once the handshake completes.
 */
export function attachWebSocketServer(httpServer, onConnection, options = {}) {
  // Frequent enough to keep the latency estimate current for lag compensation,
  // which is the reason this is 4s rather than the 15s a pure keepalive wants.
  const pingInterval = options.pingIntervalMs ?? 4000;
  const connections = new Set();

  httpServer.on('upgrade', (request, socket) => {
    const key = request.headers['sec-websocket-key'];
    const upgrade = String(request.headers.upgrade || '').toLowerCase();

    if (upgrade !== 'websocket' || !key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n'
      + 'Upgrade: websocket\r\n'
      + 'Connection: Upgrade\r\n'
      + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );

    const connection = new WebSocketConnection(socket, request);
    connections.add(connection);
    connection.on('close', () => connections.delete(connection));
    onConnection(connection);
  });

  // Drop sockets that stopped answering, so a player who pulled the plug
  // doesn't linger in the scoreboard forever. Tolerate several missed pongs
  // rather than one: pings are frequent enough to measure latency with, and at
  // that rate a single miss is a lag spike, not a departure.
  const missesAllowed = options.pingMissesAllowed ?? 3;
  const timer = setInterval(() => {
    for (const c of connections) {
      if (!c.isAlive) {
        c.pingMisses = (c.pingMisses || 0) + 1;
        if (c.pingMisses > missesAllowed) { c.close(1001, 'ping timeout'); continue; }
      } else {
        c.pingMisses = 0;
      }
      c.ping();
    }
  }, pingInterval);
  timer.unref?.();

  return {
    connections,
    broadcast(text, except = null) {
      for (const c of connections) if (c !== except) c.send(text);
    },
    stop() { clearInterval(timer); },
  };
}
