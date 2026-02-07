/**
 * [INPUT]: 无外部依赖，纯 IndexedDB 封装
 * [OUTPUT]: 对外提供 SessionHistoryDB 单例，包含 saveMessage、getMessages、clearHistory 方法
 * [POS]: services/storage/ 的会话流历史持久化模块
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const DB_NAME = "EdenSessionHistory";
const DB_VERSION = 2;
const STORE_NAME = "messages";

/**
 * IndexedDB 会话流历史数据库
 * Schema:
 * - id: 自增主键
 * - sessionId: 会话 ID（用于分组不同的会话流）
 * - topicTitle: 话题标题
 * - round: 当前讨论轮次
 * - role: 'user' | 'agent' | 'moderator'
 * - agentId: Agent ID（如 'bob', 'carol'）
 * - name: 发言者名称
 * - avatar: 发言者头像（emoji）
 * - content: 消息内容
 * - mentions: @提及的 Agent IDs 数组
 * - timestamp: 时间戳（ISO string）
 * - createdAt: 创建时间（用于排序）
 */
class SessionHistoryDB {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  /**
   * 初始化数据库
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 创建 messages 对象存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });

          // 创建索引：按会话 ID 查询
          store.createIndex("sessionId", "sessionId", { unique: false });
          // 创建索引：按创建时间排序
          store.createIndex("createdAt", "createdAt", { unique: false });
          // 创建索引：按会话 + 时间复合查询
          store.createIndex("sessionId_createdAt", ["sessionId", "createdAt"], { unique: false });
        }
      };
    });
  }

  /**
   * 保存消息到数据库
   * @param {Object} message - 消息对象
   * @param {string} sessionId - 会话 ID（默认 'default'）
   */
  async saveMessage(message, sessionId = "default") {
    await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const messageWithMeta = {
        sessionId,
        createdAt: Date.now(),
        ...message,
      };

      // 使用 put 代替 add，支持更新现有消息
      const request = store.put(messageWithMeta);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 批量保存消息（用于初始化历史数据）
   * @param {Array} messages - 消息数组
   * @param {string} sessionId - 会话 ID
   */
  async saveMessages(messages, sessionId = "default") {
    await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      let completed = 0;
      const errors = [];

      messages.forEach((message, index) => {
        const messageWithMeta = {
          sessionId,
          createdAt: Date.now() + index, // 保证顺序
          ...message,
        };

        const request = store.put(messageWithMeta);
        request.onsuccess = () => {
          completed++;
          if (completed === messages.length) {
            resolve({ success: completed, errors });
          }
        };
        request.onerror = () => {
          errors.push(request.error);
          completed++;
          if (completed === messages.length) {
            resolve({ success: completed - errors.length, errors });
          }
        };
      });
    });
  }

  /**
   * 获取消息列表
   * @param {string} sessionId - 会话 ID（默认 'default'）
   * @param {Object} options - 查询选项 { limit, offset }
   */
  async getMessages(sessionId = "default", options = {}) {
    await this.initPromise;

    const { limit = 100, offset = 0 } = options;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("sessionId_createdAt");

      const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Date.now()]);
      const request = index.openCursor(range);

      const messages = [];
      let skipped = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
          if (skipped < offset) {
            skipped++;
            cursor.continue();
            return;
          }

          if (messages.length < limit) {
            messages.push(cursor.value);
            cursor.continue();
          } else {
            resolve(messages);
          }
        } else {
          resolve(messages);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取消息总数
   * @param {string} sessionId - 会话 ID
   */
  async getMessageCount(sessionId = "default") {
    await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("sessionId");

      const request = index.count(sessionId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清空指定会话的历史记录
   * @param {string} sessionId - 会话 ID
   */
  async clearHistory(sessionId = "default") {
    await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("sessionId");

      const request = index.openCursor(IDBKeyRange.only(sessionId));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清空所有历史记录
   */
  async clearAll() {
    await this.initPromise;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// 导出单例
export const sessionHistoryDB = new SessionHistoryDB();
