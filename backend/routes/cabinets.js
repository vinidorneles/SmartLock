const express = require('express');
const router = express.Router();
const cabinetController = require('../controllers/cabinetController');
const { authenticateToken, requireUserType } = require('../middlewares/auth');
const { validateCabinet, validateCabinetUpdate } = require('../middlewares/validation');

/**
 * @route   GET /api/cabinets
 * @desc    Listar todos os armários
 * @access  Private
 * @query   ?page=1&limit=20&location&status&equipmentType
 */
router.get('/', 
  authenticateToken, 
  cabinetController.getAllCabinets
);

/**
 * @route   GET /api/cabinets/:cabinetId
 * @desc    Obter detalhes de um armário específico
 * @access  Private
 * @params  cabinetId - ID do armário
 */
router.get('/:cabinetId', 
  authenticateToken, 
  cabinetController.getCabinetById
);

/**
 * @route   POST /api/cabinets
 * @desc    Criar novo armário
 * @access  Private (admin, technician)
 * @body    { id, location, description, equipmentType, numLockers, hardwareIp?, hardwareType? }
 */
router.post('/', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  validateCabinet,
  cabinetController.createCabinet
);

/**
 * @route   PUT /api/cabinets/:cabinetId
 * @desc    Atualizar informações do armário
 * @access  Private (admin, technician)
 * @body    { location?, description?, equipmentType?, hardwareIp?, hardwareType?, status? }
 */
router.put('/:cabinetId', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  validateCabinetUpdate,
  cabinetController.updateCabinet
);

/**
 * @route   DELETE /api/cabinets/:cabinetId
 * @desc    Deletar armário (apenas se sem empréstimos ativos)
 * @access  Private (admin only)
 */
router.delete('/:cabinetId', 
  authenticateToken, 
  requireUserType(['admin']),
  cabinetController.deleteCabinet
);

/**
 * @route   GET /api/cabinets/:cabinetId/lockers
 * @desc    Obter status detalhado de todos os lockers de um armário
 * @access  Private (admin, technician)
 */
router.get('/:cabinetId/lockers', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  cabinetController.getCabinetLockers
);

/**
 * @route   POST /api/cabinets/:cabinetId/test-hardware
 * @desc    Testar comunicação com hardware do armário
 * @access  Private (admin, technician)
 */
router.post('/:cabinetId/test-hardware', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  cabinetController.testHardware
);

/**
 * @route   PUT /api/cabinets/:cabinetId/status
 * @desc    Atualizar status do armário (ativo/inativo/manutenção)
 * @access  Private (admin, technician)
 * @body    { status: 'active' | 'inactive' | 'maintenance', reason?: string }
 */
router.put('/:cabinetId/status', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  cabinetController.updateCabinetStatus
);

/**
 * @route   GET /api/cabinets/:cabinetId/history
 * @desc    Obter histórico de uso do armário
 * @access  Private (admin, technician)
 * @query   ?page=1&limit=20&startDate&endDate&userId
 */
router.get('/:cabinetId/history', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  cabinetController.getCabinetHistory
);

/**
 * @route   GET /api/cabinets/:cabinetId/stats
 * @desc    Obter estatísticas de uso do armário
 * @access  Private (admin, technician)
 * @query   ?period=day|week|month|year
 */
router.get('/:cabinetId/stats', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  cabinetController.getCabinetStats
);

/**
 * @route   POST /api/cabinets/:cabinetId/equipment
 * @desc    Adicionar equipamento a um locker específico
 * @access  Private (admin, technician)
 * @body    { lockerNumber: string, equipmentId: string, equipmentName: string, serialNumber?: string }
 */
router.post('/:cabinetId/equipment', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  cabinetController.addEquipmentToLocker
);

/**
 * @route   PUT /api/cabinets/:cabinetId/equipment/:equipmentId
 * @desc    Atualizar informações do equipamento
 * @access  Private (admin, technician)
 * @body    { equipmentName?: string, serialNumber?: string, status?: string }
 */
router.put('/:cabinetId/equipment/:equipmentId', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  cabinetController.updateEquipment
);

/**
 * @route   DELETE /api/cabinets/:cabinetId/equipment/:equipmentId
 * @desc    Remover equipamento do locker
 * @access  Private (admin, technician)
 */
router.delete('/:cabinetId/equipment/:equipmentId', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  cabinetController.removeEquipment
);

/**
 * @route   GET /api/cabinets/by-location/:location
 * @desc    Obter armários por localização
 * @access  Private
 * @params  location - Localização (URL encoded)
 */
router.get('/by-location/:location', 
  authenticateToken, 
  cabinetController.getCabinetsByLocation
);

/**
 * @route   GET /api/cabinets/nearby
 * @desc    Obter armários próximos (baseado em localização)
 * @access  Private
 * @query   ?lat&lng&radius=100
 */
router.get('/nearby', 
  authenticateToken, 
  cabinetController.getNearbyCabinets
);

/**
 * @route   POST /api/cabinets/:cabinetId/calibrate
 * @desc    Calibrar hardware do armário
 * @access  Private (admin, technician)
 * @body    { testAllLockers?: boolean }
 */
router.post('/:cabinetId/calibrate', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  cabinetController.calibrateHardware
);

/**
 * @route   GET /api/cabinets/:cabinetId/maintenance-log
 * @desc    Obter log de manutenção do armário
 * @access  Private (admin, technician)
 */
router.get('/:cabinetId/maintenance-log', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  cabinetController.getMaintenanceLog
);

/**
 * @route   POST /api/cabinets/:cabinetId/maintenance-log
 * @desc    Adicionar entrada no log de manutenção
 * @access  Private (admin, technician)
 * @body    { action: string, description: string, technicianId?: number }
 */
router.post('/:cabinetId/maintenance-log', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  cabinetController.addMaintenanceLog
);

// Middleware de tratamento de erro específico para armários
router.use((error, req, res, next) => {
  console.error('Erro nas rotas de armários:', error);
  
  if (error.code === 'CABINET_NOT_FOUND') {
    return res.status(404).json({
      error: 'Armário não encontrado',
      message: 'O armário solicitado não existe no sistema',
      code: 'CABINET_NOT_FOUND'
    });
  }
  
  if (error.code === 'CABINET_ID_EXISTS') {
    return res.status(409).json({
      error: 'ID do armário já existe',
      message: 'Já existe um armário com este identificador',
      code: 'CABINET_ID_EXISTS'
    });
  }
  
  if (error.code === 'CABINET_HAS_ACTIVE_LOANS') {
    return res.status(409).json({
      error: 'Armário possui empréstimos ativos',
      message: 'Não é possível deletar armário com empréstimos em andamento',
      code: 'CABINET_HAS_ACTIVE_LOANS'
    });
  }
  
  if (error.code === 'HARDWARE_NOT_CONFIGURED') {
    return res.status(400).json({
      error: 'Hardware não configurado',
      message: 'Este armário não possui hardware configurado',
      code: 'HARDWARE_NOT_CONFIGURED'
    });
  }
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: 'Erro inesperado no sistema de armários'
  });
});

module.exports = router;