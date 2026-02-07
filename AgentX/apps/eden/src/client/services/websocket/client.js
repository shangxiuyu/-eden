/**
 * [INPUT]: 依赖原生 WebSocket API
 * [OUTPUT]: 对外提供 EdenWebSocket 类、useWebSocket hook
 * [POS]: services/websocket 的核心连接器，被所有需要实时通信的模块消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const DEFAULT_OPTIONS = {
  url: "ws://localhost:5200",
  reconnectInterval: 3000,
  heartbeatInterval: 30000,
};

export class EdenWebSocket {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.isManualClose = false;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.options.url);
    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (e) => this.handleMessage(e);
    this.ws.onerror = (e) => this.handleError(e);
    this.ws.onclose = () => this.handleClose();
  }

  disconnect() {
    this.isManualClose = true;
    this.clearTimers();
    this.ws?.close();
  }

  send(event, data) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("[EdenWS] Cannot send, connection not open");
      return;
    }
    this.ws.send(JSON.stringify({ event, data }));
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    const index = cbs.indexOf(callback);
    if (index > -1) cbs.splice(index, 1);
  }

  handleOpen() {
    console.log("[EdenWS] Connected");
    this.emit("connected");
    this.startHeartbeat();
  }

  handleMessage(e) {
    try {
      const { event, data } = JSON.parse(e.data);
      this.emit(event, data);
    } catch (err) {
      console.error("[EdenWS] Parse error:", err);
    }
  }

  handleError(e) {
    console.error("[EdenWS] Error:", e);
    this.emit("error", e);
  }

  handleClose() {
    console.log("[EdenWS] Disconnected");
    this.emit("disconnected");
    this.clearTimers();
    if (!this.isManualClose) this.reconnect();
  }

  reconnect() {
    this.reconnectTimer = setTimeout(() => {
      console.log("[EdenWS] Reconnecting...");
      this.connect();
    }, this.options.reconnectInterval);
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.send("ping", { timestamp: Date.now() });
    }, this.options.heartbeatInterval);
  }

  clearTimers() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeatTimer);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}
