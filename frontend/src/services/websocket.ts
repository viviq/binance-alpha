import { WebSocketMessage } from '../types';

export type WebSocketEventHandler = (data: any) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectInterval: number = 5000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();

  constructor(url?: string) {
    // 优先使用环境变量中的 WebSocket URL
    if (url) {
      this.url = url;
    } else if (process.env.REACT_APP_WS_URL) {
      this.url = process.env.REACT_APP_WS_URL;
    } else if (process.env.REACT_APP_API_URL) {
      // 从 API URL 推断 WebSocket URL
      const apiUrl = process.env.REACT_APP_API_URL.replace('/api', '');
      this.url = apiUrl.replace(/^http/, 'ws') + '/ws';
    } else {
      // 使用当前页面的协议和主机名，通过nginx代理WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.url = `${protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/ws`;
    }
  }

  // 连接WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket连接已建立');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected', null);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('解析WebSocket消息失败:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket连接已关闭:', event.code, event.reason);
          this.stopHeartbeat();
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket连接错误:', error);
          this.emit('error', error);
          reject(new Error(`WebSocket连接失败: ${error.type || '未知错误'}`));
        };

      } catch (error) {
        console.error('创建WebSocket连接失败:', error);
        reject(error);
      }
    });
  }

  // 断开连接
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, '主动断开连接');
      this.ws = null;
    }
    this.stopHeartbeat();
  }

  // 发送消息
  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket未连接，无法发送消息');
    }
  }

  // 订阅事件
  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  // 取消订阅事件
  off(event: string, handler?: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      return;
    }

    if (handler) {
      const handlers = this.eventHandlers.get(event)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      this.eventHandlers.delete(event);
    }
  }

  // 触发事件
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`事件处理器执行失败 (${event}):`, error);
        }
      });
    }
  }

  // 处理WebSocket消息
  private handleMessage(message: WebSocketMessage): void {
    console.log('收到WebSocket消息:', message.type);

    switch (message.type) {
      case 'initial_data':
        this.emit('initialData', message.data);
        break;
      case 'data_update':
        this.emit('dataUpdate', message.data);
        break;
      case 'new_coin':
        this.emit('newCoin', message.data);
        break;
      case 'new_futures':
        this.emit('newFutures', message.data);
        break;
      case 'error':
        this.emit('error', message.data);
        break;
      case 'pong':
        // 心跳响应，不需要特殊处理
        break;
      default:
        console.warn('未知的WebSocket消息类型:', message.type);
    }
  }

  // 开始心跳
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping', timestamp: new Date().toISOString() });
    }, 60000); // 每1分钟发送一次心跳
  }

  // 停止心跳
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 安排重连（使用指数退避策略）
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    // 指数退避：delay = min(baseInterval * 2^attempts, maxDelay)
    const backoffDelay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // 最大延迟 30 秒
    );

    console.log(`将在 ${backoffDelay}ms 后重连`);

    setTimeout(() => {
      this.connect().catch(error => {
        console.error('重连失败:', error);
      });
    }, backoffDelay);
  }

  // 获取连接状态
  getConnectionState(): number {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }

  // 检查是否已连接
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// 创建全局WebSocket服务实例
export const wsService = new WebSocketService();