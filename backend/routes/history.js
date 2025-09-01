const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');
const { authenticateToken, requireUserType } = require('../middlewares/auth');

/**
 * @route   GET /api/history/user
 * @desc    Obter histórico do usuário atual
 * @access  Private
 * @query   ?page=1&limit=20&status&startDate&endDate
 */
router.get('/user', 
  authenticateToken, 
  historyController.getUserHistory
);

/**
 * @route   GET /api/history/user/:userId
 * @desc    Obter histórico de um usuário específico (admin/technician)
 * @access  Private (admin, technician)
 * @query   ?page=1&limit=20&status&startDate&endDate
 */
router.get('/user/:userId', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.getUserHistoryById
);

/**
 * @route   GET /api/history/cabinet/:cabinetId
 * @desc    Obter histórico de um armário específico
 * @access  Private (admin, technician)
 * @query   ?page=1&limit=20&startDate&endDate&userId
 */
router.get('/cabinet/:cabinetId', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.getCabinetHistory
);

/**
 * @route   GET /api/history/transaction/:transactionId
 * @desc    Obter detalhes de uma transação específica
 * @access  Private (admin, technician ou dono da transação)
 */
router.get('/transaction/:transactionId', 
  authenticateToken, 
  historyController.getTransactionDetails
);

/**
 * @route   GET /api/history/recent
 * @desc    Obter atividades recentes do sistema
 * @access  Private (admin, technician)
 * @query   ?limit=50&hours=24
 */
router.get('/recent', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.getRecentActivity
);

/**
 * @route   GET /api/history/active-loans
 * @desc    Obter todos os empréstimos ativos
 * @access  Private (admin, technician)
 * @query   ?page=1&limit=20&cabinetId&userId&overdue
 */
router.get('/active-loans', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.getActiveLoans
);

/**
 * @route   GET /api/history/overdue
 * @desc    Obter empréstimos em atraso
 * @access  Private (admin, technician)
 * @query   ?days=1&sendNotification=false
 */
router.get('/overdue', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.getOverdueLoans
);

/**
 * @route   GET /api/history/statistics
 * @desc    Obter estatísticas gerais do sistema
 * @access  Private (admin, technician)
 * @query   ?period=week|month|quarter|year&groupBy=day|week|month
 */
router.get('/statistics', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.getUsageStatistics
);

/**
 * @route   GET /api/history/export
 * @desc    Exportar histórico de transações
 * @access  Private (admin, technician)
 * @query   ?format=csv|excel&startDate&endDate&cabinetId&userId
 */
router.get('/export', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.exportHistory
);

/**
 * @route   GET /api/history/audit-log
 * @desc    Obter log de auditoria do sistema
 * @access  Private (admin only)
 * @query   ?page=1&limit=50&action&userId&startDate&endDate
 */
router.get('/audit-log', 
  authenticateToken, 
  requireUserType(['admin']),
  historyController.getAuditLog
);

/**
 * @route   POST /api/history/mark-returned/:transactionId
 * @desc    Marcar transação como devolvida manualmente
 * @access  Private (admin, technician)
 * @body    { reason: string, condition?: string }
 */
router.post('/mark-returned/:transactionId', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.markAsReturned
);

/**
 * @route   GET /api/history/popular-equipment
 * @desc    Obter equipamentos mais populares
 * @access  Private (admin, technician)
 * @query   ?period=month&limit=10
 */
router.get('/popular-equipment', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.getPopularEquipment
);

/**
 * @route   GET /api/history/peak-hours
 * @desc    Obter horários de pico de uso
 * @access  Private (admin, technician)
 * @query   ?period=week|month
 */
router.get('/peak-hours', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.getPeakUsageHours
);

/**
 * @route   GET /api/history/location-usage
 * @desc    Obter estatísticas de uso por localização
 * @access  Private (admin, technician)
 * @query   ?period=month
 */
router.get('/location-usage', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.getLocationUsageStats
);

/**
 * @route   POST /api/history/generate-report
 * @desc    Gerar relatório personalizado
 * @access  Private (admin, technician)
 * @body    { reportType: string, filters: object, format: 'pdf' | 'excel' }
 */
router.post('/generate-report', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.generateCustomReport
);

/**
 * @route   GET /api/history/daily-summary
 * @desc    Obter resumo diário de atividades
 * @access  Private (admin, technician)
 * @query   ?date=2025-08-19
 */
router.get('/daily-summary', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.getDailySummary
);

// Middleware de tratamento de erro específico para histórico
router.use((error, req, res, next) => {
  console.error('Erro nas rotas de histórico:', error);
  
  if (error.code === 'TRANSACTION_NOT_FOUND') {
    return res.status(404).json({
      error: 'Transação não encontrada',
      message: 'A transação solicitada não existe no sistema',
      code: 'TRANSACTION_NOT_FOUND'
    });
  }
  
  if (error.code === 'INVALID_DATE_RANGE') {
    return res.status(400).json({
      error: 'Período inválido',
      message: 'O período especificado é inválido ou muito extenso',
      code: 'INVALID_DATE_RANGE'
    });
  }
  
  if (error.code === 'EXPORT_LIMIT_EXCEEDED') {
    return res.status(429).json({
      error: 'Limite de exportação excedido',
      message: 'Muitos registros para exportar. Refine os filtros.',
      code: 'EXPORT_LIMIT_EXCEEDED'
    });
  }
  
  if (error.code === 'REPORT_GENERATION_FAILED') {
    return res.status(500).json({
      error: 'Falha na geração do relatório',
      message: 'Não foi possível gerar o relatório solicitado',
      code: 'REPORT_GENERATION_FAILED'
    });
  }
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: 'Erro inesperado no sistema de histórico'
  });
});

module.exports = router;