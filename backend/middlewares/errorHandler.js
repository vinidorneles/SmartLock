const logger = require('../utils/logger');

/**
 * Classe personalizada para erros da aplicação
 */
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware principal de tratamento de erros
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log do erro
  const errorData = {
    requestId: req.requestId || 'unknown',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.userId || null,
    userAgent: req.get('User-Agent'),
    stack: err.stack,
    name: err.name,
    message: err.message
  };

  logger.error('Erro capturado pelo handler', errorData);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Recurso não encontrado';
    error = new AppError(message, 404, 'RESOURCE_NOT_FOUND');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} já existe no sistema`;
    error = new AppError(message, 400, 'DUPLICATE_FIELD');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // PostgreSQL erros
  if (err.code && err.code.startsWith('23')) {
    error = handlePostgreSQLError(err);
  }

  // JWT erros
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token JWT inválido';
    error = new AppError(message, 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token JWT expirado';
    error = new AppError(message, 401, 'EXPIRED_TOKEN');
  }

  // Multer erros (upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'Arquivo muito grande';
    error = new AppError(message, 400, 'FILE_TOO_LARGE');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Campo de arquivo inesperado';
    error = new AppError(message, 400, 'UNEXPECTED_FILE_FIELD');
  }

  // Axios erros (chamadas HTTP externas)
  if (err.isAxiosError) {
    error = handleAxiosError(err);
  }

  // Hardware communication errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    const message = 'Falha na comunicação com hardware';
    error = new AppError(message, 503, 'HARDWARE_COMMUNICATION_ERROR');
  }

  // Rate limiting
  if (err.status === 429) {
    const message = 'Muitas tentativas, tente novamente mais tarde';
    error = new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  sendErrorResponse(error, req, res);
};

/**
 * Handler específico para erros do PostgreSQL
 */
const handlePostgreSQLError = (err) => {
  switch (err.code) {
    case '23505': // unique_violation
      return new AppError('Dados duplicados encontrados', 400, 'DUPLICATE_DATA');
    
    case '23503': // foreign_key_violation
      return new AppError('Referência inválida aos dados', 400, 'INVALID_REFERENCE');
    
    case '23502': // not_null_violation
      return new AppError('Campo obrigatório não preenchido', 400, 'REQUIRED_FIELD_MISSING');
    
    case '42P01': // undefined_table
      return new AppError('Recurso não encontrado', 404, 'RESOURCE_NOT_FOUND');
    
    case '42703': // undefined_column
      return new AppError('Campo não encontrado', 400, 'FIELD_NOT_FOUND');
    
    case '08000': // connection_exception
    case '08003': // connection_does_not_exist
    case '08006': // connection_failure
      return new AppError('Erro de conexão com banco de dados', 503, 'DATABASE_CONNECTION_ERROR');
    
    default:
      return new AppError('Erro interno do banco de dados', 500, 'DATABASE_ERROR');
  }
};

/**
 * Handler específico para erros do Axios
 */
const handleAxiosError = (err) => {
  if (err.response) {
    // Servidor respondeu com status de erro
    const status = err.response.status;
    const message = err.response.data?.message || 'Erro na comunicação externa';
    return new AppError(message, status, 'EXTERNAL_SERVICE_ERROR');
  } else if (err.request) {
    // Request foi feito mas não houve resposta
    return new AppError('Serviço externo indisponível', 503, 'EXTERNAL_SERVICE_UNAVAILABLE');
  } else {
    // Erro na configuração do request
    return new AppError('Erro na configuração da requisição', 500, 'REQUEST_CONFIGURATION_ERROR');
  }
};

/**
 * Enviar resposta de erro formatada
 */
const sendErrorResponse = (err, req, res) => {
  const { statusCode = 500, message, code } = err;

  // Resposta para desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    return res.status(statusCode).json({
      success: false,
      error: message,
      code,
      stack: err.stack,
      requestId: req.requestId
    });
  }

  // Resposta para produção
  if (err.isOperational) {
    // Erro operacional: confiável para mostrar ao cliente
    return res.status(statusCode).json({
      success: false,
      error: message,
      code,
      requestId: req.requestId
    });
  }

  // Erro de programação: não expor detalhes
  logger.error('Erro não operacional detectado', {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    userId: req.user?.userId
  });

  return res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    code: 'INTERNAL_SERVER_ERROR',
    requestId: req.requestId
  });
};

/**
 * Middleware para capturar erros assíncronos
 */
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware para erros 404 (rota não encontrada)
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Rota ${req.originalUrl} não encontrada`, 404, 'ROUTE_NOT_FOUND');
  next(error);
};

/**
 * Middleware para validar se todos os middlewares necessários foram aplicados
 */
const validateMiddlewareStack = (req, res, next) => {
  const requiredMiddlewares = [
    'requestId',
    'cors',
    'helmet',
    'rateLimit'
  ];

  const missingMiddlewares = requiredMiddlewares.filter(middleware => {
    switch (middleware) {
      case 'requestId':
        return !req.requestId;
      case 'cors':
        return !res.get('Access-Control-Allow-Origin');
      case 'helmet':
        return !res.get('X-Content-Type-Options');
      case 'rateLimit':
        return !res.get('X-RateLimit-Limit');
      default:
        return false;
    }
  });

  if (missingMiddlewares.length > 0) {
    logger.warn('Middlewares obrigatórios não aplicados', {
      missing: missingMiddlewares,
      endpoint: req.originalUrl
    });
  }

  next();
};

/**
 * Middleware específico para erros de hardware
 */
const hardwareErrorHandler = (err, req, res, next) => {
  if (req.originalUrl.includes('/hardware') || req.originalUrl.includes('/lockers')) {
    // Log específico para erros de hardware
    logger.error('Erro de hardware detectado', {
      requestId: req.requestId,
      error: err.message,
      cabinetId: req.body?.cabinetId || req.params?.cabinetId,
      lockerNumber: req.body?.lockerNumber,
      hardwareEndpoint: req.originalUrl,
      userId: req.user?.userId
    });

    // Tentar recuperação automática
    if (err.code === 'ECONNREFUSED' && req.retryCount < 3) {
      req.retryCount = (req.retryCount || 0) + 1;
      logger.info(`Tentativa de recuperação ${req.retryCount}/3`, {
        requestId: req.requestId
      });
      
      // Aguardar 1 segundo antes de tentar novamente
      setTimeout(() => {
        next();
      }, 1000);
      return;
    }

    // Se não conseguiu recuperar, enviar erro específico
    const hardwareError = new AppError(
      'Sistema de hardware temporariamente indisponível',
      503,
      'HARDWARE_UNAVAILABLE'
    );
    
    return sendErrorResponse(hardwareError, req, res);
  }

  next(err);
};

/**
 * Middleware para capturar erros não tratados
 */
const uncaughtErrorHandler = () => {
  process.on('uncaughtException', (err) => {
    logger.error('Exceção não capturada', {
      error: err.message,
      stack: err.stack,
      type: 'uncaughtException'
    });

    // Tentar graceful shutdown
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promise rejeitada não tratada', {
      reason: reason,
      promise: promise,
      type: 'unhandledRejection'
    });

    // Tentar graceful shutdown
    process.exit(1);
  });
};

/**
 * Middleware para timeout de requisições
 */
const timeoutHandler = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const error = new AppError(
          'Tempo limite da requisição excedido',
          408,
          'REQUEST_TIMEOUT'
        );
        
        logger.warn('Timeout de requisição', {
          requestId: req.requestId,
          url: req.originalUrl,
          timeout: timeout,
          userId: req.user?.userId
        });

        return sendErrorResponse(error, req, res);
      }
    }, timeout);

    // Limpar timer quando resposta for enviada
    res.on('finish', () => {
      clearTimeout(timer);
    });

    res.on('close', () => {
      clearTimeout(timer);
    });

    next();
  };
};

/**
 * Middleware para sanitizar erros antes de enviar
 */
const sanitizeError = (err, req, res, next) => {
  // Remover informações sensíveis das mensagens de erro
  const sensitivePatterns = [
    /password/gi,
    /token/gi,
    /key/gi,
    /secret/gi,
    /database/gi,
    /connection/gi
  ];

  if (err.message) {
    sensitivePatterns.forEach(pattern => {
      err.message = err.message.replace(pattern, '[REDACTED]');
    });
  }

  next(err);
};

/**
 * Middleware para recuperação automática de erros
 */
const autoRecovery = (err, req, res, next) => {
  const recoverableErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'DATABASE_CONNECTION_ERROR'
  ];

  if (recoverableErrors.includes(err.code) && req.autoRetryCount < 2) {
    req.autoRetryCount = (req.autoRetryCount || 0) + 1;
    
    logger.info('Tentando recuperação automática', {
      requestId: req.requestId,
      error: err.code,
      attempt: req.autoRetryCount,
      maxAttempts: 2
    });

    // Aguardar progressivamente mais tempo a cada tentativa
    const delay = req.autoRetryCount * 1000;
    
    setTimeout(() => {
      // Reexecutar o middleware que falhou
      next();
    }, delay);
    
    return;
  }

  next(err);
};

/**
 * Middleware para alertas de erro crítico
 */
const criticalErrorAlert = (err, req, res, next) => {
  const criticalErrors = [
    'DATABASE_CONNECTION_ERROR',
    'HARDWARE_COMMUNICATION_ERROR',
    'SECURITY_BREACH'
  ];

  if (criticalErrors.includes(err.code)) {
    // Enviar alerta (email, webhook, etc.)
    logger.error('ERRO CRÍTICO DETECTADO', {
      requestId: req.requestId,
      error: err.code,
      message: err.message,
      timestamp: new Date().toISOString(),
      userId: req.user?.userId,
      ip: req.ip,
      url: req.originalUrl
    });

    // Aqui você pode integrar com sistemas de alerta
    // como PagerDuty, Slack, email, etc.
    notifyCriticalError(err, req);
  }

  next(err);
};

/**
 * Função para notificar erros críticos
 */
const notifyCriticalError = async (err, req) => {
  try {
    // Implementar notificação por email, Slack, webhook, etc.
    const alertData = {
      service: 'Smart Lock System',
      level: 'CRITICAL',
      error: err.code,
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      userId: req.user?.userId,
      endpoint: req.originalUrl
    };

    // Exemplo de webhook de alerta
    if (process.env.ALERT_WEBHOOK_URL) {
      const response = await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData)
      });
      
      if (!response.ok) {
        logger.error('Falha ao enviar alerta crítico', {
          webhookStatus: response.status
        });
      }
    }
  } catch (alertError) {
    logger.error('Erro ao processar alerta crítico', alertError);
  }
};

/**
 * Middleware para estatísticas de erro
 */
const errorStats = (() => {
  const stats = {
    total: 0,
    byCode: {},
    byEndpoint: {},
    byUser: {}
  };

  return (err, req, res, next) => {
    stats.total++;
    
    // Estatísticas por código de erro
    const errorCode = err.code || 'UNKNOWN';
    stats.byCode[errorCode] = (stats.byCode[errorCode] || 0) + 1;
    
    // Estatísticas por endpoint
    const endpoint = req.route?.path || req.originalUrl;
    stats.byEndpoint[endpoint] = (stats.byEndpoint[endpoint] || 0) + 1;
    
    // Estatísticas por usuário (se autenticado)
    if (req.user?.userId) {
      stats.byUser[req.user.userId] = (stats.byUser[req.user.userId] || 0) + 1;
    }

    // Expor estatísticas no objeto request para possível uso
    req.errorStats = stats;

    next(err);
  };
})();

/**
 * Middleware para resetar estatísticas de erro (uso administrativo)
 */
const resetErrorStats = (req, res) => {
  if (req.user?.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado'
    });
  }

  // Reset das estatísticas
  req.errorStats = {
    total: 0,
    byCode: {},
    byEndpoint: {},
    byUser: {}
  };

  res.json({
    success: true,
    message: 'Estatísticas de erro resetadas'
  });
};

// Configurar handlers de erros não capturados
uncaughtErrorHandler();

module.exports = {
  AppError,
  errorHandler,
  asyncErrorHandler,
  notFoundHandler,
  validateMiddlewareStack,
  hardwareErrorHandler,
  timeoutHandler,
  sanitizeError,
  autoRecovery,
  criticalErrorAlert,
  errorStats,
  resetErrorStats,
  handlePostgreSQLError,
  handleAxiosError
};