const crypto = require('crypto');
const { format, addDays, addHours, differenceInMinutes, differenceInHours } = require('date-fns');
const { ptBR } = require('date-fns/locale');

class Helpers {
  // Utilitários de string
  static capitalize(str) {
    if (typeof str !== 'string' || str.length === 0) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  static capitalizeWords(str) {
    if (typeof str !== 'string') return '';
    return str.split(' ')
      .map(word => this.capitalize(word))
      .join(' ');
  }

  static generateRandomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static generateUUID() {
    return crypto.randomUUID();
  }

  static slugify(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .trim()
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/-+/g, '-'); // Remove hífens duplicados
  }

  static truncate(text, maxLength = 100, suffix = '...') {
    if (typeof text !== 'string' || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  static maskEmail(email) {
    if (!email || typeof email !== 'string') return '';
    
    const [name, domain] = email.split('@');
    if (!name || !domain) return email;
    
    const maskedName = name.length > 2 
      ? name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1)
      : name;
    
    return `${maskedName}@${domain}`;
  }

  // Utilitários de data e tempo
  static formatDate(date, pattern = 'dd/MM/yyyy') {
    if (!date) return '';
    
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return format(dateObj, pattern, { locale: ptBR });
    } catch (error) {
      return '';
    }
  }

  static formatDateTime(date, pattern = 'dd/MM/yyyy HH:mm:ss') {
    return this.formatDate(date, pattern);
  }

  static formatRelativeTime(date) {
    if (!date) return '';
    
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      const now = new Date();
      const diffMinutes = differenceInMinutes(now, dateObj);
      
      if (diffMinutes < 1) return 'agora mesmo';
      if (diffMinutes < 60) return `há ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
      
      const diffHours = differenceInHours(now, dateObj);
      if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
      
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
      
      return this.formatDate(dateObj);
    } catch (error) {
      return '';
    }
  }

  static addHoursToDate(date, hours) {
    const dateObj = date instanceof Date ? date : new Date(date);
    return addHours(dateObj, hours);
  }

  static addDaysToDate(date, days) {
    const dateObj = date instanceof Date ? date : new Date(date);
    return addDays(dateObj, days);
  }

  static isOverdue(deadline) {
    if (!deadline) return false;
    const deadlineObj = deadline instanceof Date ? deadline : new Date(deadline);
    return new Date() > deadlineObj;
  }

  static getTimeUntilDeadline(deadline) {
    if (!deadline) return null;
    
    const deadlineObj = deadline instanceof Date ? deadline : new Date(deadline);
    const now = new Date();
    const diffMinutes = differenceInMinutes(deadlineObj, now);
    
    if (diffMinutes <= 0) return { expired: true, message: 'Vencido' };
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return { 
        expired: false, 
        days,
        hours: hours % 24,
        minutes,
        message: `${days} dia${days > 1 ? 's' : ''} e ${hours % 24} hora${(hours % 24) > 1 ? 's' : ''}`
      };
    }
    
    if (hours > 0) {
      return { 
        expired: false,
        hours,
        minutes,
        message: `${hours} hora${hours > 1 ? 's' : ''} e ${minutes} minuto${minutes > 1 ? 's' : ''}`
      };
    }
    
    return { 
      expired: false,
      minutes,
      message: `${minutes} minuto${minutes > 1 ? 's' : ''}`
    };
  }

  // Utilitários de números
  static formatCurrency(amount, currency = 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  static formatNumber(number, decimals = 0) {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number);
  }

  static formatPercentage(value, decimals = 1) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value / 100);
  }

  static roundToDecimals(number, decimals = 2) {
    return Number(Math.round(number + 'e' + decimals) + 'e-' + decimals);
  }

  static randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // Utilitários de array
  static arrayRemoveDuplicates(array) {
    return [...new Set(array)];
  }

  static arrayChunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  static arrayShuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static arrayGroupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
      return groups;
    }, {});
  }

  // Utilitários de objeto
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  }

  static objectPick(obj, keys) {
    const picked = {};
    keys.forEach(key => {
      if (obj.hasOwnProperty(key)) {
        picked[key] = obj[key];
      }
    });
    return picked;
  }

  static objectOmit(obj, keys) {
    const omitted = { ...obj };
    keys.forEach(key => delete omitted[key]);
    return omitted;
  }

  static flattenObject(obj, prefix = '') {
    const flattened = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          Object.assign(flattened, this.flattenObject(obj[key], newKey));
        } else {
          flattened[newKey] = obj[key];
        }
      }
    }
    
    return flattened;
  }

  // Utilitários de validação e conversão
  static parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'sim';
    }
    if (typeof value === 'number') return value !== 0;
    return false;
  }

  static safeJsonParse(jsonString, defaultValue = null) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      return defaultValue;
    }
  }

  static safeJsonStringify(obj, replacer = null, space = 0) {
    try {
      return JSON.stringify(obj, replacer, space);
    } catch (error) {
      return '{}';
    }
  }

  // Utilitários específicos do Smart Lock System
  static generateCabinetId(sequence) {
    return `CAB${sequence.toString().padStart(3, '0')}`;
  }

  static formatLockerNumber(number) {
    return number.toString().padStart(2, '0');
  }

  static generateQRCode(type, cabinetId, lockerNumber = null) {
    switch (type) {
      case 'access':
        return `CABINET_${cabinetId}_ACCESS`;
      case 'return':
        return `RETURN_${cabinetId}_${this.formatLockerNumber(lockerNumber)}`;
      case 'maintenance':
        return `MAINTENANCE_${cabinetId}`;
      default:
        throw new Error('Tipo de QR Code inválido');
    }
  }

  static parseQRCode(qrCode) {
    if (!qrCode || typeof qrCode !== 'string') {
      return { valid: false, error: 'QR Code inválido' };
    }

    // Padrão para acesso ao armário
    const accessMatch = qrCode.match(/^CABINET_([A-Z0-9]+)_ACCESS$/);
    if (accessMatch) {
      return {
        valid: true,
        type: 'access',
        cabinetId: accessMatch[1]
      };
    }

    // Padrão para devolução
    const returnMatch = qrCode.match(/^RETURN_([A-Z0-9]+)_(\d{2})$/);
    if (returnMatch) {
      return {
        valid: true,
        type: 'return',
        cabinetId: returnMatch[1],
        lockerNumber: parseInt(returnMatch[2])
      };
    }

    // Padrão para manutenção
    const maintenanceMatch = qrCode.match(/^MAINTENANCE_([A-Z0-9]+)$/);
    if (maintenanceMatch) {
      return {
        valid: true,
        type: 'maintenance',
        cabinetId: maintenanceMatch[1]
      };
    }

    return { valid: false, error: 'Formato de QR Code não reconhecido' };
  }

  static calculateReturnDeadline(borrowDate, userType = 'student') {
    const borrow = borrowDate instanceof Date ? borrowDate : new Date(borrowDate);
    
    // Diferentes prazos baseados no tipo de usuário
    const deadlineHours = {
      student: 4,      // 4 horas para estudantes
      professor: 24,   // 24 horas para professores
      staff: 24,       // 24 horas para funcionários
      admin: 72        // 72 horas para administradores
    };

    const hours = deadlineHours[userType] || deadlineHours.student;
    return this.addHoursToDate(borrow, hours);
  }

  static getTransactionStatus(borrowDate, returnDate, actualReturnDate) {
    if (actualReturnDate) {
      return 'returned';
    }
    
    if (this.isOverdue(returnDate)) {
      return 'overdue';
    }
    
    return 'active';
  }

  // Utilitários de hash e criptografia básica
  static generateHash(data, algorithm = 'sha256') {
    return crypto
      .createHash(algorithm)
      .update(data)
      .digest('hex');
  }

  static generateSalt(length = 16) {
    return crypto.randomBytes(length).toString('hex');
  }

  static generateApiKey() {
    return this.generateHash(this.generateUUID() + Date.now()).substring(0, 32);
  }

  // Utilitários de URL e path
  static joinPath(...parts) {
    return parts
      .map(part => part.replace(/^\/+|\/+$/g, ''))
      .filter(part => part.length > 0)
      .join('/');
  }

  static getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') return '';
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.substring(lastDot + 1).toLowerCase();
  }

  static generateFilename(originalName, prefix = '') {
    const extension = this.getFileExtension(originalName);
    const timestamp = Date.now();
    const random = this.generateRandomString(8);
    
    const baseName = prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
    return extension ? `${baseName}.${extension}` : baseName;
  }

  // Utilitários de performance e debounce
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  static measureExecutionTime(func) {
    return async function(...args) {
      const start = Date.now();
      const result = await func.apply(this, args);
      const end = Date.now();
      
      console.log(`Function ${func.name} executed in ${end - start}ms`);
      return result;
    };
  }

  // Utilitários de rede e API
  static isValidPort(port) {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  static buildQueryString(params) {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(item => searchParams.append(key, item));
        } else {
          searchParams.append(key, value);
        }
      }
    });
    
    return searchParams.toString();
  }

  static parseUserAgent(userAgent) {
    if (!userAgent) return { browser: 'Unknown', os: 'Unknown' };
    
    // Detecção simples de navegador
    let browser = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';
    
    // Detecção simples de OS
    let os = 'Unknown';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac OS')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    
    return { browser, os };
  }

  // Utilitários de log e debug
  static formatLogMessage(level, message, metadata = {}) {
    const timestamp = this.formatDateTime(new Date());
    const meta = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : '';
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${meta}`.trim();
  }

  static createResponseBody(success, data = null, message = null, errors = null) {
    const response = { success };
    
    if (data !== null) response.data = data;
    if (message) response.message = message;
    if (errors) response.errors = errors;
    if (!success && !message) response.message = 'Operação falhou';
    
    return response;
  }

  static createPaginationMeta(page, limit, total) {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }

  // Utilitários de cleanup e formatação
  static removeEmptyFields(obj) {
    const cleaned = {};
    
    Object.entries(obj).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'object' && !Array.isArray(value)) {
          const nestedCleaned = this.removeEmptyFields(value);
          if (Object.keys(nestedCleaned).length > 0) {
            cleaned[key] = nestedCleaned;
          }
        } else {
          cleaned[key] = value;
        }
      }
    });
    
    return cleaned;
  }

  static wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static retry(fn, maxAttempts = 3, delay = 1000) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const attempt = async () => {
        try {
          attempts++;
          const result = await fn();
          resolve(result);
        } catch (error) {
          if (attempts >= maxAttempts) {
            reject(error);
          } else {
            setTimeout(attempt, delay * attempts);
          }
        }
      };
      
      attempt();
    });
  }
}

module.exports = Helpers;