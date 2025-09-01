const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { validateLogin, validateRegister, validateResetPassword } = require('../middlewares/validation');
const { authenticateToken } = require('../middlewares/auth');

// Rate limiting específico para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    error: 'Muitas tentativas de login',
    message: 'Tente novamente em 15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 registros por IP por hora
  message: {
    error: 'Muitas tentativas de registro',
    message: 'Tente novamente em 1 hora'
  }
});

// Rotas públicas (sem autenticação)

/**
 * @route   POST /api/auth/login
 * @desc    Autenticar usuário
 * @access  Public
 */
router.post('/login', authLimiter, validateLogin, authController.login);

/**
 * @route   POST /api/auth/register
 * @desc    Registrar novo usuário (apenas para tipos permitidos)
 * @access  Public
 */
router.post('/register', registerLimiter, validateRegister, authController.register);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Solicitar reset de senha por email
 * @access  Public
 */
router.post('/forgot-password', authLimiter, authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Resetar senha com token
 * @access  Public
 */
router.post('/reset-password', validateResetPassword, authController.resetPassword);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verificar email do usuário
 * @access  Public
 */
router.post('/verify-email', authController.verifyEmail);

// Rotas protegidas (requerem autenticação)

/**
 * @route   GET /api/auth/profile
 * @desc    Obter perfil do usuário atual
 * @access  Private
 */
router.get('/profile', authenticateToken, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Atualizar perfil do usuário
 * @access  Private
 */
router.put('/profile', authenticateToken, authController.updateProfile);

/**
 * @route   POST /api/auth/change-password
 * @desc    Alterar senha do usuário
 * @access  Private
 */
router.post('/change-password', authenticateToken, authController.changePassword);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Renovar token de acesso
 * @access  Private
 */
router.post('/refresh-token', authenticateToken, authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout do usuário (invalidar token)
 * @access  Private
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * @route   GET /api/auth/validate-token
 * @desc    Validar se token ainda é válido
 * @access  Private
 */
router.get('/validate-token', authenticateToken, authController.validateToken);

/**
 * @route   GET /api/auth/user-permissions
 * @desc    Obter permissões do usuário atual
 * @access  Private
 */
router.get('/user-permissions', authenticateToken, authController.getUserPermissions);

/**
 * @route   POST /api/auth/request-account-deletion
 * @desc    Solicitar exclusão da conta
 * @access  Private
 */
router.post('/request-account-deletion', authenticateToken, authController.requestAccountDeletion);

// Middleware de tratamento de erro para rotas de autenticação
router.use((error, req, res, next) => {
  console.error('Erro nas rotas de autenticação:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Dados inválidos',
      message: error.message,
      details: error.details
    });
  }
  
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido',
      message: 'Token de autenticação inválido ou expirado'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expirado',
      message: 'Token de autenticação expirado. Faça login novamente.'
    });
  }
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: 'Erro inesperado no sistema de autenticação'
  });
});

module.exports = router;