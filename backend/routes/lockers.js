const express = require('express');
const router = express.Router();
const lockerController = require('../controllers/lockerController');
const { authenticateToken, requireUserType } = require('../middlewares/auth');
const { validateBorrow, validateReturn, validateReservation } = require('../middlewares/validation');
const rateLimit = require('express-rate-limit');

// Rate limiting para operações de empréstimo
const borrowLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // máximo 10 tentativas de empréstimo por minuto
  message: {
    error: 'Muitas tentativas de empréstimo',
    message: 'Aguarde antes de tentar novamente'
  }
});

/**
 * @route   GET /api/lockers/cabinet/:cabinetId
 * @desc    Obter status de todos os lockers de um armário
 * @access  Private
 * @params  cabinetId - ID do armário
 */
router.get('/cabinet/:cabinetId', 
  authenticateToken, 
  lockerController.getLockersByCabinet
);

/**
 * @route   GET /api/lockers/available/:cabinetId
 * @desc    Obter apenas lockers disponíveis de um armário
 * @access  Private
 * @params  cabinetId - ID do armário
 */
router.get('/available/:cabinetId', 
  authenticateToken, 
  lockerController.getAvailableLockers
);

/**
 * @route   POST /api/lockers/borrow
 * @desc    Realizar empréstimo de equipamento
 * @access  Private
 * @body    { cabinetId: string, lockerNumber: string }
 */
router.post('/borrow', 
  authenticateToken, 
  borrowLimiter,
  validateBorrow,
  lockerController.borrowEquipment
);

/**
 * @route   POST /api/lockers/return
 * @desc    Devolver equipamento emprestado
 * @access  Private
 * @body    { transactionId: number, lockerNumber?: string }
 */
router.post('/return', 
  authenticateToken, 
  validateReturn,
  lockerController.returnEquipment
);

/**
 * @route   GET /api/lockers/my-loans
 * @desc    Obter empréstimos ativos do usuário atual
 * @access  Private
 */
router.get('/my-loans', 
  authenticateToken, 
  lockerController.getUserActiveLoans
);

/**
 * @route   POST /api/lockers/reserve
 * @desc    Reservar um locker específico
 * @access  Private
 * @body    { cabinetId: string, lockerNumber: string, duration?: number }
 */
router.post('/reserve', 
  authenticateToken,
  validateReservation,
  lockerController.reserveLocker
);

/**
 * @route   DELETE /api/lockers/reservation/:reservationId
 * @desc    Cancelar reserva de locker
 * @access  Private
 */
router.delete('/reservation/:reservationId', 
  authenticateToken, 
  lockerController.cancelReservation
);

/**
 * @route   GET /api/lockers/my-reservations
 * @desc    Obter reservas ativas do usuário
 * @access  Private
 */
router.get('/my-reservations', 
  authenticateToken, 
  lockerController.getUserReservations
);

/**
 * @route   GET /api/lockers/:lockerId/status
 * @desc    Obter status detalhado de um locker específico
 * @access  Private
 */
router.get('/:lockerId/status', 
  authenticateToken, 
  lockerController.getLockerStatus
);

/**
 * @route   POST /api/lockers/:lockerId/unlock
 * @desc    Destravar locker manualmente (admin/technician)
 * @access  Private (admin, technician)
 * @body    { duration?: number, reason: string }
 */
router.post('/:lockerId/unlock', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  lockerController.manualUnlock
);

/**
 * @route   POST /api/lockers/:lockerId/lock
 * @desc    Travar locker manualmente (admin/technician)
 * @access  Private (admin, technician)
 * @body    { reason: string }
 */
router.post('/:lockerId/lock', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  lockerController.manualLock
);

/**
 * @route   PUT /api/lockers/:lockerId/maintenance
 * @desc    Marcar/desmarcar locker para manutenção
 * @access  Private (admin, technician)
 * @body    { maintenance: boolean, reason?: string }
 */
router.put('/:lockerId/maintenance', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  lockerController.setMaintenanceMode
);

/**
 * @route   GET /api/lockers/search
 * @desc    Buscar lockers por critérios
 * @access  Private (admin, technician)
 * @query   ?status=available&cabinetId&location&equipment
 */
router.get('/search', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  lockerController.searchLockers
);

/**
 * @route   POST /api/lockers/bulk-operation
 * @desc    Operação em lote nos lockers
 * @access  Private (admin only)
 * @body    { operation: 'lock'|'unlock'|'maintenance', lockerIds: number[], reason: string }
 */
router.post('/bulk-operation', 
  authenticateToken, 
  requireUserType(['admin']),
  lockerController.bulkOperation
);

/**
 * @route   GET /api/lockers/overdue
 * @desc    Obter empréstimos em atraso
 * @access  Private (admin, technician)
 * @query   ?days=1&sendNotification=true
 */
router.get('/overdue', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  lockerController.getOverdueLoans
);

/**
 * @route   POST /api/lockers/extend/:transactionId
 * @desc    Prorrogar prazo de empréstimo
 * @access  Private
 * @body    { hours: number, reason?: string }
 */
router.post('/extend/:transactionId', 
  authenticateToken, 
  lockerController.extendLoan
);

/**
 * @route   GET /api/lockers/usage-stats
 * @desc    Obter estatísticas de uso dos lockers
 * @access  Private (admin, technician)
 * @query   ?period=day|week|month&cabinetId
 */
router.get('/usage-stats', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  lockerController.getUsageStats
);

/**
 * @route   POST /api/lockers/force-return/:transactionId
 * @desc    Forçar devolução de empréstimo (admin)
 * @access  Private (admin only)
 * @body    { reason: string, penalty?: boolean }
 */
router.post('/force-return/:transactionId', 
  authenticateToken, 
  requireUserType(['admin']),
  lockerController.forceReturn
);

// Middleware de tratamento de erro específico para lockers
router.use((error, req, res, next) => {
  console.error('Erro nas rotas de lockers:', error);
  
  if (error.code === 'LOCKER_NOT_AVAILABLE') {
    return res.status(409).json({
      error: 'Locker não disponível',
      message: 'O locker selecionado não está disponível para empréstimo',
      code: 'LOCKER_NOT_AVAILABLE'
    });
  }
  
  if (error.code === 'LOCKER_ALREADY_BORROWED') {
    return res.status(409).json({
      error: 'Equipamento já emprestado',
      message: 'Você já possui um empréstimo ativo deste tipo',
      code: 'LOCKER_ALREADY_BORROWED'
    });
  }
  
  if (error.code === 'HARDWARE_TIMEOUT') {
    return res.status(503).json({
      error: 'Falha na comunicação',
      message: 'Não foi possível comunicar com o hardware do armário',
      code: 'HARDWARE_TIMEOUT'
    });
  }
  
  if (error.code === 'USER_LOAN_LIMIT') {
    return res.status(429).json({
      error: 'Limite de empréstimos atingido',
      message: 'Você atingiu o limite máximo de empréstimos simultâneos',
      code: 'USER_LOAN_LIMIT'
    });
  }
  
  if (error.code === 'LOCKER_MAINTENANCE') {
    return res.status(503).json({
      error: 'Locker em manutenção',
      message: 'Este locker está temporariamente indisponível para manutenção',
      code: 'LOCKER_MAINTENANCE'
    });
  }
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: 'Erro inesperado no sistema de lockers'
  });
});

module.exports = router;