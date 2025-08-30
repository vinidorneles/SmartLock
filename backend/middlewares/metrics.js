const logger = require('../utils/logger');
const os = require('os');

/**
 * Classe para coleta e armazenamento de métricas
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byEndpoint: {},
        byStatus: {},
        byUserType: {}
      },
      performance: {
        responseTime: {
          total: 0,
          count: 0,
          min: Infinity,
          max: 0,
          avg: 0
        },
        slowRequests: []
      },
      hardware: {
        unlockOperations: 0,
        failedUnlocks: 0,
        averageUnlockTime: 0,
        hardwareErrors: 0
      },
      business: {
        activeLoans: 0,
        totalBorrows: 0,
        totalReturns: 0,
        overdueLoans: 0,
        userRegistrations: 0
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        errors: {
          total: 0,
          byType: {},
          critical: 0
        }
      },
      security: {
        failedLogins: 0,
        suspiciousRequests: 0,
        rateLimitHits: 0,
        blockedIPs: new Set()
      }
    };

    this.startTime = Date.now();
    this.intervals = [];

    // Iniciar coleta automática de métricas do sistema
    this.startSystemMetricsCollection();
  }

  /**
   * Incrementar contador simples
   */
  increment(path, value = 1) {
    const keys = path.split('.');
    let current = this.metrics;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = (current[lastKey] || 0) + value;
  }

  /**
   * Definir valor específico
   */
  set(path, value) {
    const keys = path.split('.');
    let current = this.metrics;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Obter valor de métrica
   */
  get(path) {
    const keys = path.split('.');
    let current = this.metrics;

    for (const key of keys) {
      if (!current[key]) return undefined;
      current = current[key];
    }

    return current;
  }

  /**
   * Calcular média de tempo de resposta
   */
  updateResponseTimeAverage(responseTime) {
    const perfMetrics = this.metrics.performance.responseTime;
    
    perfMetrics.total += responseTime;
    perfMetrics.count += 1;
    perfMetrics.avg = perfMetrics.total / perfMetrics.count;
    perfMetrics.min = Math.min(perfMetrics.min, responseTime);
    perfMetrics.max = Math.max(perfMetrics.max, responseTime);

    // Armazenar requests lentos (>3 segundos)
    if (responseTime > 3000) {
      perfMetrics.slowRequests.push({
        responseTime,
        timestamp: new Date().toISOString()
      });

      // Manter apenas os últimos 100 requests lentos
      if (perfMetrics.slowRequests.length > 100) {
        perfMetrics.slowRequests = perfMetrics.slowRequests.slice(-100);
      }
    }
  }

  /**
   * Coleta automática de métricas do sistema
   */
  startSystemMetricsCollection() {
    // Coletar métricas a cada 30 segundos
    const systemInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Coletar métricas de negócio a cada 5 minutos
    const businessInterval = setInterval(async () => {
      await this.collectBusinessMetrics();
    }, 300000);

    this.intervals.push(systemInterval, businessInterval);
  }

  /**
   * Coletar métricas do sistema
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.set('system.uptime', process.uptime());
    this.set('system.memoryUsage', memUsage);
    this.set('system.cpuUsage', cpuUsage);

    // Métricas do OS
    this.set('system.loadAverage', os.loadavg());
    this.set('system.freeMemory', os.freemem());
    this.set('system.totalMemory', os.totalmem());
    this.set('system.cpuCount', os.cpus().length);

    // Log se uso de memória for alto (>80%)
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      logger.warn('Uso alto de memória detectado', {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        percentage: memoryUsagePercent.toFixed(2)
      });
    }
  }

  /**
   * Coletar métricas de negócio do banco de dados
   */
  async collectBusinessMetrics() {
    try {
      const { Transaction } = require('../models/Transaction');
      const { User } = require('../models/User');

      // Empréstimos ativos
      const activeLoanCount = await Transaction.countActive();
      this.set('business.activeLoans', activeLoanCount);

      // Empréstimos em atraso
      const overdueLoanCount = await Transaction.countOverdue();
      this.set('business.overdueLoans', overdueLoanCount);

      // Total de usuários ativos
      const activeUserCount = await User.countActive();
      this.set('business.activeUsers', activeUserCount);

      // Estatísticas do dia atual
      const today = new Date().toISOString().split('T')[0];
      const todayBorrows = await Transaction.countByDate(today, 'borrow');
      const todayReturns = await Transaction.countByDate(today, 'return');

      this.set('business.todayBorrows', todayBorrows);
      this.set('business.todayReturns', todayReturns);

    } catch (error) {
      logger.error('Erro ao coletar métricas de negócio:', error);
    }
  }

  /**
   * Resetar métricas
   */
  reset() {
    Object.keys(this.metrics).forEach(key => {
      if (typeof this.metrics[key] === 'object') {
        Object.keys(this.metrics[key]).forEach(subKey => {
          if (typeof this.metrics[key][subKey] === 'number') {
            this.metrics[key][subKey] = 0;
          } else if (Array.isArray(this.metrics[key][subKey])) {
            this.metrics[key][subKey] = [];
          }
        });
      }
    });

    this.startTime = Date.now();
  }

  /**
   * Obter relatório completo de métricas
   */
  getReport() {
    const uptime = Date.now() - this.startTime;
    
    return {
      timestamp: new Date().toISOString(),
      uptime: {
        milliseconds: uptime,
        seconds: Math.floor(uptime / 1000),
        minutes: Math.floor(uptime / 60000),
        hours: Math.floor(uptime / 3600000)
      },
      metrics: this.metrics,
      health: this.getHealthStatus()
    };
  }

  /**
   * Verificar saúde do sistema
   */
  getHealthStatus() {
    const memUsage = this.metrics.system.memoryUsage;
    const responseTime = this.metrics.performance.responseTime.avg;
    const errorRate = this.calculateErrorRate();

    const health = {
      status: 'healthy',
      issues: []
    };

    // Verificar uso de memória
    if (memUsage.heapUsed > memUsage.heapTotal * 0.8) {
      health.status = 'warning';
      health.issues.push('High memory usage');
    }

    // Verificar tempo de resposta
    if (responseTime > 2000) {
      health.status = 'warning';
      health.issues.push('Slow response time');
    }

    // Verificar taxa de erro
    if (errorRate > 10) {
      health.status = 'critical';
      health.issues.push('High error rate');
    }

    // Verificar falhas de hardware
    const hardwareErrorRate = this.calculateHardwareErrorRate();
    if (hardwareErrorRate > 20) {
      health.status = 'warning';
      health.issues.push('Hardware communication issues');
    }

    return health;
  }

  /**
   * Calcular taxa de erro
   */
  calculateErrorRate() {
    const totalRequests = this.metrics.requests.total;
    const totalErrors = this.metrics.system.errors.total;
    
    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  }

  /**
   * Calcular taxa de erro de hardware
   */
  calculateHardwareErrorRate() {
    const totalUnlocks = this.metrics.hardware.unlockOperations;
    const failedUnlocks = this.metrics.hardware.failedUnlocks;
    
    return totalUnlocks > 0 ? (failedUnlocks / totalUnlocks) * 100 : 0;
  }

  /**
   * Limpar intervalos (cleanup)
   */
  stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }
}

// Instância global do coletor de métricas
const metricsCollector = new MetricsCollector();

/**
 * Middleware principal de coleta de métricas
 */
const collectMetrics = (req, res, next) => {
  const startTime = Date.now();
  
  // Incrementar contador de requests
  metricsCollector.increment('requests.total');
  metricsCollector.increment(`requests.byMethod.${req.method}`);
  
  const endpoint = req.route?.path || req.originalUrl.split('?')[0];
  metricsCollector.increment(`requests.byEndpoint.${endpoint}`);

  if (req.user?.userType) {
    metricsCollector.increment(`requests.byUserType.${req.user.userType}`);
  }

  // Capturar quando a resposta é finalizada
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Atualizar métricas de performance
    metricsCollector.updateResponseTimeAverage(responseTime);
    metricsCollector.increment(`requests.byStatus.${Math.floor(statusCode / 100)}xx`);

    // Log de performance para requests lentos
    if (responseTime > 5000) {
      logger.warn('Request lento detectado', {
        requestId: req.requestId,
        endpoint: req.originalUrl,
        responseTime: `${responseTime}ms`,
        method: req.method,
        userId: req.user?.userId
      });
    }
  });

  next();
};

/**
 * Middleware para métricas de hardware
 */
const hardwareMetrics = (req, res, next) => {
  if (req.originalUrl.includes('/hardware') || req.originalUrl.includes('/unlock')) {
    const startTime = Date.now();
    const originalJson = res.json;

    res.json = function(obj) {
      const duration = Date.now() - startTime;

      if (res.statusCode < 400) {
        metricsCollector.increment('hardware.unlockOperations');
        
        // Calcular tempo médio de unlock
        const currentAvg = metricsCollector.get('hardware.averageUnlockTime') || 0;
        const operations = metricsCollector.get('hardware.unlockOperations');
        const newAvg = ((currentAvg * (operations - 1)) + duration) / operations;
        metricsCollector.set('hardware.averageUnlockTime', newAvg);
      } else {
        metricsCollector.increment('hardware.failedUnlocks');
        metricsCollector.increment('hardware.hardwareErrors');
      }

      return originalJson.call(this, obj);
    };
  }

  next();
};

/**
 * Middleware para métricas de negócio
 */
const businessMetrics = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(obj) {
    if (res.statusCode < 400) {
      // Métricas de empréstimo
      if (req.originalUrl.includes('/borrow')) {
        metricsCollector.increment('business.totalBorrows');
      }

      // Métricas de devolução
      if (req.originalUrl.includes('/return')) {
        metricsCollector.increment('business.totalReturns');
      }

      // Métricas de registro
      if (req.originalUrl.includes('/register')) {
        metricsCollector.increment('business.userRegistrations');
      }
    }

    return originalJson.call(this, obj);
  };

  next();
};

/**
 * Middleware para métricas de segurança
 */
const securityMetrics = (req, res, next) => {
  // Detectar tentativas de login falhadas
  if (req.originalUrl.includes('/login')) {
    const originalJson = res.json;
    
    res.json = function(obj) {
      if (res.statusCode === 401 || res.statusCode === 403) {
        metricsCollector.increment('security.failedLogins');
        
        // Contar IPs com falhas repetidas
        const ip = req.ip;
        const failedAttempts = metricsCollector.get(`security.failedLoginsByIP.${ip}`) || 0;
        metricsCollector.set(`security.failedLoginsByIP.${ip}`, failedAttempts + 1);

        // Bloquear IP após 10 tentativas falhadas
        if (failedAttempts >= 10) {
          metricsCollector.metrics.security.blockedIPs.add(ip);
        }
      }
      
      return originalJson.call(this, obj);
    };
  }

  // Detectar requests suspeitos
  const suspiciousPatterns = [
    /\.\./,
    /<script/i,
    /union.*select/i,
    /javascript:/i
  ];

  const urlToCheck = req.originalUrl + JSON.stringify(req.body || {});
  if (suspiciousPatterns.some(pattern => pattern.test(urlToCheck))) {
    metricsCollector.increment('security.suspiciousRequests');
  }

  next();
};

/**
 * Middleware para métricas de rate limiting
 */
const rateLimitMetrics = (req, res, next) => {
  const originalStatus = res.status;
  
  res.status = function(code) {
    if (code === 429) {
      metricsCollector.increment('security.rateLimitHits');
    }
    
    return originalStatus.call(this, code);
  };

  next();
};

/**
 * Middleware para métricas de erro
 */
const errorMetrics = (err, req, res, next) => {
  metricsCollector.increment('system.errors.total');
  
  const errorType = err.code || err.name || 'UNKNOWN_ERROR';
  metricsCollector.increment(`system.errors.byType.${errorType}`);

  // Contar erros críticos
  const criticalErrors = [
    'DATABASE_CONNECTION_ERROR',
    'HARDWARE_COMMUNICATION_ERROR',
    'SECURITY_BREACH'
  ];

  if (criticalErrors.includes(errorType)) {
    metricsCollector.increment('system.errors.critical');
  }

  next(err);
};

/**
 * Endpoint para exposição de métricas (formato Prometheus)
 */
const prometheusMetrics = (req, res) => {
  const report = metricsCollector.getReport();
  let prometheusFormat = '';

  // Converter métricas para formato Prometheus
  prometheusFormat += `# HELP smart_lock_requests_total Total number of HTTP requests\n`;
  prometheusFormat += `# TYPE smart_lock_requests_total counter\n`;
  prometheusFormat += `smart_lock_requests_total ${report.metrics.requests.total}\n\n`;

  prometheusFormat += `# HELP smart_lock_response_time_avg Average response time in milliseconds\n`;
  prometheusFormat += `# TYPE smart_lock_response_time_avg gauge\n`;
  prometheusFormat += `smart_lock_response_time_avg ${report.metrics.performance.responseTime.avg}\n\n`;

  prometheusFormat += `# HELP smart_lock_active_loans Number of active loans\n`;
  prometheusFormat += `# TYPE smart_lock_active_loans gauge\n`;
  prometheusFormat += `smart_lock_active_loans ${report.metrics.business.activeLoans}\n\n`;

  prometheusFormat += `# HELP smart_lock_hardware_operations_total Total hardware unlock operations\n`;
  prometheusFormat += `# TYPE smart_lock_hardware_operations_total counter\n`;
  prometheusFormat += `smart_lock_hardware_operations_total ${report.metrics.hardware.unlockOperations}\n\n`;

  prometheusFormat += `# HELP smart_lock_errors_total Total number of errors\n`;
  prometheusFormat += `# TYPE smart_lock_errors_total counter\n`;
  prometheusFormat += `smart_lock_errors_total ${report.metrics.system.errors.total}\n\n`;

  res.set('Content-Type', 'text/plain');
  res.send(prometheusFormat);
};

/**
 * Endpoint para relatório completo de métricas
 */
const metricsReport = (req, res) => {
  const report = metricsCollector.getReport();
  
  res.json({
    success: true,
    data: report
  });
};

/**
 * Endpoint para resetar métricas (apenas admin)
 */
const resetMetrics = (req, res) => {
  if (req.user?.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado'
    });
  }

  metricsCollector.reset();
  
  logger.info('Métricas resetadas', {
    adminId: req.user.userId,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Métricas resetadas com sucesso'
  });
};

/**
 * Endpoint para saúde do sistema
 */
const healthCheck = (req, res) => {
  const health = metricsCollector.getHealthStatus();
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();

  const response = {
    status: health.status,
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptime),
      formatted: formatUptime(uptime)
    },
    memory: {
      used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      usage: `${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1)}%`
    },
    metrics: {
      totalRequests: metricsCollector.get('requests.total'),
      averageResponseTime: `${metricsCollector.get('performance.responseTime.avg')?.toFixed(0) || 0}ms`,
      activeLoans: metricsCollector.get('business.activeLoans'),
      errorRate: `${metricsCollector.calculateErrorRate().toFixed(2)}%`
    },
    issues: health.issues
  };

  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'warning' ? 200 : 503;

  res.status(statusCode).json(response);
};

/**
 * Middleware para coleta de métricas personalizadas
 */
const customMetrics = (metricName, value = 1) => {
  return (req, res, next) => {
    metricsCollector.increment(`custom.${metricName}`, value);
    next();
  };
};

/**
 * Middleware para tracking de eventos de negócio
 */
const trackBusinessEvent = (eventName) => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(obj) {
      if (res.statusCode < 400) {
        metricsCollector.increment(`events.${eventName}`);
        
        // Log do evento para análise posterior
        logger.info('Evento de negócio registrado', {
          event: eventName,
          userId: req.user?.userId,
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        });
      }
      
      return originalJson.call(this, obj);
    };
    
    next();
  };
};

/**
 * Middleware para métricas de cache (se usar Redis)
 */
const cacheMetrics = (req, res, next) => {
  // Interceptar operações de cache se estiverem implementadas
  const originalRedisGet = req.redis?.get;
  const originalRedisSet = req.redis?.set;

  if (originalRedisGet) {
    req.redis.get = async function(...args) {
      const result = await originalRedisGet.apply(this, args);
      
      if (result) {
        metricsCollector.increment('cache.hits');
      } else {
        metricsCollector.increment('cache.misses');
      }
      
      return result;
    };
  }

  if (originalRedisSet) {
    req.redis.set = async function(...args) {
      metricsCollector.increment('cache.sets');
      return await originalRedisSet.apply(this, args);
    };
  }

  next();
};

/**
 * Middleware para alertas baseados em métricas
 */
const metricsAlerts = (req, res, next) => {
  // Verificar alertas após cada request
  res.on('finish', () => {
    checkAndSendAlerts();
  });

  next();
};

/**
 * Verificar condições de alerta
 */
const checkAndSendAlerts = () => {
  const metrics = metricsCollector.metrics;
  const now = Date.now();

  // Verificar taxa de erro alta
  const errorRate = metricsCollector.calculateErrorRate();
  if (errorRate > 15 && !alertCooldowns.highErrorRate) {
    sendAlert('HIGH_ERROR_RATE', `Taxa de erro: ${errorRate.toFixed(2)}%`);
    alertCooldowns.highErrorRate = now + (15 * 60 * 1000); // 15 min cooldown
  }

  // Verificar tempo de resposta alto
  const avgResponseTime = metrics.performance.responseTime.avg;
  if (avgResponseTime > 3000 && !alertCooldowns.slowResponse) {
    sendAlert('SLOW_RESPONSE', `Tempo médio: ${avgResponseTime.toFixed(0)}ms`);
    alertCooldowns.slowResponse = now + (10 * 60 * 1000); // 10 min cooldown
  }

  // Verificar falhas de hardware
  const hardwareErrorRate = metricsCollector.calculateHardwareErrorRate();
  if (hardwareErrorRate > 25 && !alertCooldowns.hardwareError) {
    sendAlert('HARDWARE_ISSUES', `Taxa de falha: ${hardwareErrorRate.toFixed(2)}%`);
    alertCooldowns.hardwareError = now + (5 * 60 * 1000); // 5 min cooldown
  }

  // Limpar cooldowns expirados
  Object.keys(alertCooldowns).forEach(key => {
    if (alertCooldowns[key] < now) {
      delete alertCooldowns[key];
    }
  });
};

// Cooldowns para evitar spam de alertas
const alertCooldowns = {};

/**
 * Enviar alerta
 */
const sendAlert = (type, message) => {
  logger.warn(`ALERTA: ${type}`, {
    type,
    message,
    timestamp: new Date().toISOString(),
    metrics: metricsCollector.getReport().metrics
  });

  // Aqui você pode integrar com sistemas de alerta externos
  // como Slack, PagerDuty, email, etc.
};

/**
 * Funções auxiliares
 */
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  return `${days}d ${hours}h ${minutes}m`;
};

/**
 * Middleware para exportar métricas para serviços externos
 */
const exportMetrics = async () => {
  try {
    const report = metricsCollector.getReport();
    
    // Exemplo: enviar para serviço de monitoramento
    if (process.env.METRICS_WEBHOOK_URL) {
      const response = await fetch(process.env.METRICS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'smart-lock-system',
          timestamp: new Date().toISOString(),
          metrics: report.metrics
        })
      });

      if (!response.ok) {
        logger.error('Falha ao exportar métricas', {
          status: response.status,
          statusText: response.statusText
        });
      }
    }
  } catch (error) {
    logger.error('Erro ao exportar métricas:', error);
  }
};

// Exportar métricas a cada 5 minutos
if (process.env.NODE_ENV === 'production' && process.env.METRICS_WEBHOOK_URL) {
  setInterval(exportMetrics, 5 * 60 * 1000);
}

// Cleanup quando processo terminar
process.on('SIGTERM', () => {
  metricsCollector.stop();
});

process.on('SIGINT', () => {
  metricsCollector.stop();
});

module.exports = {
  collectMetrics,
  hardwareMetrics,
  businessMetrics,
  securityMetrics,
  rateLimitMetrics,
  errorMetrics,
  prometheusMetrics,
  metricsReport,
  resetMetrics,
  healthCheck,
  customMetrics,
  trackBusinessEvent,
  cacheMetrics,
  metricsAlerts,
  metricsCollector
};