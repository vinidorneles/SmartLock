const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Middleware principal de logging de requisições
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Adicionar requestId ao request para rastreamento
  req.requestId = requestId;
  
  // Capturar dados da requisição
  const requestData = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    userId: req.user?.userId || null,
    userType: req.user?.userType || null,
    referer: req.get('Referer'),
    origin: req.get('Origin')
  };

  // Log da requisição inicial
  logger.info('Requisição recebida', requestData);

  // Interceptar o final da resposta
  const originalSend = res.send;
  const originalJson = res.json;
  
  let responseBody = null;
  
  res.send = function(body) {
    responseBody = body;
    return originalSend.call(this, body);
  };
  
  res.json = function(obj) {
    responseBody = obj;
    return originalJson.call(this, obj);
  };

  // Capturar quando a resposta é finalizada
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseData = {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      userId: req.user?.userId || null,
      ip: req.ip
    };

    // Log diferente baseado no status da resposta
    if (res.statusCode >= 400) {
      responseData.error = true;
      if (responseBody && typeof responseBody === 'object') {
        responseData.errorMessage = responseBody.error || responseBody.message;
      }
      
      if (res.statusCode >= 500) {
        logger.error('Erro no servidor', responseData);
      } else {
        logger.warn('Erro na requisição', responseData);
      }
    } else {
      logger.info('Requisição completada', responseData);
    }
  });

  next();
};

/**
 * Middleware para log de autenticação
 */
const authLogger = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(obj) {
    if (req.route && req.route.path.includes('login')) {
      const authData = {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        email: req.body?.email,
        success: res.statusCode === 200,
        statusCode: res.statusCode
      };

      if (authData.success) {
        logger.info('Login bem-sucedido', authData);
      } else {
        authData.errorMessage = obj?.error || 'Falha na autenticação';
        logger.warn('Tentativa de login falhada', authData);
      }
    }
    
    return originalJson.call(this, obj);
  };

  next();
};

/**
 * Middleware para log de operações de hardware
 */
const hardwareLogger = (req, res, next) => {
  if (req.originalUrl.includes('/hardware') || req.originalUrl.includes('/lockers')) {
    const originalJson = res.json;
    
    res.json = function(obj) {
      const hardwareData = {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        operation: req.method,
        endpoint: req.originalUrl,
        userId: req.user?.userId,
        cabinetId: req.body?.cabinetId || req.params?.cabinetId,
        lockerNumber: req.body?.lockerNumber,
        success: res.statusCode < 400,
        statusCode: res.statusCode
      };

      if (hardwareData.success) {
        logger.info('Operação de hardware executada', hardwareData);
      } else {
        hardwareData.errorMessage = obj?.error;
        logger.error('Falha na operação de hardware', hardwareData);
      }
      
      return originalJson.call(this, obj);
    };
  }

  next();
};

/**
 * Middleware para log de transações (empréstimos/devoluções)
 */
const transactionLogger = (req, res, next) => {
  if (req.originalUrl.includes('/borrow') || req.originalUrl.includes('/return')) {
    const originalJson = res.json;
    
    res.json = function(obj) {
      const transactionData = {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        type: req.originalUrl.includes('/borrow') ? 'BORROW' : 'RETURN',
        userId: req.user?.userId,
        userName: req.user?.name,
        cabinetId: req.body?.cabinetId,
        lockerNumber: req.body?.lockerNumber,
        transactionId: obj?.transactionId || req.params?.transactionId,
        success: res.statusCode < 400,
        statusCode: res.statusCode
      };

      if (transactionData.success) {
        logger.info('Transação executada', transactionData);
      } else {
        transactionData.errorMessage = obj?.error;
        logger.error('Falha na transação', transactionData);
      }
      
      return originalJson.call(this, obj);
    };
  }

  next();
};

/**
 * Middleware para log de operações administrativas
 */
const adminLogger = (req, res, next) => {
  if (req.user?.userType === 'admin' && req.originalUrl.includes('/admin')) {
    const originalJson = res.json;
    
    res.json = function(obj) {
      const adminData = {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        adminId: req.user.userId,
        adminEmail: req.user.email,
        operation: `${req.method} ${req.originalUrl}`,
        targetResource: req.params?.id || req.body?.id,
        changes: sanitizeForLog(req.body),
        success: res.statusCode < 400,
        statusCode: res.statusCode
      };

      logger.info('Operação administrativa executada', adminData);
      
      return originalJson.call(this, obj);
    };
  }

  next();
};

/**
 * Middleware para log de tentativas suspeitas
 */
const securityLogger = (req, res, next) => {
  const suspiciousPatterns = [
    /\/\.\./,           // Directory traversal
    /script/i,          // XSS attempts
    /union.*select/i,   // SQL injection
    /javascript:/i,     // JavaScript protocol
    /<.*>/,            // HTML tags
  ];

  const urlToCheck = req.originalUrl + JSON.stringify(req.body);
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(urlToCheck));

  if (isSuspicious) {
    const securityData = {
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      type: 'SUSPICIOUS_REQUEST',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.originalUrl,
      body: sanitizeForLog(req.body),
      headers: sanitizeHeaders(req.headers),
      userId: req.user?.userId || null
    };

    logger.warn('Tentativa suspeita detectada', securityData);
  }

  next();
};

/**
 * Middleware para log de uploads
 */
const uploadLogger = (req, res, next) => {
  if (req.file || req.files) {
    const files = req.files || [req.file];
    
    files.forEach(file => {
      const uploadData = {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        userId: req.user?.userId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadPath: file.path || file.filename
      };

      logger.info('Arquivo enviado', uploadData);
    });
  }

  next();
};

/**
 * Middleware para log de erros de rate limit
 */
const rateLimitLogger = (req, res, next) => {
  const originalStatus = res.status;
  
  res.status = function(code) {
    if (code === 429) {
      const rateLimitData = {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        type: 'RATE_LIMIT_EXCEEDED',
        ip: req.ip,
        userId: req.user?.userId || null,
        endpoint: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent')
      };

      logger.warn('Rate limit excedido', rateLimitData);
    }
    
    return originalStatus.call(this, code);
  };

  next();
};

/**
 * Middleware para rotação automática de logs
 */
const logRotation = async () => {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const files = await fs.readdir(logDir);
    
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file);
        const stats = await fs.stat(filePath);
        
        // Rotacionar se arquivo for maior que 100MB
        if (stats.size > 100 * 1024 * 1024) {
          const timestamp = new Date().toISOString().slice(0, 10);
          const newName = file.replace('.log', `_${timestamp}.log`);
          
          await fs.rename(filePath, path.join(logDir, newName));
          logger.info(`Log rotacionado: ${file} -> ${newName}`);
        }
      }
    }
  } catch (error) {
    logger.error('Erro na rotação de logs:', error);
  }
};

/**
 * Middleware para limpeza de logs antigos
 */
const cleanupOldLogs = async (daysToKeep = 30) => {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const files = await fs.readdir(logDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    for (const file of files) {
      const filePath = path.join(logDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        logger.info(`Log antigo removido: ${file}`);
      }
    }
  } catch (error) {
    logger.error('Erro na limpeza de logs:', error);
  }
};

/**
 * Funções auxiliares
 */
const generateRequestId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const sanitizeForLog = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = { ...obj };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

const sanitizeHeaders = (headers) => {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

// Configurar rotação automática de logs (executar a cada 6 horas)
if (process.env.NODE_ENV === 'production') {
  setInterval(logRotation, 6 * 60 * 60 * 1000);
  setInterval(() => cleanupOldLogs(30), 24 * 60 * 60 * 1000);
}

module.exports = {
  requestLogger,
  authLogger,
  hardwareLogger,
  transactionLogger,
  adminLogger,
  securityLogger,
  uploadLogger,
  rateLimitLogger,
  logRotation,
  cleanupOldLogs
};