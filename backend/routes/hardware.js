const express = require('express');
const router = express.Router();
const hardwareController = require('../controllers/hardwareController');
const { authenticateToken, requireUserType, validateHardwareToken } = require('../middlewares/auth');

/**
 * @route   GET /api/hardware/status
 * @desc    Obter status de todos os hardwares conectados
 * @access  Private (admin, technician)
 */
router.get('/status', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  hardwareController.getAllHardwareStatus
);

/**
 * @route   GET /api/hardware/:cabinetId/status
 * @desc    Obter status do hardware de um armário específico
 * @access  Private (admin, technician)
 */
router.get('/:cabinetId/status', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  hardwareController.getHardwareStatus
);

/**
 * @route   POST /api/hardware/:cabinetId/test
 * @desc    Testar conectividade com hardware
 * @access  Private (admin, technician)
 * @body    { testType?: 'connectivity' | 'locks' | 'sensors' }
 */
router.post('/:cabinetId/test', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  hardwareController.testHardware
);

/**
 * @route   POST /api/hardware/:cabinetId/unlock/:lockerNumber
 * @desc    Comando direto para destravar locker
 * @access  Private (admin, technician)
 * @body    { duration?: number, reason: string }
 */
router.post('/:cabinetId/unlock/:lockerNumber', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  hardwareController.unlockLocker
);

/**
 * @route   POST /api/hardware/:cabinetId/lock/:lockerNumber
 * @desc    Comando direto para travar locker
 * @access  Private (admin, technician)
 * @body    { reason: string }
 */
router.post('/:cabinetId/lock/:lockerNumber', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  hardwareController.lockLocker
);

/**
 * @route   GET /api/hardware/:cabinetId/diagnostics
 * @desc    Executar diagnóstico completo do hardware
 * @access  Private (admin, technician)
 */
router.get('/:cabinetId/diagnostics', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  hardwareController.runDiagnostics
);

/**
 * @route   POST /api/hardware/:cabinetId/calibrate
 * @desc    Calibrar sensores e atuadores do hardware
 * @access  Private (admin, technician)
 * @body    { testAllLockers?: boolean, resetToDefaults?: boolean }
 */
router.post('/:cabinetId/calibrate', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  hardwareController.calibrateHardware
);

/**
 * @route   PUT /api/hardware/:cabinetId/config
 * @desc    Atualizar configuração do hardware
 * @access  Private (admin only)
 * @body    { unlockDuration?, sensorTimeout?, networkConfig?, etc }
 */
router.put('/:cabinetId/config', 
  authenticateToken, 
  requireUserType(['admin']),
  hardwareController.updateHardwareConfig
);

/**
 * @route   GET /api/hardware/:cabinetId/logs
 * @desc    Obter logs do hardware
 * @access  Private (admin, technician)
 * @query   ?page=1&limit=50&level=error|warning|info&startDate&endDate
 */
router.get('/:cabinetId/logs', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  hardwareController.getHardwareLogs
);

/**
 * @route   POST /api/hardware/:cabinetId/firmware-update
 * @desc    Iniciar atualização de firmware
 * @access  Private (admin only)
 * @body    { firmwareVersion: string, forceUpdate?: boolean }
 */
router.post('/:cabinetId/firmware-update', 
  authenticateToken, 
  requireUserType(['admin']),
  hardwareController.updateFirmware
);

/**
 * @route   GET /api/hardware/:cabinetId/firmware-status
 * @desc    Verificar status da atualização de firmware
 * @access  Private (admin, technician)
 */
router.get('/:cabinetId/firmware-status', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  hardwareController.getFirmwareStatus
);

/**
 * @route   POST /api/hardware/:cabinetId/reboot
 * @desc    Reiniciar hardware do armário
 * @access  Private (admin only)
 * @body    { reason: string }
 */
router.post('/:cabinetId/reboot', 
  authenticateToken, 
  requireUserType(['admin']),
  hardwareController.rebootHardware
);

// Rotas para comunicação direta do hardware (webhook endpoints)

/**
 * @route   POST /api/hardware/webhook/status-update
 * @desc    Receber atualizações de status do hardware
 * @access  Hardware Token Required
 * @body    { cabinetId, status, lockerStates, timestamp, sensorData? }
 */
router.post('/webhook/status-update', 
  validateHardwareToken,
  hardwareController.receiveStatusUpdate
);

/**
 * @route   POST /api/hardware/webhook/sensor-alert
 * @desc    Receber alertas dos sensores
 * @access  Hardware Token Required
 * @body    { cabinetId, lockerNumber, alertType, message, timestamp }
 */
router.post('/webhook/sensor-alert', 
  validateHardwareToken,
  hardwareController.receiveSensorAlert
);

/**
 * @route   POST /api/hardware/webhook/heartbeat
 * @desc    Receber heartbeat do hardware
 * @access  Hardware Token Required
 * @body    { cabinetId, timestamp, uptime, memoryUsage? }
 */
router.post('/webhook/heartbeat', 
  validateHardwareToken,
  hardwareController.receiveHeartbeat
);

/**
 * @route   GET /api/hardware/discovery
 * @desc    Descobrir novos hardwares na rede
 * @access  Private (admin only)
 * @query   ?network=192.168.1.0/24&timeout=5000
 */
router.get('/discovery', 
  authenticateToken, 
  requireUserType(['admin']),
  hardwareController.discoverHardware
);

/**
 * @route   POST /api/hardware/register
 * @desc    Registrar novo hardware no sistema
 * @access  Private (admin only)
 * @body    { cabinetId, ipAddress, hardwareType, model?, firmware? }
 */
router.post('/register', 
  authenticateToken, 
  requireUserType(['admin']),
  hardwareController.registerHardware
);

/**
 * @route   DELETE /api/hardware/:cabinetId/unregister
 * @desc    Remover hardware do sistema
 * @access  Private (admin only)
 */
router.delete('/:cabinetId/unregister', 
  authenticateToken, 
  requireUserType(['admin']),
  hardwareController.unregisterHardware
);

/**
 * @route   GET /api/hardware/health-check
 * @desc    Verificar saúde de todos os hardwares
 * @access  Private (admin, technician)
 */
router.get('/health-check', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  hardwareController.performHealthCheck
);

/**
 * @route   POST /api/hardware/emergency-unlock-all
 * @desc    Destravar todos os lockers em emergência
 * @access  Private (admin only)
 * @body    { reason: string, duration?: number }
 */
router.post('/emergency-unlock-all', 
  authenticateToken, 
  requireUserType(['admin']),
  hardwareController.emergencyUnlockAll
);

// Middleware de tratamento de erro específico para hardware
router.use((error, req, res, next) => {
  console.error('Erro nas rotas de hardware:', error);
  
  if (error.code === 'HARDWARE_OFFLINE') {
    return res.status(503).json({
      error: 'Hardware offline',
      message: 'O hardware do armário não está respondendo',
      code: 'HARDWARE_OFFLINE'
    });
  }
  
  if (error.code === 'HARDWARE_TIMEOUT') {
    return res.status(504).json({
      error: 'Timeout na comunicação',
      message: 'Timeout ao comunicar com o hardware',
      code: 'HARDWARE_TIMEOUT'
    });
  }
  
  if (error.code === 'INVALID_HARDWARE_TOKEN') {
    return res.status(401).json({
      error: 'Token de hardware inválido',
      message: 'Token de autenticação do hardware é inválido',
      code: 'INVALID_HARDWARE_TOKEN'
    });
  }
  
  if (error.code === 'HARDWARE_NOT_REGISTERED') {
    return res.status(404).json({
      error: 'Hardware não registrado',
      message: 'Este hardware não está registrado no sistema',
      code: 'HARDWARE_NOT_REGISTERED'
    });
  }
  
  if (error.code === 'FIRMWARE_UPDATE_FAILED') {
    return res.status(500).json({
      error: 'Falha na atualização',
      message: 'Não foi possível atualizar o firmware',
      code: 'FIRMWARE_UPDATE_FAILED'
    });
  }
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: 'Erro inesperado no sistema de hardware'
  });
});

module.exports = router;