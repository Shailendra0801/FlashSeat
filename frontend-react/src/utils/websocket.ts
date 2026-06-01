import { API_BASE } from '../utils/constants';

type WsMessageHandler = (data: any) => void;

export class SeatWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessage: WsMessageHandler;
  private onClose: () => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  constructor(
    eventId: string,
    sessionId: string,
    onMessage: WsMessageHandler,
    onClose: () => void
  ) {
    // Build WS URL from HTTP base
    const wsBase = API_BASE.replace(/^http/, 'ws');
    this.url = `${wsBase}/ws/events/${eventId}/seats?session_id=${sessionId}`;
    this.onMessage = onMessage;
    this.onClose = onClose;
  }

  get connected() {
    return this._connected;
  }

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.url);

        const timeout = setTimeout(() => {
          // If not open within 3s, consider it failed
          if (!this._connected) {
            this.ws?.close();
            resolve(false);
          }
        }, 3000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this._connected = true;
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.onMessage(data);
          } catch {}
        };

        this.ws.onclose = () => {
          this._connected = false;
          this.onClose();
        };

        this.ws.onerror = () => {
          clearTimeout(timeout);
          this._connected = false;
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }
}
