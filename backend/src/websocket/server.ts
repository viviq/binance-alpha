import WebSocket from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger';
import { dbService } from '../database/dbService';
import { messageQueue, CHANNELS } from '../services/messageQueue';
import { WebSocketMessage } from '../types';

export class WebSocketServer {
  private wss: WebSocket.Server;
  private clients: Set<WebSocket> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;
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

    // 启动定时更新
    this.startPeriodicUpdates();

    // 启动心跳检测
    this.startHeartbeat();
  }

  // 订阅Redis消息队列
  private async subscribeToRedis(): Promise<void> {
    try {
      // 订阅价格更新
      await messageQueue.subscribe(CHANNELS.PRICE_UPDATE, (data) => {
        this.broadcastToAll({
          type: 'data_update',
          data: data.data,
          timestamp: data.timestamp
        });
      });

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

      // 订阅数据同步事件
      await messageQueue.subscribe(CHANNELS.DATA_SYNC, async (data) => {
        // 当数据同步时，向所有客户端发送最新数据
        const coins = await dbService.getAllCoins();
        this.broadcastToAll({
          type: 'data_update',
          data: coins,
          timestamp: new Date().toISOString()
        });
      });

      logger.info('WebSocket已订阅Redis消息队列');
    } catch (error) {
      logger.error('订阅Redis消息队列失败:', error);
    }
  }

  private async sendInitialData(ws: WebSocket): Promise<void> {
    try {
      const coins = await dbService.getAllCoins();
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
        // 处理心跳
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
        break;
      default:
        logger.warn('未知的WebSocket消息类型:', message.type);
    }
  }

  private startPeriodicUpdates(): void {
    // 每1分钟发送一次数据更新
    this.updateInterval = setInterval(async () => {
      await this.broadcastDataUpdate();
    }, 60000);
  }

  // 启动心跳检测
  private startHeartbeat(): void {
    // 每30秒检测一次连接状态
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((ws) => {
        if (ws.readyState !== WebSocket.OPEN) {
          logger.info('清理断开的WebSocket连接');
          this.clients.delete(ws);
        } else {
          // 发送 ping 帧保持连接活跃
          try {
            ws.ping();
          } catch (error) {
            logger.error('发送ping失败:', error);
            this.clients.delete(ws);
          }
        }
      });
      logger.info(`当前活跃WebSocket连接数: ${this.clients.size}`);
    }, 30000);
  }

  private async broadcastDataUpdate(): Promise<void> {
    if (this.clients.size === 0) {
      return;
    }

    try {
      const coins = await dbService.getAllCoins();
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

  // 向所有客户端广播消息
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

  // 广播新币对上线通知
  public async broadcastNewCoin(coinData: any): Promise<void> {
    const message: WebSocketMessage = {
      type: 'new_coin',
      data: coinData,
      timestamp: new Date().toISOString()
    };

    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });

    logger.info(`广播新币对上线通知: ${coinData.symbol}`);
  }

  // 广播合约上线通知
  public async broadcastNewFutures(coinData: any): Promise<void> {
    const message: WebSocketMessage = {
      type: 'new_futures',
      data: coinData,
      timestamp: new Date().toISOString()
    };

    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });

    logger.info(`广播合约上线通知: ${coinData.symbol}`);
  }

  // 获取连接状态
  public getStatus(): { connectedClients: number } {
    return {
      connectedClients: this.clients.size
    };
  }

  // 关闭WebSocket服务器
  public close(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

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