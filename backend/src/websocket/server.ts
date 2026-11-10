import WebSocket from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger';
import { messageQueue, CHANNELS } from '../services/messageQueue';
import { getCoinsCached } from '../services/coinCache';
import { WebSocketMessage } from '../types';

// 心跳间隔：每轮发送 ping，上一轮没有回 pong 的连接视为已断开
const HEARTBEAT_INTERVAL_MS = 30000;

export class WebSocketServer {
  private wss: WebSocket.Server;
  private clients: Set<WebSocket> = new Set();
  private alive: WeakMap<WebSocket, boolean> = new WeakMap();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WebSocket.Server({ server });
    this.setupWebSocketServer();
    this.subscribeToRedis();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('新的WebSocket连接建立');
      this.clients.add(ws);
      this.alive.set(ws, true);

      ws.on('pong', () => {
        this.alive.set(ws, true);
      });

      // 发送初始数据
      this.sendInitialData(ws);

      // 处理客户端消息
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(ws, data);
        } catch (error) {
          logger.error('解析WebSocket消息失败:', error);
        }
      });

      // 处理连接关闭
      ws.on('close', () => {
        logger.info('WebSocket连接关闭');
        this.clients.delete(ws);
      });

      // 处理连接错误
      ws.on('error', (error) => {
        logger.error('WebSocket连接错误:', error);
        this.clients.delete(ws);
      });
    });

    // 启动心跳检测
    this.startHeartbeat();
  }

  // 订阅Redis消息队列
  private async subscribeToRedis(): Promise<void> {
    try {
      // 订阅新币种上线
      await messageQueue.subscribe(CHANNELS.NEW_COIN, (data) => {
        this.broadcastToAll({
          type: 'new_coin',
          data: data.data,
          timestamp: data.timestamp
        });
      });

      // 订阅新合约上线
      await messageQueue.subscribe(CHANNELS.NEW_FUTURES, (data) => {
        this.broadcastToAll({
          type: 'new_futures',
          data: data.data,
          timestamp: data.timestamp
        });
      });

      // 每轮采集完成后推送一次最新全量数据（与 REST /api/coins 同源）
      await messageQueue.subscribe(CHANNELS.DATA_SYNC, () => {
        this.broadcastDataUpdate();
      });

      logger.info('WebSocket已订阅Redis消息队列');
    } catch (error) {
      logger.error('订阅Redis消息队列失败:', error);
    }
  }

  private async sendInitialData(ws: WebSocket): Promise<void> {
    try {
      const coins = await getCoinsCached();
      const message: WebSocketMessage = {
        type: 'initial_data',
        data: coins,
        timestamp: new Date().toISOString()
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      logger.error('发送初始数据失败:', error);
    }
  }

  private handleClientMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'subscribe':
        // 处理订阅请求
        logger.info(`客户端订阅: ${message.data}`);
        break;
      case 'unsubscribe':
        // 处理取消订阅请求
        logger.info(`客户端取消订阅: ${message.data}`);
        break;
      case 'ping':
        // 应用层心跳，同时视为连接存活
        this.alive.set(ws, true);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
        break;
      default:
        logger.warn('未知的WebSocket消息类型:', message.type);
    }
  }

  // 启动心跳检测：终止上一轮未响应的连接（包括没有正常关闭的半开连接）
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      let terminated = 0;

      this.clients.forEach((ws) => {
        if (ws.readyState !== WebSocket.OPEN || this.alive.get(ws) === false) {
          this.clients.delete(ws);
          ws.terminate();
          terminated++;
          return;
        }

        this.alive.set(ws, false);
        try {
          ws.ping();
        } catch (error) {
          logger.error('发送ping失败:', error);
          this.clients.delete(ws);
          ws.terminate();
          terminated++;
        }
      });

      if (terminated > 0) {
        logger.info(`清理了 ${terminated} 个无响应的WebSocket连接`);
      }
      logger.debug(`当前活跃WebSocket连接数: ${this.clients.size}`);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private async broadcastDataUpdate(): Promise<void> {
    if (this.clients.size === 0) {
      return;
    }

    try {
      const coins = await getCoinsCached();
      const message: WebSocketMessage = {
        type: 'data_update',
        data: coins,
        timestamp: new Date().toISOString()
      };

      this.broadcastToAll(message);
      logger.info(`向 ${this.clients.size} 个客户端广播数据更新`);
    } catch (error) {
      logger.error('广播数据更新失败:', error);
    }
  }

  // 向所有客户端广播消息（只序列化一次）
  private broadcastToAll(message: WebSocketMessage | any): void {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      } else {
        // 清理已断开的连接
        this.clients.delete(ws);
      }
    });
  }

  // 获取连接状态
  public getStatus(): { connectedClients: number } {
    return {
      connectedClients: this.clients.size
    };
  }

  // 关闭WebSocket服务器
  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.clients.forEach((ws) => {
      ws.close();
    });

    this.wss.close();
    logger.info('WebSocket服务器已关闭');
  }
}
