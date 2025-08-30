const logger = require('../utils/logger');
const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware para processar resultados de validação
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    logger.warn('Erro de validação', {
      endpoint: req.originalUrl,
      method: req.method,
      errors: errorMessages,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errorMessages
    });
  }

  next();
};

/**
 * Validações para autenticação
 */
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Email deve ter formato válido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email deve ter no máximo 255 caracteres'),
  
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Senha deve ter entre 6 e 128 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Senha deve conter ao menos uma letra minúscula, uma maiúscula e um número'),
  
  handleValidationErrors
];

const validateRegister = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Nome deve conter apenas letras e espaços'),
  
  body('email')
    .isEmail()
    .withMessage('Email deve ter formato válido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email deve ter no máximo 255 caracteres')
    .custom((value) => {
      // Validar domínios permitidos (opcional)
      const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS;
      if (allowedDomains) {
        const domains = allowedDomains.split(',');
        const emailDomain = value.split('@')[1];
        if (!domains.includes(emailDomain)) {
          throw new Error('Domínio de email não permitido');
        }
      }
      return true;
    }),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Senha deve ter entre 8 e 128 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Senha deve conter ao menos: uma letra minúscula, uma maiúscula, um número e um caractere especial'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Confirmação de senha não confere');
      }
      return true;
    }),
  
  body('userType')
    .isIn(['student', 'teacher', 'staff', 'admin'])
    .withMessage('Tipo de usuário inválido'),
  
  body('registration')
    .optional()
    .isLength({ min: 5, max: 20 })
    .withMessage('Matrícula deve ter entre 5 e 20 caracteres')
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage('Matrícula deve conter apenas letras e números'),
  
  handleValidationErrors
];

/**
 * Validações para QR Code
 */
const validateQRCode = [
  body('qrCode')
    .isLength({ min: 10, max: 500 })
    .withMessage('QR Code deve ter entre 10 e 500 caracteres')
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('QR Code contém caracteres inválidos'),
  
  handleValidationErrors
];

/**
 * Validações para empréstimo
 */
const validateBorrow = [
  body('cabinetId')
    .matches(/^[A-Z]{3}[0-9]{3}$/)
    .withMessage('ID do armário deve seguir o formato CAB001'),
  
  body('lockerNumber')
    .isLength({ min: 1, max: 3 })
    .withMessage('Número do locker deve ter entre 1 e 3 caracteres')
    .matches(/^[0-9]{1,3}$/)
    .withMessage('Número do locker deve ser numérico')
    .custom((value) => {
      const num = parseInt(value);
      if (num < 1 || num > 999) {
        throw new Error('Número do locker deve estar entre 1 e 999');
      }
      return true;
    }),
  
  body('duration')
    .optional()
    .isInt({ min: 1, max: 28800 }) // máximo 8 horas em segundos
    .withMessage('Duração deve ser um número entre 1 e 28800 segundos'),
  
  handleValidationErrors
];

/**
 * Validações para devolução
 */
const validateReturn = [
  param('transactionId')
    .isInt({ min: 1 })
    .withMessage('ID da transação deve ser um número válido'),
  
  body('condition')
    .optional()
    .isIn(['good', 'damaged', 'missing_parts'])
    .withMessage('Condição deve ser: good, damaged ou missing_parts'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Observações devem ter no máximo 500 caracteres')
    .trim()
    .escape(),
  
  handleValidationErrors
];

/**
 * Validações para gerenciamento de usuários
 */
const validateUser = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('Nome deve conter apenas letras e espaços'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email deve ter formato válido')
    .normalizeEmail(),
  
  body('userType')
    .optional()
    .isIn(['student', 'teacher', 'staff', 'admin'])
    .withMessage('Tipo de usuário inválido'),
  
  body('active')
    .optional()
    .isBoolean()
    .withMessage('Status ativo deve ser true ou false'),
  
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissões devem ser um array')
    .custom((permissions) => {
      const validPermissions = [
        'borrow_equipment',
        'manage_lockers',
        'view_reports',
        'manage_users',
        'system_admin'
      ];
      
      const invalidPerms = permissions.filter(p => !validPermissions.includes(p));
      if (invalidPerms.length > 0) {
        throw new Error(`Permissões inválidas: ${invalidPerms.join(', ')}`);
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Validações para armários
 */
const validateCabinet = [
  body('id')
    .matches(/^[A-Z]{3}[0-9]{3}$/)
    .withMessage('ID do armário deve seguir o formato CAB001'),
  
  body('location')
    .isLength({ min: 5, max: 200 })
    .withMessage('Localização deve ter entre 5 e 200 caracteres')
    .trim()
    .escape(),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Descrição deve ter no máximo 500 caracteres')
    .trim()
    .escape(),
  
  body('capacity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Capacidade deve ser um número entre 1 e 100'),
  
  body('hardwareIp')
    .optional()
    .isIP()
    .withMessage('IP do hardware deve ser um endereço IP válido'),
  
  body('active')
    .optional()
    .isBoolean()
    .withMessage('Status ativo deve ser true ou false'),
  
  handleValidationErrors
];

/**
 * Validações para histórico e relatórios
 */
const validateHistory = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número maior que 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve ser um número entre 1 e 100'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Data de início deve estar no formato ISO 8601')
    .toDate(),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Data de fim deve estar no formato ISO 8601')
    .toDate()
    .custom((endDate, { req }) => {
      if (req.query.startDate && new Date(req.query.startDate) > endDate) {
        throw new Error('Data de fim deve ser posterior à data de início');
      }
      return true;
    }),
  
  query('status')
    .optional()
    .isIn(['active', 'returned', 'overdue', 'damaged'])
    .withMessage('Status deve ser: active, returned, overdue ou damaged'),
  
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID do usuário deve ser um número válido'),
  
  handleValidationErrors
];

/**
 * Validação para parâmetros de ID
 */
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID deve ser um número válido maior que 0'),
  
  handleValidationErrors
];

/**
 * Validação para upload de arquivos
 */
const validateFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    const file = req.file || (req.files && req.files[0]);
    
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: `Tipo de arquivo não permitido. Permitidos: ${allowedTypes.join(', ')}`
      });
    }

    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        error: `Arquivo muito grande. Máximo permitido: ${Math.round(maxSize / (1024 * 1024))}MB`
      });
    }

    next();
  };
};

/**
 * Sanitização de entrada para prevenir XSS
 */
const sanitizeInput = (fields = []) => {
  return (req, res, next) => {
    fields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = req.body[field]
          .trim()
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    });
    next();
  };
};

/**
 * Validação customizada para verificar unicidade no banco
 */
const checkUnique = (model, field, message = 'Valor já existe') => {
  return async (value, { req }) => {
    const Model = require(`../models/${model}`);
    const existing = await Model.findBy(field, value);
    
    // Se está editando, permitir o mesmo valor para o mesmo registro
    if (existing && (!req.params.id || existing.id !== parseInt(req.params.id))) {
      throw new Error(message);
    }
    
    return true;
  };
};

module.exports = {
  handleValidationErrors,
  validateLogin,
  validateRegister,
  validateQRCode,
  validateBorrow,
  validateReturn,
  validateUser,
  validateCabinet,
  validateHistory,
  validateId,
  validateFileUpload,
  sanitizeInput,
  checkUnique
};