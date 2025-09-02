const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { SECURITY_CONFIG } = require('./constants');

class Encryption {
  constructor() {
    this.algorithm = SECURITY_CONFIG.ENCRYPTION_ALGORITHM;
    this.hashAlgorithm = SECURITY_CONFIG.HASH_ALGORITHM;
    this.bcryptRounds = SECURITY_CONFIG.BCRYPT_ROUNDS;
    this.jwtAlgorithm = SECURITY_CONFIG.JWT_ALGORITHM;
  }

  // ===== HASH DE SENHAS =====
  
  /**
   * Gera hash da senha usando bcrypt
   * @param {string} password - Senha em texto plano
   * @returns {Promise<string>} Hash da senha
   */
  async hashPassword(password) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Senha deve ser uma string válida');
      }

      const salt = await bcrypt.genSalt(this.bcryptRounds);
      const hash = await bcrypt.hash(password, salt);
      
      return hash;
    } catch (error) {
      throw new Error(`Erro ao gerar hash da senha: ${error.message}`);
    }
  }

  /**
   * Compara senha com hash
   * @param {string} password - Senha em texto plano
   * @param {string} hash - Hash armazenado
   * @returns {Promise<boolean>} True se a senha estiver correta
   */
  async comparePassword(password, hash) {
    try {
      if (!password || !hash) {
        return false;
      }

      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Erro ao comparar senha:', error);
      return false;
    }
  }

  // ===== CRIPTOGRAFIA SIMÉTRICA =====

  /**
   * Gera chave de criptografia aleatória
   * @returns {string} Chave em formato hex
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Criptografa dados usando AES-256-GCM
   * @param {string} text - Texto a ser criptografado
   * @param {string} key - Chave de criptografia (opcional, usa variável de ambiente)
   * @returns {object} Objeto com dados criptografados e metadados
   */
  encrypt(text, key = null) {
    try {
      if (!text) {
        throw new Error('Texto não pode estar vazio');
      }

      const encryptionKey = key || process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('Chave de criptografia não fornecida');
      }

      // Converter chave para buffer se necessário
      const keyBuffer = typeof encryptionKey === 'string' 
        ? Buffer.from(encryptionKey, 'hex')
        : encryptionKey;

      // Gerar IV aleatório
      const iv = crypto.randomBytes(16);
      
      // Criar cipher
      const cipher = crypto.createCipher(this.algorithm, keyBuffer);
      cipher.setAAD(Buffer.from('smartlock', 'utf8'));

      // Criptografar
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Obter tag de autenticação
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm: this.algorithm
      };
    } catch (error) {
      throw new Error(`Erro na criptografia: ${error.message}`);
    }
  }

  /**
   * Descriptografa dados
   * @param {object} encryptedData - Dados criptografados
   * @param {string} key - Chave de descriptografia
   * @returns {string} Texto descriptografado
   */
  decrypt(encryptedData, key = null) {
    try {
      const { encrypted, iv, authTag, algorithm } = encryptedData;
      
      if (!encrypted || !iv || !authTag) {
        throw new Error('Dados criptografados incompletos');
      }

      const decryptionKey = key || process.env.ENCRYPTION_KEY;
      if (!decryptionKey) {
        throw new Error('Chave de descriptografia não fornecida');
      }

      // Converter para buffers
      const keyBuffer = typeof decryptionKey === 'string'
        ? Buffer.from(decryptionKey, 'hex')
        : decryptionKey;
      
      const ivBuffer = Buffer.from(iv, 'hex');
      const authTagBuffer = Buffer.from(authTag, 'hex');

      // Criar decipher
      const decipher = crypto.createDecipher(algorithm || this.algorithm, keyBuffer);
      decipher.setAAD(Buffer.from('smartlock', 'utf8'));
      decipher.setAuthTag(authTagBuffer);

      // Descriptografar
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Erro na descriptografia: ${error.message}`);
    }
  }

  // ===== HASH DE DADOS =====

  /**
   * Gera hash SHA-256 de dados
   * @param {string} data - Dados para hash
   * @param {string} salt - Salt opcional
   * @returns {string} Hash em formato hex
   */
  generateHash(data, salt = '') {
    if (!data) {
      throw new Error('Dados para hash não podem estar vazios');
    }

    return crypto
      .createHash(this.hashAlgorithm)
      .update(data + salt)
      .digest('hex');
  }

  /**
   * Gera hash HMAC
   * @param {string} data - Dados para hash
   * @param {string} secret - Chave secreta
   * @returns {string} Hash HMAC
   */
  generateHMAC(data, secret) {
    if (!data || !secret) {
      throw new Error('Dados e chave secreta são obrigatórios');
    }

    return crypto
      .createHmac(this.hashAlgorithm, secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verifica hash HMAC
   * @param {string} data - Dados originais
   * @param {string} hash - Hash para verificação
   * @param {string} secret - Chave secreta
   * @returns {boolean} True se o hash estiver correto
   */
  verifyHMAC(data, hash, secret) {
    try {
      const expectedHash = this.generateHMAC(data, secret);
      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(expectedHash, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  // ===== JWT TOKENS =====

  /**
   * Gera token JWT
   * @param {object} payload - Dados do payload
   * @param {string} expiresIn - Tempo de expiração
   * @returns {string} Token JWT
   */
  generateJWT(payload, expiresIn = '8h') {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET não configurado');
      }

      const options = {
        expiresIn,
        algorithm: this.jwtAlgorithm,
        issuer: 'smartlock-system',
        audience: 'smartlock-users'
      };

      return jwt.sign(payload, secret, options);
    } catch (error) {
      throw new Error(`Erro ao gerar JWT: ${error.message}`);
    }
  }

  /**
   * Verifica e decodifica token JWT
   * @param {string} token - Token JWT
   * @returns {object} Payload decodificado
   */
  verifyJWT(token) {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET não configurado');
      }

      const options = {
        algorithms: [this.jwtAlgorithm],
        issuer: 'smartlock-system',
        audience: 'smartlock-users'
      };

      return jwt.verify(token, secret, options);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expirado');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Token inválido');
      } else {
        throw new Error(`Erro na verificação do JWT: ${error.message}`);
      }
    }
  }

  /**
   * Decodifica JWT sem verificar assinatura (apenas para debug)
   * @param {string} token - Token JWT
   * @returns {object} Payload decodificado
   */
  decodeJWT(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      throw new Error(`Erro ao decodificar JWT: ${error.message}`);
    }
  }

  // ===== GERADORES ALEATÓRIOS =====

  /**
   * Gera string aleatória
   * @param {number} length - Tamanho da string
   * @param {string} charset - Conjunto de caracteres
   * @returns {string} String aleatória
   */
  generateRandomString(length = 32, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    let result = '';
    const bytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length];
    }
    
    return result;
  }

  /**
   * Gera UUID v4
   * @returns {string} UUID
   */
  generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * Gera código numérico aleatório
   * @param {number} digits - Número de dígitos
   * @returns {string} Código numérico
   */
  generateNumericCode(digits = 6) {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Gera salt aleatório
   * @param {number} bytes - Número de bytes
   * @returns {string} Salt em formato hex
   */
  generateSalt(bytes = 16) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  // ===== TOKENS DE API =====

  /**
   * Gera token de API
   * @param {string} prefix - Prefixo do token
   * @returns {string} Token de API
   */
  generateApiToken(prefix = 'sl') {
    const timestamp = Date.now().toString(36);
    const random = this.generateRandomString(24);
    const hash = this.generateHash(timestamp + random).substring(0, 16);
    
    return `${prefix}_${timestamp}_${random}_${hash}`;
  }

  /**
   * Gera token de reset de senha
   * @param {string} userId - ID do usuário
   * @returns {object} Token e hash para verificação
   */
  generateResetToken(userId) {
    const token = this.generateRandomString(32);
    const timestamp = Date.now();
    const data = `${userId}:${timestamp}:${token}`;
    const hash = this.generateHash(data, process.env.JWT_SECRET);
    
    return {
      token,
      hash,
      expiresAt: new Date(timestamp + 24 * 60 * 60 * 1000) // 24 horas
    };
  }

  /**
   * Verifica token de reset de senha
   * @param {string} token - Token de reset
   * @param {string} hash - Hash para verificação
   * @param {string} userId - ID do usuário
   * @param {Date} expiresAt - Data de expiração
   * @returns {boolean} True se o token estiver válido
   */
  verifyResetToken(token, hash, userId, expiresAt) {
    try {
      // Verificar se não expirou
      if (new Date() > new Date(expiresAt)) {
        return false;
      }

      // Reconstruir dados
      const timestamp = new Date(expiresAt).getTime() - 24 * 60 * 60 * 1000;
      const data = `${userId}:${timestamp}:${token}`;
      const expectedHash = this.generateHash(data, process.env.JWT_SECRET);

      // Comparação segura
      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(expectedHash, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  // ===== CRIPTOGRAFIA DE DADOS SENSÍVEIS =====

  /**
   * Criptografa dados sensíveis (PII)
   * @param {object} data - Dados sensíveis
   * @returns {string} Dados criptografados em Base64
   */
  encryptSensitiveData(data) {
    const jsonString = JSON.stringify(data);
    const encrypted = this.encrypt(jsonString);
    return Buffer.from(JSON.stringify(encrypted)).toString('base64');
  }

  /**
   * Descriptografa dados sensíveis
   * @param {string} encryptedData - Dados criptografados em Base64
   * @returns {object} Dados descriptografados
   */
  decryptSensitiveData(encryptedData) {
    try {
      const encryptedObj = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
      const decrypted = this.decrypt(encryptedObj);
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Erro ao descriptografar dados sensíveis: ${error.message}`);
    }
  }

  // ===== MASCARAMENTO DE DADOS =====

  /**
   * Mascara email parcialmente
   * @param {string} email - Email para mascarar
   * @returns {string} Email mascarado
   */
  maskEmail(email) {
    if (!email || !email.includes('@')) return '';
    
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) return email;
    
    const masked = localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
    return `${masked}@${domain}`;
  }

  /**
   * Mascara número de telefone
   * @param {string} phone - Telefone para mascarar
   * @returns {string} Telefone mascarado
   */
  maskPhone(phone) {
    if (!phone) return '';
    
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 8) return phone;
    
    const start = cleaned.substring(0, 2);
    const end = cleaned.substring(cleaned.length - 2);
    const middle = '*'.repeat(cleaned.length - 4);
    
    return start + middle + end;
  }

  /**
   * Mascara documento (CPF/CNPJ)
   * @param {string} document - Documento para mascarar
   * @returns {string} Documento mascarado
   */
  maskDocument(document) {
    if (!document) return '';
    
    const cleaned = document.replace(/\D/g, '');
    if (cleaned.length < 6) return document;
    
    const start = cleaned.substring(0, 3);
    const end = cleaned.substring(cleaned.length - 2);
    const middle = '*'.repeat(cleaned.length - 5);
    
    return start + middle + end;
  }

  // ===== VALIDAÇÃO DE INTEGRIDADE =====

  /**
   * Gera checksum para validação de integridade
   * @param {object|string} data - Dados para gerar checksum
   * @returns {string} Checksum
   */
  generateChecksum(data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return this.generateHash(dataString);
  }

  /**
   * Valida integridade dos dados
   * @param {object|string} data - Dados originais
   * @param {string} checksum - Checksum para comparação
   * @returns {boolean} True se os dados estiverem íntegros
   */
  validateIntegrity(data, checksum) {
    try {
      const currentChecksum = this.generateChecksum(data);
      return crypto.timingSafeEqual(
        Buffer.from(checksum, 'hex'),
        Buffer.from(currentChecksum, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  // ===== ASSINATURA DIGITAL =====

  /**
   * Assina dados digitalmente
   * @param {string} data - Dados para assinar
   * @param {string} privateKey - Chave privada
   * @returns {string} Assinatura em formato hex
   */
  signData(data, privateKey = null) {
    try {
      const key = privateKey || process.env.PRIVATE_KEY;
      if (!key) {
        throw new Error('Chave privada não fornecida');
      }

      const sign = crypto.createSign('RSA-SHA256');
      sign.update(data);
      return sign.sign(key, 'hex');
    } catch (error) {
      throw new Error(`Erro ao assinar dados: ${error.message}`);
    }
  }

  /**
   * Verifica assinatura digital
   * @param {string} data - Dados originais
   * @param {string} signature - Assinatura para verificar
   * @param {string} publicKey - Chave pública
   * @returns {boolean} True se a assinatura for válida
   */
  verifySignature(data, signature, publicKey = null) {
    try {
      const key = publicKey || process.env.PUBLIC_KEY;
      if (!key) {
        throw new Error('Chave pública não fornecida');
      }

      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(data);
      return verify.verify(key, signature, 'hex');
    } catch (error) {
      return false;
    }
  }

  // ===== DERIVAÇÃO DE CHAVES =====

  /**
   * Deriva chave usando PBKDF2
   * @param {string} password - Senha base
   * @param {string} salt - Salt
   * @param {number} iterations - Número de iterações
   * @param {number} keyLength - Tamanho da chave em bytes
   * @returns {string} Chave derivada em hex
   */
  deriveKey(password, salt, iterations = 100000, keyLength = 32) {
    try {
      return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256').toString('hex');
    } catch (error) {
      throw new Error(`Erro na derivação de chave: ${error.message}`);
    }
  }

  /**
   * Deriva chave usando scrypt
   * @param {string} password - Senha base
   * @param {string} salt - Salt
   * @param {number} keyLength - Tamanho da chave
   * @returns {Promise<string>} Chave derivada
   */
  async deriveKeyScrypt(password, salt, keyLength = 32) {
    try {
      return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, keyLength, (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey.toString('hex'));
        });
      });
    } catch (error) {
      throw new Error(`Erro na derivação de chave com scrypt: ${error.message}`);
    }
  }

  // ===== UTILITÁRIOS DE SEGURANÇA =====

  /**
   * Gera par de chaves RSA
   * @param {number} keySize - Tamanho da chave em bits
   * @returns {object} Par de chaves público/privado
   */
  generateRSAKeyPair(keySize = 2048) {
    try {
      return crypto.generateKeyPairSync('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
    } catch (error) {
      throw new Error(`Erro ao gerar par de chaves RSA: ${error.message}`);
    }
  }

  /**
   * Limpa dados sensíveis da memória
   * @param {Buffer|string} data - Dados a serem limpos
   */
  secureDelete(data) {
    if (Buffer.isBuffer(data)) {
      data.fill(0);
    } else if (typeof data === 'string') {
      // JavaScript strings são imutáveis, não podemos realmente limpá-las
      // Esta é uma limitação da linguagem
      data = null;
    }
  }

  /**
   * Compara strings de forma segura (timing-safe)
   * @param {string} a - Primeira string
   * @param {string} b - Segunda string
   * @returns {boolean} True se as strings forem iguais
   */
  safeCompare(a, b) {
    try {
      if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(a, 'utf8'),
        Buffer.from(b, 'utf8')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Gera nonce criptográfico
   * @param {number} bytes - Número de bytes
   * @returns {string} Nonce em formato hex
   */
  generateNonce(bytes = 16) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Gera timestamp assinado para prevenção de replay attacks
   * @param {number} validityWindow - Janela de validade em segundos
   * @returns {object} Timestamp e assinatura
   */
  generateSignedTimestamp(validityWindow = 300) {
    const timestamp = Math.floor(Date.now() / 1000);
    const data = `${timestamp}:${validityWindow}`;
    const signature = this.generateHMAC(data, process.env.JWT_SECRET);
    
    return {
      timestamp,
      validityWindow,
      signature,
      expiresAt: timestamp + validityWindow
    };
  }

  /**
   * Verifica timestamp assinado
   * @param {object} signedTimestamp - Timestamp assinado
   * @returns {boolean} True se for válido
   */
  verifySignedTimestamp(signedTimestamp) {
    try {
      const { timestamp, validityWindow, signature } = signedTimestamp;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      // Verificar se não expirou
      if (currentTimestamp > (timestamp + validityWindow)) {
        return false;
      }

      // Verificar assinatura
      const data = `${timestamp}:${validityWindow}`;
      return this.verifyHMAC(data, signature, process.env.JWT_SECRET);
    } catch (error) {
      return false;
    }
  }

  // ===== UTILITÁRIOS ESPECÍFICOS DO SMART LOCK =====

  /**
   * Criptografa dados de QR code
   * @param {object} qrData - Dados do QR code
   * @returns {string} QR code criptografado
   */
  encryptQRData(qrData) {
    const jsonData = JSON.stringify({
      ...qrData,
      timestamp: Date.now(),
      nonce: this.generateNonce(8)
    });
    
    const encrypted = this.encrypt(jsonData);
    return Buffer.from(JSON.stringify(encrypted)).toString('base64url');
  }

  /**
   * Descriptografa dados de QR code
   * @param {string} encryptedQR - QR code criptografado
   * @param {number} maxAge - Idade máxima em ms (default: 5 minutos)
   * @returns {object} Dados do QR code
   */
  decryptQRData(encryptedQR, maxAge = 5 * 60 * 1000) {
    try {
      const encryptedObj = JSON.parse(Buffer.from(encryptedQR, 'base64url').toString());
      const decrypted = this.decrypt(encryptedObj);
      const qrData = JSON.parse(decrypted);
      
      // Verificar idade do QR code
      if (Date.now() - qrData.timestamp > maxAge) {
        throw new Error('QR code expirado');
      }
      
      // Remover metadados internos
      delete qrData.timestamp;
      delete qrData.nonce;
      
      return qrData;
    } catch (error) {
      throw new Error(`QR code inválido: ${error.message}`);
    }
  }

  /**
   * Gera token de sessão de hardware
   * @param {string} cabinetId - ID do armário
   * @param {string} hardwareId - ID do hardware
   * @returns {string} Token de sessão
   */
  generateHardwareToken(cabinetId, hardwareId) {
    const payload = {
      cabinetId,
      hardwareId,
      type: 'hardware_session',
      iat: Math.floor(Date.now() / 1000)
    };
    
    return this.generateJWT(payload, '24h');
  }

  /**
   * Valida token de hardware
   * @param {string} token - Token a ser validado
   * @returns {object} Dados decodificados do token
   */
  validateHardwareToken(token) {
    try {
      const decoded = this.verifyJWT(token);
      
      if (decoded.type !== 'hardware_session') {
        throw new Error('Tipo de token inválido');
      }
      
      return decoded;
    } catch (error) {
      throw new Error(`Token de hardware inválido: ${error.message}`);
    }
  }

  /**
   * Criptografa logs sensíveis
   * @param {object} logData - Dados do log
   * @returns {string} Log criptografado
   */
  encryptLogData(logData) {
    // Remover dados sensíveis antes de criptografar
    const sanitizedData = {
      ...logData,
      // Mascarar email se presente
      email: logData.email ? this.maskEmail(logData.email) : undefined,
      // Mascarar telefone se presente
      phone: logData.phone ? this.maskPhone(logData.phone) : undefined,
      // Remover senhas completamente
      password: undefined,
      token: undefined
    };
    
    return this.encryptSensitiveData(sanitizedData);
  }
}

// Criar instância única
const encryption = new Encryption();

// Exportar instância e classe
module.exports = {
  Encryption,
  encryption,
  
  // Métodos de conveniência para compatibilidade
  hashPassword: (password) => encryption.hashPassword(password),
  comparePassword: (password, hash) => encryption.comparePassword(password, hash),
  generateJWT: (payload, expiresIn) => encryption.generateJWT(payload, expiresIn),
  verifyJWT: (token) => encryption.verifyJWT(token),
  encrypt: (text, key) => encryption.encrypt(text, key),
  decrypt: (encryptedData, key) => encryption.decrypt(encryptedData, key),
  generateHash: (data, salt) => encryption.generateHash(data, salt),
  generateRandomString: (length, charset) => encryption.generateRandomString(length, charset),
  generateUUID: () => encryption.generateUUID(),
  generateApiToken: (prefix) => encryption.generateApiToken(prefix),
  maskEmail: (email) => encryption.maskEmail(email),
  safeCompare: (a, b) => encryption.safeCompare(a, b)
};