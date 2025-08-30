const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('redis');
const logger = require('../utils/logger');

// Configurar Redis se disponível
let redisClient = null;
if (process.env.REDIS_URL) {
  try {
    redisClient = Redis.createClient({
      url: process.env.REDIS_URL,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.warn('Redis connection refused, usando rate limit em memória');
          return undefined; // Não tentar reconectar
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
      redisClient = null;
    });

    redisClient.on('connect', () => {
      logger.info('Redis conectado para rate limiting');
    });
  } catch (error) {
    logger.error('Falha ao conectar Redis:', error);
    redisClient = null;
  }
}

/**
 * Configuração base para rate limiting
 */
const createLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo de requests por janela
    message: {
      success: false,
      error: 'Muitas tentativas, tente novamente mais tarde',
      retryAfter: Math.ceil(options.windowMs / 1000) || 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit atingido', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        userId: req.user?.userId || 'anonymous'
      });

      res.status(429).json(options.message || defaultOptions.message);
    },
    keyGenerator: (req) => {
      // Usar userId se autenticado, senão usar IP
      return req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`;
    },
    skip: (req) => {
      // Skip para alguns endpoints de saúde/status
      const skipPaths = ['/health', '/status', '/metrics'];
      return skipPaths.some(path => req.path.startsWith(path));
    }
  };

  const config = { ...defaultOptions, ...options };

  // Usar Redis store se disponível
  if (redisClient && redisClient.isReady) {
    config.store = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    });
  }

  return rateLimit(config);
};

/**
 * Rate limiting geral para toda a API
 */
const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por 15 minutos por usuário/IP
  message: {
    success: false,
    error: 'Limite de requisições excedido. Tente novamente em alguns minutos.',
    retryAfter: 900
  }
});

/**
 * Rate limiting rigoroso para login
 */
const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // apenas 5 tentativas de login por IP
  message: {
    success: false,
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    code: 'TOO_MANY_LOGIN_ATTEMPTS',
    retryAfter: 900
  },
  keyGenerator: (req) => `login:${req.ip}`, // Sempre usar IP para login
  skipSuccessfulRequests: true // Não contar logins bem-sucedidos
});

/**
 * Rate limiting específico para registro
 */
const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // apenas 3 registros por IP por hora
  message: {
    success: false,
    error: 'Limite de registros excedido. Tente novamente em 1 hora.',
    code: 'TOO_MANY_REGISTRATIONS',
    retryAfter: 3600
  },
  keyGenerator: (req) => `register:${req.ip}`
});

/**
 * Rate limiting para reset de senha
 */
const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // apenas 3 tentativas por email por hora
  message: {
    success: false,
    error: 'Muitas tentativas de reset de senha. Tente novamente em 1 hora.',
    code: 'TOO_MANY_PASSWORD_RESET_ATTEMPTS',
    retryAfter: 3600
  },
  keyGenerator: (req) => `reset:${req.body.email || req.ip}`
});

/**
 * Rate limiting para operações de QR Code
 */
const qrLimiter = createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 validações de QR por minuto por usuário
  message: {
    success: false,
    error: 'Muitas validações de QR Code. Aguarde um momento.',
    code: 'TOO_MANY_QR_VALIDATIONS',
    retryAfter: 60
  }
});

/**
 * Rate limiting para empréstimos
 */
const borrowLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 tentativas de empréstimo por 5 minutos
  message: {
    success: false,
    error: 'Muitas tentativas de empréstimo. Aguarde alguns minutos.',
    code: 'TOO_MANY_BORROW_ATTEMPTS',
    retryAfter: 300
  }
});

/**
 * Rate limiting para upload de arquivos
 */
const uploadLimiter = createLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 20, // 20 uploads por 10 minutos
  message: {
    success: false,
    error: 'Muitos uploads. Aguarde alguns minutos antes de tentar novamente.',
    code: 'TOO_MANY_UPLOADS',
    retryAfter: 600
  }
});

/**
 * Rate limiting para operações administrativas
 */
const adminLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 200, // 200 operações admin por 5 minutos
  message: {
    success: false,
    error: 'Muitas operações administrativas. Aguarde alguns minutos.',
    code: 'TOO_MANY_ADMIN_OPERATIONS',
    retryAfter: 300
  },
  skip: (req) => {
    // Aplicar apenas para usuários admin
    return req.user?.userType !== 'admin';
  }
});

/**
 * Rate limiting para APIs públicas (sem autenticação)
 */
const publicLimiter = createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // 10 requests por minuto por IP
  message: {
    success: false,
    error: 'Muitas requisições na API pública. Aguarde um momento.',
    code: 'TOO_MANY_PUBLIC_REQUESTS',
    retryAfter: 60
  },
  keyGenerator: (req) => `public:${req.ip}` // Sempre usar IP
});

/**
 * Rate limiting para webhook/callback endpoints
 */
const webhookLimiter = createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 webhooks por minuto
  message: {
    success: false,
    error: 'Muitos webhooks recebidos',
    retryAfter: 60
  },
  keyGenerator: (req) => `webhook:${req.ip}`
});

/**
 * Rate limiting dinâmico baseado no tipo de usuário
 */
const dynamicLimiter = (req, res, next) => {
  let max = 100; // padrão para usuários normais
  let windowMs = 15 * 60 * 1000; // 15 minutos

  if (req.user) {
    switch (req.user.userType) {
      case 'admin':
        max = 1000; // admins têm limite maior
        break;
      case 'teacher':
      case 'staff':
        max = 300; // funcionários têm limite intermediário
        break;
      case 'student':
      default:
        max = 100; // estudantes têm limite padrão
        break;
    }
  } else {
    max = 50; // usuários não autenticados têm limite menor
  }

  const limiter = createLimiter({
    windowMs,
    max,
    message: {
      success: false,
      error: `Limite de ${max} requisições por 15 minutos excedido`,
      retryAfter: Math.ceil(windowMs / 1000)
    }
  });

  limiter(req, res, next);
};

/**
 * Rate limiting para operações críticas do hardware
 */
const hardwareLimiter = createLimiter({
  windowMs: 30 * 1000, // 30 segundos
  max: 5, // máximo 5 operações de hardware por 30 segundos por usuário
  message: {
    success: false,
    error: 'Muitas operações no hardware. Aguarde 30 segundos.',
    code: 'TOO_MANY_HARDWARE_OPERATIONS',
    retryAfter: 30
  }
});

/**
 * Rate limiting por endpoint específico
 */
const endpointLimiter = (endpoint, options = {}) => {
  const defaultOptions = {
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 50,
    message: {
      success: false,
      error: `Muitas requisições para ${endpoint}. Aguarde alguns minutos.`,
      retryAfter: 300
    },
    keyGenerator: (req) => `endpoint:${endpoint}:${req.user?.userId || req.ip}`
  };

  return createLimiter({ ...defaultOptions, ...options });
};

/**
 * Middleware para limpar cache de rate limit (uso administrativo)
 */
const clearRateLimit = async (req, res, next) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado'
    });
  }

  const { key, keyPattern } = req.body;

  try {
    if (redisClient && redisClient.isReady) {
      if (keyPattern) {
        // Limpar múltiplas chaves com padrão
        const keys = await redisClient.keys(`rl:${keyPattern}*`);
        if (keys.length > 0) {
          await redisClient.del(keys);
          logger.info(`Rate limit cache limpo para padrão: ${keyPattern}`, {
            clearedKeys: keys.length,
            adminId: req.user.userId
          });
        }
      } else if (key) {
        // Limpar chave específica
        await redisClient.del(`rl:${key}`);
        logger.info(`Rate limit cache limpo para chave: ${key}`, {
          adminId: req.user.userId
        });
      }
    }

    res.json({
      success: true,
      message: 'Cache de rate limit limpo com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao limpar rate limit cache:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar cache'
    });
  }
};

/**
 * Middleware para obter status do rate limiting
 */
const getRateLimitStatus = async (req, res, next) => {
  try {
    const key = req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`;
    
    let status = {
      key,
      remaining: 'unknown',
      resetTime: 'unknown',
      total: 'unknown'
    };

    if (redisClient && redisClient.isReady) {
      // Buscar informações do rate limit no Redis
      const rateLimitKey = `rl:${key}`;
      const data = await redisClient.get(rateLimitKey);
      
      if (data) {
        const parsed = JSON.parse(data);
        status = {
          key,
          remaining: parsed.remaining || 0,
          resetTime: new Date(parsed.resetTime),
          total: parsed.total,
          windowMs: parsed.windowMs
        };
      }
    }

    req.rateLimitStatus = status;
    next();
  } catch (error) {
    logger.error('Erro ao obter status do rate limit:', error);
    req.rateLimitStatus = { error: 'Não foi possível obter status' };
    next();
  }
};

/**
 * Middleware para bypass de rate limit em emergências
 */
const emergencyBypass = (req, res, next) => {
  // Verificar se está em modo de emergência
  if (process.env.EMERGENCY_MODE === 'true' || req.headers['x-emergency-bypass'] === process.env.EMERGENCY_BYPASS_TOKEN) {
    logger.warn('Rate limit ignorado - modo de emergência', {
      ip: req.ip,
      endpoint: req.originalUrl,
      userId: req.user?.userId,
      emergencyMode: process.env.EMERGENCY_MODE === 'true',
      bypassToken: !!req.headers['x-emergency-bypass']
    });
    
    return next();
  }

  next();
};

/**
 * Rate limiting baseado em geolocalização (se disponível)
 */
const geoBasedLimiter = (req, res, next) => {
  const country = req.headers['cf-ipcountry'] || req.headers['x-country-code'];
  
  // Países com rate limit mais rigoroso (se necessário)
  const restrictedCountries = (process.env.RESTRICTED_COUNTRIES || '').split(',');
  
  let max = 100;
  let windowMs = 15 * 60 * 1000;

  if (restrictedCountries.includes(country)) {
    max = 50; // limite menor para países restritos
    logger.info('Rate limit restrito aplicado', { country, ip: req.ip });
  }

  const limiter = createLimiter({
    windowMs,
    max,
    keyGenerator: (req) => `geo:${country}:${req.user?.userId || req.ip}`,
    message: {
      success: false,
      error: 'Limite de requisições excedido para sua região',
      retryAfter: Math.ceil(windowMs / 1000)
    }
  });

  limiter(req, res, next);
};

module.exports = {
  generalLimiter,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  qrLimiter,
  borrowLimiter,
  uploadLimiter,
  adminLimiter,
  publicLimiter,
  webhookLimiter,
  dynamicLimiter,
  hardwareLimiter,
  endpointLimiter,
  clearRateLimit,
  getRateLimitStatus,
  emergencyBypass,
  geoBasedLimiter,
  createLimiter
};