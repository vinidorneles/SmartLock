const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Configurações JWT
const jwtConfig = {
  secret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  refreshSecret: process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex'),
  
  // Tempos de expiração
  accessTokenExpiry: process.env.JWT_EXPIRES_IN || '1h',
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // Configurações do algoritmo
  algorithm: 'HS256',
  
  // Issuer e audience
  issuer: process.env.JWT_ISSUER || 'smart-lock-system',
  audience: process.env.JWT_AUDIENCE || 'smart-lock-users',
  
  // Configurações de clock tolerance
  clockTolerance: 60, // 60 segundos
  
  // Configurações para diferentes tipos de token
  tokenTypes: {
    ACCESS: 'access',
    REFRESH: 'refresh',
    EMAIL_VERIFICATION: 'email_verification',
    PASSWORD_RESET: 'password_reset',
    HARDWARE_AUTH: 'hardware_auth'
  }
};

// Verificar se o secret existe em produção
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  logger.error('JWT_SECRET não definido em produção!');
  process.exit(1);
}

// Função para gerar access token
const generateAccessToken = (payload) => {
  try {
    const tokenPayload = {
      ...payload,
      type: jwtConfig.tokenTypes.ACCESS,
      iat: Math.floor(Date.now() / 1000),
    };
    
    return jwt.sign(tokenPayload, jwtConfig.secret, {
      expiresIn: jwtConfig.accessTokenExpiry,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithm: jwtConfig.algorithm
    });
  } catch (error) {
    logger.error('Erro ao gerar access token:', error);
    throw new Error('Falha ao gerar token de acesso');
  }
};

// Função para gerar refresh token
const generateRefreshToken = (payload) => {
  try {
    const tokenPayload = {
      userId: payload.userId,
      email: payload.email,
      type: jwtConfig.tokenTypes.REFRESH,
      iat: Math.floor(Date.now() / 1000),
    };
    
    return jwt.sign(tokenPayload, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshTokenExpiry,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithm: jwtConfig.algorithm
    });
  } catch (error) {
    logger.error('Erro ao gerar refresh token:', error);
    throw new Error('Falha ao gerar token de renovação');
  }
};

// Função para gerar token de verificação de email
const generateEmailVerificationToken = (userId, email) => {
  try {
    const payload = {
      userId,
      email,
      type: jwtConfig.tokenTypes.EMAIL_VERIFICATION,
      iat: Math.floor(Date.now() / 1000),
    };
    
    return jwt.sign(payload, jwtConfig.secret, {
      expiresIn: '24h', // Token de verificação expira em 24h
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithm: jwtConfig.algorithm
    });
  } catch (error) {
    logger.error('Erro ao gerar token de verificação:', error);
    throw new Error('Falha ao gerar token de verificação');
  }
};

// Função para gerar token de reset de senha
const generatePasswordResetToken = (userId, email) => {
  try {
    const payload = {
      userId,
      email,
      type: jwtConfig.tokenTypes.PASSWORD_RESET,
      iat: Math.floor(Date.now() / 1000),
    };
    
    return jwt.sign(payload, jwtConfig.secret, {
      expiresIn: '1h', // Token de reset expira em 1h
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithm: jwtConfig.algorithm
    });
  } catch (error) {
    logger.error('Erro ao gerar token de reset:', error);
    throw new Error('Falha ao gerar token de reset');
  }
};

// Função para gerar token de autenticação de hardware
const generateHardwareToken = (cabinetId, hardwareId) => {
  try {
    const payload = {
      cabinetId,
      hardwareId,
      type: jwtConfig.tokenTypes.HARDWARE_AUTH,
      iat: Math.floor(Date.now() / 1000),
    };
    
    return jwt.sign(payload, jwtConfig.secret, {
      expiresIn: '30d', // Token de hardware tem vida longa
      issuer: jwtConfig.issuer,
      audience: 'smart-lock-hardware',
      algorithm: jwtConfig.algorithm
    });
  } catch (error) {
    logger.error('Erro ao gerar token de hardware:', error);
    throw new Error('Falha ao gerar token de hardware');
  }
};

// Função para verificar access token
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithms: [jwtConfig.algorithm],
      clockTolerance: jwtConfig.clockTolerance
    });
    
    if (decoded.type !== jwtConfig.tokenTypes.ACCESS) {
      throw new Error('Tipo de token inválido');
    }
    
    return decoded;
  } catch (error) {
    logger.debug('Token verification failed:', error.message);
    
    // Mapear erros específicos
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expirado');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Token inválido');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('Token não é válido ainda');
    }
    
    throw new Error('Token inválido');
  }
};

// Função para verificar refresh token
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, jwtConfig.refreshSecret, {
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithms: [jwtConfig.algorithm],
      clockTolerance: jwtConfig.clockTolerance
    });
    
    if (decoded.type !== jwtConfig.tokenTypes.REFRESH) {
      throw new Error('Tipo de token inválido');
    }
    
    return decoded;
  } catch (error) {
    logger.debug('Refresh token verification failed:', error.message);
    throw new Error('Token de renovação inválido');
  }
};

// Função para verificar token de email
const verifyEmailToken = (token) => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithms: [jwtConfig.algorithm]
    });
    
    if (decoded.type !== jwtConfig.tokenTypes.EMAIL_VERIFICATION) {
      throw new Error('Tipo de token inválido');
    }
    
    return decoded;
  } catch (error) {
    logger.debug('Email token verification failed:', error.message);
    throw new Error('Token de verificação inválido');
  }
};

// Função para verificar token de reset
const verifyPasswordResetToken = (token) => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithms: [jwtConfig.algorithm]
    });
    
    if (decoded.type !== jwtConfig.tokenTypes.PASSWORD_RESET) {
      throw new Error('Tipo de token inválido');
    }
    
    return decoded;
  } catch (error) {
    logger.debug('Password reset token verification failed:', error.message);
    throw new Error('Token de reset inválido');
  }
};

// Função para verificar token de hardware
const verifyHardwareToken = (token) => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
      audience: 'smart-lock-hardware',
      algorithms: [jwtConfig.algorithm]
    });
    
    if (decoded.type !== jwtConfig.tokenTypes.HARDWARE_AUTH) {
      throw new Error('Tipo de token inválido');
    }
    
    return decoded;
  } catch (error) {
    logger.debug('Hardware token verification failed:', error.message);
    throw new Error('Token de hardware inválido');
  }
};

// Função para decodificar token sem verificar (para debug)
const decodeToken = (token) => {
  try {
    return jwt.decode(token, { complete: true });
  } catch (error) {
    logger.error('Erro ao decodificar token:', error);
    return null;
  }
};

// Função para verificar se o token está próximo do vencimento
const isTokenExpiringSoon = (token, thresholdMinutes = 15) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return false;
    
    const now = Math.floor(Date.now() / 1000);
    const threshold = thresholdMinutes * 60;
    
    return (decoded.exp - now) < threshold;
  } catch (error) {
    return false;
  }
};

// Função para gerar par de tokens (access + refresh)
const generateTokenPair = (payload) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    expiresIn: jwtConfig.accessTokenExpiry
  };
};

module.exports = {
  // Configurações
  config: jwtConfig,
  
  // Geradores
  generateAccessToken,
  generateRefreshToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  generateHardwareToken,
  generateTokenPair,
  
  // Verificadores
  verifyAccessToken,
  verifyRefreshToken,
  verifyEmailToken,
  verifyPasswordResetToken,
  verifyHardwareToken,
  
  // Utilitários
  decodeToken,
  isTokenExpiringSoon
};