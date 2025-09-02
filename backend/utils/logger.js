const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  formatMessage(level, message, metadata = {}) {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS');
    const pid = process.pid;
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      pid,
      message,
      ...metadata
    };

    return JSON.stringify(logEntry);
  }

  writeToFile(filename, content) {
    try {
      const filePath = path.join(this.logDir, filename);
      const logLine = content + '\n';
      
      fs.appendFileSync(filePath, logLine, 'utf8');
    } catch (error) {
      console.error('Erro ao escrever log:', error);
    }
  }

  log(level, message, metadata = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, metadata);
    
    // Console output
    const consoleMessage = `[${format(new Date(), 'HH:mm:ss')}] ${level.toUpperCase()}: ${message}`;
    
    switch (level) {
      case 'error':
        console.error(consoleMessage);
        this.writeToFile('error.log', formattedMessage);
        this.writeToFile('app.log', formattedMessage);
        break;
      case 'warn':
        console.warn(consoleMessage);
        this.writeToFile('app.log', formattedMessage);
        break;
      case 'info':
        console.info(consoleMessage);
        this.writeToFile('app.log', formattedMessage);
        break;
      case 'debug':
        console.debug(consoleMessage);
        this.writeToFile('app.log', formattedMessage);
        break;
    }
  }

  error(message, error = null, metadata = {}) {
    const errorInfo = {
      ...metadata,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      })
    };
    
    this.log('error', message, errorInfo);
  }

  warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  debug(message, metadata = {}) {
    this.log('debug', message, metadata);
  }

  // Logs específicos do sistema
  hardware(message, cabinetId = null, lockerNumber = null, metadata = {}) {
    const hardwareInfo = {
      ...metadata,
      cabinetId,
      lockerNumber,
      component: 'HARDWARE'
    };

    this.info(message, hardwareInfo);
    this.writeToFile('hardware.log', this.formatMessage('info', message, hardwareInfo));
  }

  access(userId, action, resource, ip = null, metadata = {}) {
    const accessInfo = {
      ...metadata,
      userId,
      action,
      resource,
      ip,
      component: 'ACCESS'
    };

    this.info(`User ${userId} performed ${action} on ${resource}`, accessInfo);
    this.writeToFile('access.log', this.formatMessage('info', `User ${userId} performed ${action} on ${resource}`, accessInfo));
  }

  transaction(transactionId, action, userId, cabinetId, lockerNumber, metadata = {}) {
    const transactionInfo = {
      ...metadata,
      transactionId,
      action,
      userId,
      cabinetId,
      lockerNumber,
      component: 'TRANSACTION'
    };

    this.info(`Transaction ${transactionId}: ${action}`, transactionInfo);
  }

  api(method, url, statusCode, responseTime, userId = null, metadata = {}) {
    const apiInfo = {
      ...metadata,
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      userId,
      component: 'API'
    };

    const level = statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${url} ${statusCode} - ${responseTime}ms`, apiInfo);
  }

  security(event, userId = null, ip = null, severity = 'warn', metadata = {}) {
    const securityInfo = {
      ...metadata,
      event,
      userId,
      ip,
      severity,
      component: 'SECURITY'
    };

    this.log(severity, `Security Event: ${event}`, securityInfo);
  }

  // Método para rotacionar logs (chamado via cron)
  rotateLogs() {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const logFiles = ['app.log', 'error.log', 'hardware.log', 'access.log'];

      logFiles.forEach(filename => {
        const currentPath = path.join(this.logDir, filename);
        const archivePath = path.join(this.logDir, `${filename.replace('.log', '')}_${today}.log`);

        if (fs.existsSync(currentPath)) {
          fs.renameSync(currentPath, archivePath);
          this.info(`Log rotacionado: ${filename} -> ${filename.replace('.log', '')}_${today}.log`);
        }
      });
    } catch (error) {
      this.error('Erro ao rotacionar logs', error);
    }
  }

  // Método para limpar logs antigos
  cleanOldLogs(daysToKeep = 30) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      files.forEach(filename => {
        const filePath = path.join(this.logDir, filename);
        const stats = fs.statSync(filePath);

        if (stats.isFile() && stats.mtime < cutoffDate && filename.includes('_')) {
          fs.unlinkSync(filePath);
          this.info(`Log antigo removido: ${filename}`);
        }
      });
    } catch (error) {
      this.error('Erro ao limpar logs antigos', error);
    }
  }

  // Método para obter estatísticas dos logs
  getLogStats() {
    try {
      const files = fs.readdirSync(this.logDir);
      const stats = {
        totalFiles: files.length,
        totalSize: 0,
        files: []
      };

      files.forEach(filename => {
        const filePath = path.join(this.logDir, filename);
        const fileStats = fs.statSync(filePath);
        
        stats.totalSize += fileStats.size;
        stats.files.push({
          name: filename,
          size: fileStats.size,
          modified: fileStats.mtime
        });
      });

      return stats;
    } catch (error) {
      this.error('Erro ao obter estatísticas dos logs', error);
      return null;
    }
  }
}

// Criar instância única do logger
const logger = new Logger();

// Middleware para logging de requisições HTTP
const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  // Capturar o final da resposta
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - start;
    const userId = req.user ? req.user.userId : null;
    
    logger.api(
      req.method,
      req.originalUrl,
      res.statusCode,
      responseTime,
      userId,
      {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        body: req.method !== 'GET' ? req.body : undefined
      }
    );
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  logger,
  httpLogger
};