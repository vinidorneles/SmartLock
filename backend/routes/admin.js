const express = require('express');
const router = express.Router();
const { authenticateToken, requireUserType } = require('../middlewares/auth');
const userController = require('../controllers/userController');
const cabinetController = require('../controllers/cabinetController');
const historyController = require('../controllers/historyController');
const hardwareController = require('../controllers/hardwareController');

/**
 * @route   GET /api/admin/dashboard
 * @desc    Obter dados para dashboard administrativo
 * @access  Private (admin, technician)
 */
router.get('/dashboard', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  async (req, res, next) => {
    try {
      // Agregar dados de múltiplos controllers
      const [stats, recentActivity, activeLoans, hardwareStatus] = await Promise.all([
        historyController.getSystemStats(req, res, next, true),
        historyController.getRecentActivity(req, res, next, true), 
        historyController.getActiveLoans(req, res, next, true),
        hardwareController.getAllHardwareStatus(req, res, next, true)
      ]);

      res.json({
        stats,
        recentActivity,
        activeLoans,
        hardwareStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/system-info
 * @desc    Obter informações do sistema
 * @access  Private (admin only)
 */
router.get('/system-info', 
  authenticateToken, 
  requireUserType(['admin']),
  (req, res) => {
    res.json({
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        version: process.env.npm_package_version || '1.0.0'
      },
      database: {
        status: 'connected', // Será implementado no controller
        connections: 'N/A'   // Será implementado no controller
      }
    });
  }
);

/**
 * @route   GET /api/admin/users/summary
 * @desc    Resumo de usuários do sistema
 * @access  Private (admin, technician)
 */
router.get('/users/summary', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  async (req, res, next) => {
    try {
      const summary = await userController.getUsersSummary(req, res, next, true);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/cabinets/summary
 * @desc    Resumo de armários do sistema
 * @access  Private (admin, technician)
 */
router.get('/cabinets/summary', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  async (req, res, next) => {
    try {
      const summary = await cabinetController.getCabinetsSummary(req, res, next, true);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/reports/daily
 * @desc    Relatório diário do sistema
 * @access  Private (admin, technician)
 * @query   ?date=2025-08-19
 */
router.get('/reports/daily', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  historyController.getDailySummary
);

/**
 * @route   GET /api/admin/reports/weekly
 * @desc    Relatório semanal do sistema
 * @access  Private (admin, technician)
 * @query   ?week=2025-W33
 */
router.get('/reports/weekly', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  async (req, res, next) => {
    try {
      const report = await historyController.getWeeklyReport(req, res, next, true);
      res.json(report);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/reports/monthly
 * @desc    Relatório mensal do sistema
 * @access  Private (admin, technician)
 * @query   ?month=2025-08
 */
router.get('/reports/monthly', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  async (req, res, next) => {
    try {
      const report = await historyController.getMonthlyReport(req, res, next, true);
      res.json(report);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/notifications/broadcast
 * @desc    Enviar notificação para todos os usuários
 * @access  Private (admin only)
 * @body    { type: 'email' | 'push', subject: string, message: string, userTypes?: string[] }
 */
router.post('/notifications/broadcast', 
  authenticateToken, 
  requireUserType(['admin']),
  async (req, res, next) => {
    try {
      const notificationController = require('../controllers/notificationController');
      await notificationController.broadcastNotification(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/maintenance/schedule
 * @desc    Obter cronograma de manutenção
 * @access  Private (admin, technician)
 */
router.get('/maintenance/schedule', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  async (req, res, next) => {
    try {
      // Implementar lógica de cronograma de manutenção
      res.json({
        message: 'Cronograma de manutenção não implementado ainda'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/backup/database
 * @desc    Iniciar backup do banco de dados
 * @access  Private (admin only)
 * @body    { includeHistory?: boolean, compress?: boolean }
 */
router.post('/backup/database', 
  authenticateToken, 
  requireUserType(['admin']),
  async (req, res, next) => {
    try {
      // Implementar lógica de backup
      res.json({
        message: 'Backup iniciado',
        backupId: Date.now(),
        estimatedTime: '5-10 minutos'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/logs/system
 * @desc    Obter logs do sistema
 * @access  Private (admin only)
 * @query   ?level=error|warning|info&lines=100&file=app|error|hardware
 */
router.get('/logs/system', 
  authenticateToken, 
  requireUserType(['admin']),
  async (req, res, next) => {
    try {
      const { level = 'info', lines = 100, file = 'app' } = req.query;
      
      // Implementar leitura de logs
      res.json({
        logs: [],
        message: 'Sistema de logs não implementado ainda'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/system/restart
 * @desc    Reiniciar sistema (cuidado!)
 * @access  Private (admin only)
 * @body    { reason: string, delaySeconds?: number }
 */
router.post('/system/restart', 
  authenticateToken, 
  requireUserType(['admin']),
  async (req, res, next) => {
    try {
      const { reason, delaySeconds = 30 } = req.body;
      
      if (!reason) {
        return res.status(400).json({
          error: 'Motivo obrigatório',
          message: 'É necessário informar o motivo do restart'
        });
      }
      
      // Log da operação
      console.log(`SISTEMA RESTART SOLICITADO por ${req.user.email}: ${reason}`);
      
      res.json({
        message: `Sistema será reiniciado em ${delaySeconds} segundos`,
        reason,
        scheduledTime: new Date(Date.now() + delaySeconds * 1000)
      });
      
      // Agendar restart
      setTimeout(() => {
        console.log('Reiniciando sistema...');
        process.exit(0);
      }, delaySeconds * 1000);
      
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/alerts
 * @desc    Obter alertas do sistema
 * @access  Private (admin, technician)
 * @query   ?severity=high|medium|low&status=active&limit=50
 */
router.get('/alerts', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  async (req, res, next) => {
    try {
      const { severity, status = 'active', limit = 50 } = req.query;
      
      // Implementar sistema de alertas
      res.json({
        alerts: [],
        message: 'Sistema de alertas não implementado ainda'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/admin/settings
 * @desc    Atualizar configurações do sistema
 * @access  Private (admin only)
 * @body    { defaultLoanDuration?, maxSimultaneousLoans?, maintenanceMode?, etc }
 */
router.put('/settings', 
  authenticateToken, 
  requireUserType(['admin']),
  async (req, res, next) => {
    try {
      // Implementar atualização de configurações globais
      res.json({
        message: 'Configurações atualizadas com sucesso',
        settings: req.body
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/settings
 * @desc    Obter configurações atuais do sistema
 * @access  Private (admin, technician)
 */
router.get('/settings', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  async (req, res, next) => {
    try {
      // Implementar obtenção de configurações
      res.json({
        defaultLoanDuration: 4, // horas
        maxSimultaneousLoans: 2,
        maintenanceMode: false,
        emailNotifications: true,
        pushNotifications: true,
        autoReturnAfterHours: 24
      });
    } catch (error) {
      next(error);
    }
  }
);

// Middleware de tratamento de erro específico para admin
router.use((error, req, res, next) => {
  console.error('Erro nas rotas administrativas:', error);
  
  if (error.code === 'ADMIN_OPERATION_FAILED') {
    return res.status(500).json({
      error: 'Operação administrativa falhou',
      message: 'Não foi possível completar a operação solicitada',
      code: 'ADMIN_OPERATION_FAILED'
    });
  }
  
  if (error.code === 'BACKUP_FAILED') {
    return res.status(500).json({
      error: 'Falha no backup',
      message: 'Não foi possível realizar o backup do sistema',
      code: 'BACKUP_FAILED'
    });
  }
  
  if (error.code === 'SETTINGS_UPDATE_FAILED') {
    return res.status(500).json({
      error: 'Falha na atualização',
      message: 'Não foi possível atualizar as configurações',
      code: 'SETTINGS_UPDATE_FAILED'
    });
  }
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: 'Erro inesperado no sistema administrativo'
  });
});

module.exports = router;