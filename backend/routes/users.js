const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireUserType } = require('../middlewares/auth');
const { validateUserUpdate, validateUserCreate } = require('../middlewares/validation');

/**
 * @route   GET /api/users
 * @desc    Listar todos os usuários (admin/technician)
 * @access  Private (admin, technician)
 * @query   ?page=1&limit=20&userType&status&search
 */
router.get('/', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  userController.getAllUsers
);

/**
 * @route   GET /api/users/:userId
 * @desc    Obter detalhes de um usuário específico
 * @access  Private (admin, technician ou próprio usuário)
 */
router.get('/:userId', 
  authenticateToken, 
  userController.getUserById
);

/**
 * @route   POST /api/users
 * @desc    Criar novo usuário (admin only)
 * @access  Private (admin only)
 * @body    { name, email, userType, studentId?, department?, phone? }
 */
router.post('/', 
  authenticateToken, 
  requireUserType(['admin']),
  validateUserCreate,
  userController.createUser
);

/**
 * @route   PUT /api/users/:userId
 * @desc    Atualizar informações do usuário
 * @access  Private (admin ou próprio usuário)
 * @body    { name?, email?, phone?, department?, notifications? }
 */
router.put('/:userId', 
  authenticateToken, 
  validateUserUpdate,
  userController.updateUser
);

/**
 * @route   DELETE /api/users/:userId
 * @desc    Deletar usuário (admin only)
 * @access  Private (admin only)
 */
router.delete('/:userId', 
  authenticateToken, 
  requireUserType(['admin']),
  userController.deleteUser
);

/**
 * @route   PUT /api/users/:userId/status
 * @desc    Atualizar status do usuário (ativo/inativo/suspenso)
 * @access  Private (admin only)
 * @body    { status: 'active' | 'inactive' | 'suspended', reason?: string }
 */
router.put('/:userId/status', 
  authenticateToken, 
  requireUserType(['admin']),
  userController.updateUserStatus
);

/**
 * @route   GET /api/users/:userId/loans
 * @desc    Obter empréstimos de um usuário
 * @access  Private (admin, technician ou próprio usuário)
 * @query   ?status=active&page=1&limit=20
 */
router.get('/:userId/loans', 
  authenticateToken, 
  userController.getUserLoans
);

/**
 * @route   GET /api/users/:userId/history
 * @desc    Obter histórico completo de um usuário
 * @access  Private (admin, technician ou próprio usuário)
 * @query   ?page=1&limit=20&startDate&endDate
 */
router.get('/:userId/history', 
  authenticateToken, 
  userController.getUserHistory
);

/**
 * @route   GET /api/users/:userId/stats
 * @desc    Obter estatísticas de uso de um usuário
 * @access  Private (admin, technician ou próprio usuário)
 * @query   ?period=month|year
 */
router.get('/:userId/stats', 
  authenticateToken, 
  userController.getUserStats
);

/**
 * @route   POST /api/users/:userId/send-notification
 * @desc    Enviar notificação para usuário
 * @access  Private (admin, technician)
 * @body    { type: 'email' | 'push', subject: string, message: string }
 */
router.post('/:userId/send-notification', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  userController.sendNotificationToUser
);

/**
 * @route   PUT /api/users/:userId/permissions
 * @desc    Atualizar permissões do usuário
 * @access  Private (admin only)
 * @body    { userType: string, maxLoanDuration?: number, maxSimultaneousLoans?: number }
 */
router.put('/:userId/permissions', 
  authenticateToken, 
  requireUserType(['admin']),
  userController.updateUserPermissions
);

/**
 * @route   GET /api/users/search
 * @desc    Buscar usuários por critérios
 * @access  Private (admin, technician)
 * @query   ?q=termo&userType&department&status
 */
router.get('/search', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  userController.searchUsers
);

/**
 * @route   POST /api/users/bulk-import
 * @desc    Importar usuários em lote (CSV/Excel)
 * @access  Private (admin only)
 * @body    FormData com arquivo
 */
router.post('/bulk-import', 
  authenticateToken, 
  requireUserType(['admin']),
  userController.bulkImportUsers
);

/**
 * @route   GET /api/users/export
 * @desc    Exportar lista de usuários
 * @access  Private (admin only)
 * @query   ?format=csv|excel&filters
 */
router.get('/export', 
  authenticateToken, 
  requireUserType(['admin']),
  userController.exportUsers
);

/**
 * @route   POST /api/users/:userId/reset-password
 * @desc    Resetar senha do usuário (admin)
 * @access  Private (admin only)
 * @body    { sendEmail?: boolean }
 */
router.post('/:userId/reset-password', 
  authenticateToken, 
  requireUserType(['admin']),
  userController.adminResetPassword
);

/**
 * @route   GET /api/users/:userId/devices
 * @desc    Obter dispositivos registrados do usuário
 * @access  Private (admin ou próprio usuário)
 */
router.get('/:userId/devices', 
  authenticateToken, 
  userController.getUserDevices
);

/**
 * @route   DELETE /api/users/:userId/devices/:deviceId
 * @desc    Remover dispositivo registrado
 * @access  Private (admin ou próprio usuário)
 */
router.delete('/:userId/devices/:deviceId', 
  authenticateToken, 
  userController.removeUserDevice
);

// Middleware de tratamento de erro específico para usuários
router.use((error, req, res, next) => {
  console.error('Erro nas rotas de usuários:', error);
  
  if (error.code === 'USER_NOT_FOUND') {
    return res.status(404).json({
      error: 'Usuário não encontrado',
      message: 'O usuário solicitado não existe no sistema',
      code: 'USER_NOT_FOUND'
    });
  }
  
  if (error.code === 'EMAIL_ALREADY_EXISTS') {
    return res.status(409).json({
      error: 'Email já cadastrado',
      message: 'Já existe um usuário com este endereço de email',
      code: 'EMAIL_ALREADY_EXISTS'
    });
  }
  
  if (error.code === 'STUDENT_ID_EXISTS') {
    return res.status(409).json({
      error: 'Matrícula já cadastrada',
      message: 'Já existe um usuário com esta matrícula',
      code: 'STUDENT_ID_EXISTS'
    });
  }
  
  if (error.code === 'USER_HAS_ACTIVE_LOANS') {
    return res.status(409).json({
      error: 'Usuário possui empréstimos ativos',
      message: 'Não é possível deletar usuário com empréstimos em andamento',
      code: 'USER_HAS_ACTIVE_LOANS'
    });
  }
  
  if (error.code === 'INSUFFICIENT_PERMISSIONS') {
    return res.status(403).json({
      error: 'Permissões insuficientes',
      message: 'Você não tem permissão para acessar este recurso',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: 'Erro inesperado no sistema de usuários'
  });
});

module.exports = router;