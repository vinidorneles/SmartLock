const redis = require('redis');
const logger = require('../utils/logger');

// Configurações do Redis
const redisConfig = {
  // Configurações de conexão
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
    
    // URL de conexão (alternativa aos parâmetros individuais)
    url: process.env.REDIS_URL || undefined,
    
    // Configurações de reconexão
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
    lazyConnect: true,
    keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE) || 30000,
    
    // Timeout configurations
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 5000
  },
  
  // Configurações de pool de conexões
  pool: {
    min: parseInt(process.env.REDIS_POOL_MIN) || 2,
    max: parseInt(process.env.REDIS_POOL_MAX) || 10,
    acquireTimeoutMillis: parseInt(process.env.REDIS_ACQUIRE_TIMEOUT) || 60000,
    createTimeoutMillis: parseInt(process.env.REDIS_CREATE_TIMEOUT) || 30000,
    destroyTimeoutMillis: parseInt(process.env.REDIS_DESTROY_TIMEOUT) || 5000,
    idleTimeoutMillis: parseInt(process.env.REDIS_IDLE_TIMEOUT) || 30000,
    reapIntervalMillis: parseInt(process.env.REDIS_REAP_INTERVAL) || 1000
  },
  
  // Configurações de TTL padrão (em segundos)
  defaultTTL: {
    session: parseInt(process.env.REDIS_SESSION_TTL) || 3600, // 1 hora
    cache: parseInt(process.env.REDIS_CACHE_TTL) || 1800, // 30 minutos
    qrCode: parseInt(process.env.REDIS_QR_TTL) || 300, // 5 minutos
    notification: parseInt(process.env.REDIS_NOTIFICATION_TTL) || 604800, // 7 dias
    rateLimiting: parseInt(process.env.REDIS_RATE_LIMIT_TTL) || 3600, // 1 hora
    lockStatus: parseInt(process.env.REDIS_LOCK_STATUS_TTL) || 60, // 1 minuto
    hardwareStatus: parseInt(process.env.REDIS_HARDWARE_STATUS_TTL) || 300 // 5 minutos
  },
  
  // Prefixos para organizar as chaves
  keyPrefixes: {
    session: 'session:',
    cache: 'cache:',
    qrCode: 'qr:',
    notification: 'notification:',
    rateLimiting: 'rate_limit:',
    lockStatus: 'lock_status:',
    hardwareStatus: 'hardware_status:',
    queue: 'queue:',
    pubsub: 'pubsub:',
    metrics: 'metrics:'
  },
  
  // Configurações de pub/sub
  pubsub: {
    channels: {
      LOCKER_STATUS: 'locker_status',
      HARDWARE_ALERTS: 'hardware_alerts',
      USER_NOTIFICATIONS: 'user_notifications',
      SYSTEM_EVENTS: 'system_events',
      MAINTENANCE_ALERTS: 'maintenance_alerts'
    }
  },
  
  // Configurações de rate limiting
  rateLimiting: {
    enabled: process.env.REDIS_RATE_LIMITING_ENABLED === 'true',
    
    // Limites padrão
    limits: {
      login: { max: 5, window: 900 }, // 5 tentativas em 15 minutos
      qrGeneration: { max: 10, window: 3600 }, // 10 QR codes por hora
      apiCalls: { max: 1000, window: 3600 }, // 1000 calls por hora
      hardwareCommands: { max: 100, window: 3600 }, // 100 comandos por hora
      emailSending: { max: 50, window: 3600 } // 50 emails por hora
    }
  },
  
  // Configurações de cache
  cache: {
    enabled: process.env.REDIS_CACHE_ENABLED === 'true',
    
    // Estratégias de cache
    strategies: {
      userProfile: { ttl: 3600, compress: false },
      cabinetList: { ttl: 1800, compress: true },
      lockerStatus: { ttl: 60, compress: false },
      hardwareConfig: { ttl: 7200, compress: true },
      systemSettings: { ttl: 3600, compress: false }
    }
  },
  
  // Configurações de queue (para jobs assíncronos)
  queue: {
    enabled: process.env.REDIS_QUEUE_ENABLED === 'true',
    
    // Configurações das filas
    queues: {
      email: {
        name: 'email_queue',
        concurrency: 5,
        removeOnComplete: 50,
        removeOnFail: 100
      },
      notifications: {
        name: 'notification_queue',
        concurrency: 10,
        removeOnComplete: 100,
        removeOnFail: 50
      },
      hardware: {
        name: 'hardware_queue',
        concurrency: 3,
        removeOnComplete: 20,
        removeOnFail: 50
      },
      cleanup: {
        name: 'cleanup_queue',
        concurrency: 1,
        removeOnComplete: 10,
        removeOnFail: 10
      }
    }
  }
};

// Instâncias Redis
let redisClient = null;
let redisSubscriber = null;
let redisPublisher = null;

// Função para criar cliente Redis
const createRedisClient = (options = {}) => {
  const clientOptions = {
    ...redisConfig.connection,
    ...options,
    retry_strategy: (options) => {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        logger.error('Redis server refused connection');
        return new Error('Redis server refused connection');
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        logger.error('Redis retry time exhausted');
        return new Error('Retry time exhausted');
      }
      if (options.attempt > 10) {
        logger.error('Redis max retry attempts reached');
        return undefined;
      }
      // Reconectar após delay exponencial
      return Math.min(options.attempt * 100, 3000);
    }
  };
  
  const client = redis.createClient(clientOptions);
  
  // Event listeners
  client.on('connect', () => {
    logger.info('Redis client connected');
  });
  
  client.on('ready', () => {
    logger.info('Redis client ready');
  });
  
  client.on('error', (err) => {
    logger.error('Redis client error:', err);
  });
  
  client.on('end', () => {
    logger.info('Redis client disconnected');
  });
  
  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting');
  });
  
  return client;
};

// Inicializar clientes Redis
const initializeRedis = async () => {
  try {
    // Cliente principal
    redisClient = createRedisClient();
    await redisClient.connect();
    
    // Cliente para subscriber
    redisSubscriber = createRedisClient();
    await redisSubscriber.connect();
    
    // Cliente para publisher
    redisPublisher = createRedisClient();
    await redisPublisher.connect();
    
    logger.info('All Redis clients initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Redis clients:', error);
    throw error;
  }
};

// Função para testar conexão
const testConnection = async () => {
  try {
    if (!redisClient) {
      await initializeRedis();
    }
    
    await redisClient.ping();
    logger.info('Redis connection test successful');
    return true;
  } catch (error) {
    logger.error('Redis connection test failed:', error);
    return false;
  }
};

// Utilitários para chaves
const generateKey = (prefix, ...parts) => {
  return prefix + parts.filter(Boolean).join(':');
};

// Funções de cache
const cache = {
  // Definir valor no cache
  set: async (key, value, ttl = redisConfig.defaultTTL.cache) => {
    try {
      const serializedValue = JSON.stringify(value);
      await redisClient.setEx(key, ttl, serializedValue);
      logger.debug(`Cache set: ${key}`);
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      throw error;
    }
  },
  
  // Obter valor do cache
  get: async (key) => {
    try {
      const value = await redisClient.get(key);
      if (value) {
        logger.debug(`Cache hit: ${key}`);
        return JSON.parse(value);
      }
      logger.debug(`Cache miss: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },
  
  // Deletar do cache
  del: async (key) => {
    try {
      await redisClient.del(key);
      logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  },
  
  // Verificar se existe
  exists: async (key) => {
    try {
      return await redisClient.exists(key);
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },
  
  // Definir TTL
  expire: async (key, ttl) => {
    try {
      await redisClient.expire(key, ttl);
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
    }
  },
  
  // Limpar cache por padrão
  deletePattern: async (pattern) => {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`Deleted ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }
};

// Funções de rate limiting
const rateLimiting = {
  // Verificar rate limit
  check: async (key, limit = 10, window = 3600) => {
    try {
      const current = await redisClient.incr(key);
      
      if (current === 1) {
        await redisClient.expire(key, window);
      }
      
      const remaining = Math.max(0, limit - current);
      const ttl = await redisClient.ttl(key);
      
      return {
        allowed: current <= limit,
        current,
        remaining,
        resetTime: Date.now() + (ttl * 1000)
      };
    } catch (error) {
      logger.error(`Rate limiting error for key ${key}:`, error);
      return { allowed: true, current: 0, remaining: limit, resetTime: Date.now() + (window * 1000) };
    }
  },
  
  // Resetar contador
  reset: async (key) => {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error(`Rate limiting reset error for key ${key}:`, error);
    }
  }
};

// Funções de pub/sub
const pubsub = {
  // Publicar mensagem
  publish: async (channel, message) => {
    try {
      const serializedMessage = JSON.stringify({
        timestamp: Date.now(),
        data: message
      });
      
      await redisPublisher.publish(channel, serializedMessage);
      logger.debug(`Message published to channel: ${channel}`);
    } catch (error) {
      logger.error(`Publish error for channel ${channel}:`, error);
    }
  },
  
  // Subscrever canal
  subscribe: async (channel, callback) => {
    try {
      await redisSubscriber.subscribe(channel, (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage.data, parsedMessage.timestamp);
        } catch (error) {
          logger.error(`Message parsing error for channel ${channel}:`, error);
          callback(message, Date.now());
        }
      });
      
      logger.info(`Subscribed to channel: ${channel}`);
    } catch (error) {
      logger.error(`Subscribe error for channel ${channel}:`, error);
    }
  },
  
  // Cancelar subscrição
  unsubscribe: async (channel) => {
    try {
      await redisSubscriber.unsubscribe(channel);
      logger.info(`Unsubscribed from channel: ${channel}`);
    } catch (error) {
      logger.error(`Unsubscribe error for channel ${channel}:`, error);
    }
  }
};

// Funções de sessão
const session = {
  // Criar sessão
  create: async (sessionId, userData, ttl = redisConfig.defaultTTL.session) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.session, sessionId);
      await cache.set(key, userData, ttl);
      logger.debug(`Session created: ${sessionId}`);
    } catch (error) {
      logger.error(`Session creation error for ${sessionId}:`, error);
      throw error;
    }
  },
  
  // Obter sessão
  get: async (sessionId) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.session, sessionId);
      return await cache.get(key);
    } catch (error) {
      logger.error(`Session get error for ${sessionId}:`, error);
      return null;
    }
  },
  
  // Atualizar sessão
  update: async (sessionId, userData, ttl = redisConfig.defaultTTL.session) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.session, sessionId);
      const existing = await cache.get(key);
      
      if (existing) {
        const updated = { ...existing, ...userData };
        await cache.set(key, updated, ttl);
        logger.debug(`Session updated: ${sessionId}`);
        return updated;
      }
      
      return null;
    } catch (error) {
      logger.error(`Session update error for ${sessionId}:`, error);
      throw error;
    }
  },
  
  // Deletar sessão
  destroy: async (sessionId) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.session, sessionId);
      await cache.del(key);
      logger.debug(`Session destroyed: ${sessionId}`);
    } catch (error) {
      logger.error(`Session destroy error for ${sessionId}:`, error);
    }
  },
  
  // Listar sessões de um usuário
  getUserSessions: async (userId) => {
    try {
      const pattern = generateKey(redisConfig.keyPrefixes.session, '*');
      const keys = await redisClient.keys(pattern);
      const sessions = [];
      
      for (const key of keys) {
        const sessionData = await cache.get(key);
        if (sessionData && sessionData.userId === userId) {
          sessions.push({
            sessionId: key.replace(redisConfig.keyPrefixes.session, ''),
            ...sessionData
          });
        }
      }
      
      return sessions;
    } catch (error) {
      logger.error(`Get user sessions error for user ${userId}:`, error);
      return [];
    }
  }
};

// Funções de lock status (status de fechaduras)
const lockStatus = {
  // Definir status
  set: async (lockerId, status, ttl = redisConfig.defaultTTL.lockStatus) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.lockStatus, lockerId);
      const statusData = {
        status,
        timestamp: Date.now(),
        lockerId
      };
      
      await cache.set(key, statusData, ttl);
      
      // Publicar mudança de status
      await pubsub.publish(redisConfig.pubsub.channels.LOCKER_STATUS, {
        lockerId,
        status,
        timestamp: statusData.timestamp
      });
      
      logger.debug(`Lock status set: ${lockerId} = ${status}`);
    } catch (error) {
      logger.error(`Lock status set error for ${lockerId}:`, error);
    }
  },
  
  // Obter status
  get: async (lockerId) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.lockStatus, lockerId);
      return await cache.get(key);
    } catch (error) {
      logger.error(`Lock status get error for ${lockerId}:`, error);
      return null;
    }
  },
  
  // Obter status de múltiplas fechaduras
  getMultiple: async (lockerIds) => {
    try {
      const promises = lockerIds.map(id => lockStatus.get(id));
      const results = await Promise.all(promises);
      
      return lockerIds.reduce((acc, id, index) => {
        acc[id] = results[index];
        return acc;
      }, {});
    } catch (error) {
      logger.error('Lock status get multiple error:', error);
      return {};
    }
  }
};

// Funções de hardware status
const hardwareStatus = {
  // Definir status do hardware
  set: async (hardwareId, status, ttl = redisConfig.defaultTTL.hardwareStatus) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.hardwareStatus, hardwareId);
      const statusData = {
        ...status,
        timestamp: Date.now(),
        hardwareId
      };
      
      await cache.set(key, statusData, ttl);
      
      // Publicar mudança se for crítica
      if (status.level === 'error' || status.level === 'warning') {
        await pubsub.publish(redisConfig.pubsub.channels.HARDWARE_ALERTS, {
          hardwareId,
          status: statusData
        });
      }
      
      logger.debug(`Hardware status set: ${hardwareId}`);
    } catch (error) {
      logger.error(`Hardware status set error for ${hardwareId}:`, error);
    }
  },
  
  // Obter status do hardware
  get: async (hardwareId) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.hardwareStatus, hardwareId);
      return await cache.get(key);
    } catch (error) {
      logger.error(`Hardware status get error for ${hardwareId}:`, error);
      return null;
    }
  },
  
  // Listar todo hardware com problemas
  getProblematic: async () => {
    try {
      const pattern = generateKey(redisConfig.keyPrefixes.hardwareStatus, '*');
      const keys = await redisClient.keys(pattern);
      const problematic = [];
      
      for (const key of keys) {
        const status = await cache.get(key);
        if (status && (status.level === 'error' || status.level === 'warning')) {
          problematic.push(status);
        }
      }
      
      return problematic;
    } catch (error) {
      logger.error('Hardware status get problematic error:', error);
      return [];
    }
  }
};

// Funções de QR code
const qrCode = {
  // Criar QR code temporário
  create: async (qrId, data, ttl = redisConfig.defaultTTL.qrCode) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.qrCode, qrId);
      const qrData = {
        ...data,
        createdAt: Date.now(),
        expiresAt: Date.now() + (ttl * 1000)
      };
      
      await cache.set(key, qrData, ttl);
      logger.debug(`QR code created: ${qrId}`);
      return qrData;
    } catch (error) {
      logger.error(`QR code creation error for ${qrId}:`, error);
      throw error;
    }
  },
  
  // Verificar e consumir QR code
  consume: async (qrId) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.qrCode, qrId);
      const qrData = await cache.get(key);
      
      if (!qrData) {
        return { valid: false, reason: 'QR code not found or expired' };
      }
      
      if (Date.now() > qrData.expiresAt) {
        await cache.del(key);
        return { valid: false, reason: 'QR code expired' };
      }
      
      // QR code válido - consumir (deletar)
      await cache.del(key);
      logger.debug(`QR code consumed: ${qrId}`);
      
      return { valid: true, data: qrData };
    } catch (error) {
      logger.error(`QR code consume error for ${qrId}:`, error);
      return { valid: false, reason: 'Internal error' };
    }
  }
};

// Funções de métricas
const metrics = {
  // Incrementar contador
  increment: async (metricName, value = 1, ttl = 86400) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.metrics, metricName, new Date().toISOString().split('T')[0]);
      await redisClient.incrBy(key, value);
      await redisClient.expire(key, ttl);
    } catch (error) {
      logger.error(`Metrics increment error for ${metricName}:`, error);
    }
  },
  
  // Obter métrica
  get: async (metricName, date = new Date().toISOString().split('T')[0]) => {
    try {
      const key = generateKey(redisConfig.keyPrefixes.metrics, metricName, date);
      const value = await redisClient.get(key);
      return parseInt(value) || 0;
    } catch (error) {
      logger.error(`Metrics get error for ${metricName}:`, error);
      return 0;
    }
  }
};

// Função de health check
const healthCheck = async () => {
  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;
    
    const info = await redisClient.info('memory');
    const memoryMatch = info.match(/used_memory:(\d+)/);
    const memory = memoryMatch ? parseInt(memoryMatch[1]) : 0;
    
    return {
      status: 'healthy',
      latency: `${latency}ms`,
      memory: `${Math.round(memory / 1024 / 1024)}MB`,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    };
  }
};

// Graceful shutdown
const closeConnections = async () => {
  try {
    logger.info('Closing Redis connections...');
    
    const promises = [];
    
    if (redisClient && redisClient.isOpen) {
      promises.push(redisClient.quit());
    }
    
    if (redisSubscriber && redisSubscriber.isOpen) {
      promises.push(redisSubscriber.quit());
    }
    
    if (redisPublisher && redisPublisher.isOpen) {
      promises.push(redisPublisher.quit());
    }
    
    await Promise.all(promises);
    logger.info('Redis connections closed successfully');
  } catch (error) {
    logger.error('Error closing Redis connections:', error);
  }
};

// Interceptar sinais de shutdown
process.on('SIGTERM', closeConnections);
process.on('SIGINT', closeConnections);

// Validar configurações na inicialização
const validateConfig = () => {
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_PASSWORD) {
    logger.warn('Redis password not set in production environment');
  }
  
  logger.info('Redis configuration validated successfully');
};

// Inicializar configurações
try {
  validateConfig();
  logger.info('Redis configuration loaded successfully');
} catch (error) {
  logger.error('Failed to load Redis configuration:', error);
}

module.exports = {
  config: redisConfig,
  client: redisClient,
  subscriber: redisSubscriber,
  publisher: redisPublisher,
  
  // Funções de inicialização
  initializeRedis,
  testConnection,
  healthCheck,
  closeConnections,
  
  // Utilitários
  generateKey,
  
  // Módulos funcionais
  cache,
  rateLimiting,
  pubsub,
  session,
  lockStatus,
  hardwareStatus,
  qrCode,
  metrics
};