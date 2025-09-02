const { format, isValid, parseISO, isFuture, isPast } = require('date-fns');

class Validators {
  // Validações básicas de string
  static isString(value) {
    return typeof value === 'string';
  }

  static isNotEmpty(value) {
    return value && value.toString().trim().length > 0;
  }

  static minLength(value, min) {
    return value && value.toString().length >= min;
  }

  static maxLength(value, max) {
    return value && value.toString().length <= max;
  }

  static lengthRange(value, min, max) {
    return this.minLength(value, min) && this.maxLength(value, max);
  }

  // Validações de email
  static isEmail(email) {
    if (!this.isString(email)) return false;
    
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email.toLowerCase());
  }

  static isUniversityEmail(email) {
    if (!this.isEmail(email)) return false;
    
    const universityDomains = [
      '.edu.br',
      '.edu',
      '.ac.br',
      '.university.',
      '.uni.',
      '@ufsc.br',
      '@usp.br',
      '@unicamp.br'
    ];

    return universityDomains.some(domain => 
      email.toLowerCase().includes(domain)
    );
  }

  // Validações de senha
  static isStrongPassword(password) {
    if (!this.isString(password) || password.length < 8) return false;

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    return hasLower && hasUpper && hasNumber && hasSpecial;
  }

  static isValidPasswordLength(password) {
    return this.lengthRange(password, 8, 128);
  }

  // Validações de números
  static isNumber(value) {
    return typeof value === 'number' && !isNaN(value);
  }

  static isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
  }

  static isNonNegativeInteger(value) {
    return Number.isInteger(value) && value >= 0;
  }

  static isInRange(value, min, max) {
    return this.isNumber(value) && value >= min && value <= max;
  }

  // Validações específicas do sistema
  static isValidCabinetId(cabinetId) {
    if (!this.isString(cabinetId)) return false;
    
    // Formato: CAB001, CAB002, etc.
    const cabinetRegex = /^CAB\d{3}$/;
    return cabinetRegex.test(cabinetId);
  }

  static isValidLockerNumber(lockerNumber) {
    if (!this.isString(lockerNumber) && !this.isNumber(lockerNumber)) return false;
    
    const num = typeof lockerNumber === 'string' ? 
      parseInt(lockerNumber) : lockerNumber;
    
    // Lockers de 01 a 99
    return this.isInRange(num, 1, 99);
  }

  static isValidQRCode(qrCode) {
    if (!this.isString(qrCode)) return false;
    
    // Formato: CABINET_CAB001_ACCESS ou RETURN_CAB001_05
    const qrPatterns = [
      /^CABINET_CAB\d{3}_ACCESS$/,
      /^RETURN_CAB\d{3}_\d{2}$/,
      /^MAINTENANCE_CAB\d{3}$/
    ];

    return qrPatterns.some(pattern => pattern.test(qrCode));
  }

  static isValidUserType(userType) {
    const validTypes = ['student', 'professor', 'staff', 'admin'];
    return validTypes.includes(userType);
  }

  static isValidTransactionStatus(status) {
    const validStatuses = ['active', 'returned', 'overdue', 'maintenance'];
    return validStatuses.includes(status);
  }

  // Validações de data
  static isValidDate(date) {
    if (date instanceof Date) {
      return isValid(date);
    }
    
    if (this.isString(date)) {
      const parsed = parseISO(date);
      return isValid(parsed);
    }
    
    return false;
  }

  static isFutureDate(date) {
    if (!this.isValidDate(date)) return false;
    
    const dateObj = date instanceof Date ? date : parseISO(date);
    return isFuture(dateObj);
  }

  static isPastDate(date) {
    if (!this.isValidDate(date)) return false;
    
    const dateObj = date instanceof Date ? date : parseISO(date);
    return isPast(dateObj);
  }

  static isValidReturnDeadline(borrowDate, returnDate) {
    if (!this.isValidDate(borrowDate) || !this.isValidDate(returnDate)) {
      return false;
    }

    const borrow = borrowDate instanceof Date ? borrowDate : parseISO(borrowDate);
    const returnDeadline = returnDate instanceof Date ? returnDate : parseISO(returnDate);

    // Return deve ser pelo menos 1 hora após borrow e no máximo 7 dias
    const oneHourLater = new Date(borrow.getTime() + 60 * 60 * 1000);
    const sevenDaysLater = new Date(borrow.getTime() + 7 * 24 * 60 * 60 * 1000);

    return returnDeadline >= oneHourLater && returnDeadline <= sevenDaysLater;
  }

  // Validações de arquivo
  static isValidImageFile(filename) {
    if (!this.isString(filename)) return false;
    
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    return validExtensions.includes(extension);
  }

  static isValidFileSize(sizeInBytes, maxSizeInMB = 5) {
    return this.isNumber(sizeInBytes) && 
           sizeInBytes > 0 && 
           sizeInBytes <= maxSizeInMB * 1024 * 1024;
  }

  // Validações de IP e rede
  static isValidIPv4(ip) {
    if (!this.isString(ip)) return false;
    
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  static isValidPort(port) {
    return this.isInRange(port, 1, 65535);
  }

  static isValidURL(url) {
    if (!this.isString(url)) return false;
    
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Validações de JWT
  static isValidJWTFormat(token) {
    if (!this.isString(token)) return false;
    
    const parts = token.split('.');
    return parts.length === 3 && 
           parts.every(part => part.length > 0);
  }

  // Validações de JSON
  static isValidJSON(jsonString) {
    if (!this.isString(jsonString)) return false;
    
    try {
      JSON.parse(jsonString);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Validações customizadas com mensagens de erro
  static validateField(value, rules) {
    const errors = [];

    for (const rule of rules) {
      const { type, message, ...params } = rule;

      let isValid = false;

      switch (type) {
        case 'required':
          isValid = this.isNotEmpty(value);
          break;
        case 'email':
          isValid = this.isEmail(value);
          break;
        case 'universityEmail':
          isValid = this.isUniversityEmail(value);
          break;
        case 'strongPassword':
          isValid = this.isStrongPassword(value);
          break;
        case 'minLength':
          isValid = this.minLength(value, params.min);
          break;
        case 'maxLength':
          isValid = this.maxLength(value, params.max);
          break;
        case 'range':
          isValid = this.isInRange(value, params.min, params.max);
          break;
        case 'cabinetId':
          isValid = this.isValidCabinetId(value);
          break;
        case 'lockerNumber':
          isValid = this.isValidLockerNumber(value);
          break;
        case 'qrCode':
          isValid = this.isValidQRCode(value);
          break;
        case 'userType':
          isValid = this.isValidUserType(value);
          break;
        case 'date':
          isValid = this.isValidDate(value);
          break;
        case 'futureDate':
          isValid = this.isFutureDate(value);
          break;
        case 'ipv4':
          isValid = this.isValidIPv4(value);
          break;
        case 'url':
          isValid = this.isValidURL(value);
          break;
        default:
          isValid = true;
      }

      if (!isValid) {
        errors.push(message || `Validation failed for rule: ${type}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validação de objeto completo
  static validateObject(obj, schema) {
    const results = {};
    let hasErrors = false;

    for (const [fieldName, rules] of Object.entries(schema)) {
      const value = obj[fieldName];
      const validation = this.validateField(value, rules);
      
      results[fieldName] = validation;
      
      if (!validation.isValid) {
        hasErrors = true;
      }
    }

    return {
      isValid: !hasErrors,
      fields: results,
      getAllErrors: () => {
        const allErrors = [];
        for (const [field, validation] of Object.entries(results)) {
          if (!validation.isValid) {
            validation.errors.forEach(error => {
              allErrors.push(`${field}: ${error}`);
            });
          }
        }
        return allErrors;
      }
    };
  }

  // Sanitização de dados
  static sanitizeString(str) {
    if (!this.isString(str)) return '';
    
    return str
      .trim()
      .replace(/[<>\"']/g, '') // Remove caracteres perigosos
      .slice(0, 1000); // Limita tamanho
  }

  static sanitizeEmail(email) {
    if (!this.isString(email)) return '';
    
    return email.toLowerCase().trim();
  }

  static sanitizeNumber(num, defaultValue = 0) {
    const parsed = parseInt(num);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  // Helpers para validação de requests HTTP
  static validateLoginRequest(body) {
    return this.validateObject(body, {
      email: [
        { type: 'required', message: 'Email é obrigatório' },
        { type: 'email', message: 'Email deve ter formato válido' }
      ],
      password: [
        { type: 'required', message: 'Senha é obrigatória' },
        { type: 'minLength', min: 8, message: 'Senha deve ter pelo menos 8 caracteres' }
      ]
    });
  }

  static validateQRRequest(body) {
    return this.validateObject(body, {
      qrCode: [
        { type: 'required', message: 'QR Code é obrigatório' },
        { type: 'qrCode', message: 'QR Code deve ter formato válido' }
      ]
    });
  }

  static validateBorrowRequest(body) {
    return this.validateObject(body, {
      cabinetId: [
        { type: 'required', message: 'ID do armário é obrigatório' },
        { type: 'cabinetId', message: 'ID do armário deve ter formato válido' }
      ],
      lockerNumber: [
        { type: 'required', message: 'Número do locker é obrigatório' },
        { type: 'lockerNumber', message: 'Número do locker deve ser válido (1-99)' }
      ]
    });
  }

  static validateUserRegistration(body) {
    return this.validateObject(body, {
      name: [
        { type: 'required', message: 'Nome é obrigatório' },
        { type: 'minLength', min: 2, message: 'Nome deve ter pelo menos 2 caracteres' },
        { type: 'maxLength', max: 100, message: 'Nome deve ter no máximo 100 caracteres' }
      ],
      email: [
        { type: 'required', message: 'Email é obrigatório' },
        { type: 'universityEmail', message: 'Email deve ser de uma instituição educacional' }
      ],
      password: [
        { type: 'required', message: 'Senha é obrigatória' },
        { type: 'strongPassword', message: 'Senha deve conter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial' }
      ],
      userType: [
        { type: 'required', message: 'Tipo de usuário é obrigatório' },
        { type: 'userType', message: 'Tipo de usuário deve ser: student, professor, staff ou admin' }
      ]
    });
  }
}

module.exports = Validators;