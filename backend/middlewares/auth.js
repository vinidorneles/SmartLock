const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const logger = require('../utils/logger');

/**
 * Middleware de autenticação JWT
 * Verifica se o token JWT é válido e adiciona informações do usuário ao request
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token de acesso requerido'
      });
    }

    // Verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuário no banco de dados
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    if (!user.active) {
      return res.status(401).json({
        success: false,
        error: 'Conta desativada'
      });
    }

    // Adicionar informações do usuário ao request
    req.user = {
      userId: user.id,
      email: user.email,
      name: user.name,
      userType: user.user_type,
      permissions: user.permissions || []
    };

    // Log da operação
    logger.info('Token válido', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
    }

    logger.error('Erro na autenticação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

/**
 * Middleware para verificar permissões específicas
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    // Admin tem todas as permissões
    if (req.user.userType === 'admin') {
      return next();
    }

    // Verificar se o usuário tem a permissão específica
    if (!req.user.permissions.includes(permission)) {
      logger.warn('Acesso negado - permissão insuficiente', {
        userId: req.user.userId,
        requiredPermission: permission,
        userPermissions: req.user.permissions,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: 'Permissão insuficiente',
        code: 'INSUFFICIENT_PERMISSION'
      });
    }

    next();
  };
};

/**
 * Middleware para verificar tipo de usuário
 */
const requireUserType = (...allowedTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    if (!allowedTypes.includes(req.user.userType)) {
      logger.warn('Acesso negado - tipo de usuário inválido', {
        userId: req.user.userId,
        userType: req.user.userType,
        allowedTypes: allowedTypes,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: 'Tipo de usuário não autorizado',
        code: 'UNAUTHORIZED_USER_TYPE'
      });
    }

    next();
  };
};

/**
 * Middleware opcional de autenticação
 * Se token estiver presente, valida. Se não, continua sem autenticação
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(); // Continua sem autenticação
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (user && user.active) {
      req.user = {
        userId: user.id,
        email: user.email,
        name: user.name,
        userType: user.user_type,
        permissions: user.permissions || []
      };
    }
  } catch (error) {
    // Ignora erros de token em auth opcional
    logger.debug('Token inválido em auth opcional:', error.message);
  }

  next();
};

/**
 * Middleware para verificar se usuário pode acessar recurso próprio
 */
const requireOwnership = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
    
    // Admin pode acessar qualquer recurso
    if (req.user.userType === 'admin') {
      return next();
    }

    // Verificar se é dono do recurso
    if (req.user.userId.toString() !== resourceUserId.toString()) {
      logger.warn('Acesso negado - não é dono do recurso', {
        userId: req.user.userId,
        resourceUserId: resourceUserId,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: 'Acesso negado ao recurso',
        code: 'RESOURCE_ACCESS_DENIED'
      });
    }

    next();
  };
};

/**
 * Middleware para verificar se usuário está em período de empréstimo ativo
 */
const checkActiveLoan = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    // Verificar se usuário tem empréstimo ativo
    const { Transaction } = require('../models/Transaction');
    const activeLoan = await Transaction.findActiveByUserId(req.user.userId);

    if (activeLoan) {
      return res.status(409).json({
        success: false,
        error: 'Usuário já possui empréstimo ativo',
        code: 'ACTIVE_LOAN_EXISTS',
        data: {
          transactionId: activeLoan.id,
          equipment: activeLoan.equipment_name,
          borrowedAt: activeLoan.borrowed_at,
          returnDeadline: activeLoan.return_deadline
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Erro ao verificar empréstimo ativo:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

/**
 * Middleware para refresh de token automático
 */
const refreshTokenIfNeeded = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return next();
    }

    const decoded = jwt.decode(token);
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;

    // Se token expira em menos de 30 minutos, gerar novo
    if (timeUntilExpiry < 1800) { // 30 minutos em segundos
      const newToken = jwt.sign(
        { userId: req.user.userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
      );

      // Adicionar novo token no header da resposta
      res.set('X-New-Token', newToken);
      
      logger.info('Token renovado automaticamente', {
        userId: req.user.userId,
        timeUntilExpiry: timeUntilExpiry
      });
    }

    next();
  } catch (error) {
    logger.error('Erro no refresh automático do token:', error);
    next(); // Continua mesmo com erro no refresh
  }
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireUserType,
  optionalAuth,
  requireOwnership,
  checkActiveLoan,
  refreshTokenIfNeeded
};