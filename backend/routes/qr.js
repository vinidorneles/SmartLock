const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');
const { authenticateToken, requireUserType } = require('../middlewares/auth');
const { validateQRCode, validateQRGeneration } = require('../middlewares/validation');
const rateLimit = require('express-rate-limit');

// Rate limiting para validação de QR codes
const qrValidationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // máximo 30 validações por minuto
  message: {
    error: 'Muitas tentativas de validação',
    message: 'Aguarde um momento antes de escanear novamente'
  }
});

// Rate limiting para geração de QR codes
const qrGenerationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máximo 10 gerações por 5 minutos
  message: {
    error: 'Muitas tentativas de geração',
    message: 'Limite de geração de QR codes atingido'
  }
});

/**
 * @route   POST /api/qr/validate
 * @desc    Validar QR code escaneado
 * @access  Private (usuários autenticados)
 * @body    { qrCode: string }
 */
router.post('/validate', 
  authenticateToken, 
  qrValidationLimiter, 
  validateQRCode, 
  qrController.validateQRCode
);

/**
 * @route   POST /api/qr/generate
 * @desc    Gerar novo QR code para armário
 * @access  Private (admin, technician)
 * @body    { cabinetId: string, action: string, expiresIn?: number }
 */
router.post('/generate', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  qrGenerationLimiter,
  validateQRGeneration,
  qrController.generateQRCode
);

/**
 * @route   GET /api/qr/cabinet/:cabinetId
 * @desc    Obter QR code atual de um armário
 * @access  Private (admin, technician)
 */
router.get('/cabinet/:cabinetId', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  qrController.getCabinetQRCode
);

/**
 * @route   GET /api/qr/list
 * @desc    Listar todos os QR codes ativos
 * @access  Private (admin, technician)
 * @query   ?page=1&limit=20&status=active
 */
router.get('/list', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  qrController.listQRCodes
);

/**
 * @route   PUT /api/qr/:qrId/status
 * @desc    Atualizar status de um QR code (ativo/inativo)
 * @access  Private (admin, technician)
 * @body    { status: 'active' | 'inactive' }
 */
router.put('/:qrId/status', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  qrController.updateQRCodeStatus
);

/**
 * @route   DELETE /api/qr/:qrId
 * @desc    Deletar/invalidar QR code
 * @access  Private (admin only)
 */
router.delete('/:qrId', 
  authenticateToken, 
  requireUserType(['admin']),
  qrController.deleteQRCode
);

/**
 * @route   GET /api/qr/:qrId/history
 * @desc    Obter histórico de uso de um QR code
 * @access  Private (admin, technician)
 * @query   ?page=1&limit=20&startDate&endDate
 */
router.get('/:qrId/history', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  qrController.getQRCodeHistory
);

/**
 * @route   POST /api/qr/batch-generate
 * @desc    Gerar múltiplos QR codes em lote
 * @access  Private (admin only)
 * @body    { cabinetIds: string[], action: string, expiresIn?: number }
 */
router.post('/batch-generate', 
  authenticateToken, 
  requireUserType(['admin']),
  qrGenerationLimiter,
  qrController.batchGenerateQRCodes
);

/**
 * @route   GET /api/qr/stats
 * @desc    Obter estatísticas de uso dos QR codes
 * @access  Private (admin, technician)
 * @query   ?period=week|month|year&cabinetId
 */
router.get('/stats', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  qrController.getQRCodeStats
);

/**
 * @route   POST /api/qr/refresh/:cabinetId
 * @desc    Renovar QR code de um armário (invalidar atual e gerar novo)
 * @access  Private (admin, technician)
 */
router.post('/refresh/:cabinetId', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  qrController.refreshCabinetQRCode
);

/**
 * @route   GET /api/qr/download/:qrId
 * @desc    Download do QR code como imagem PNG
 * @access  Private (admin, technician)
 * @query   ?size=small|medium|large
 */
router.get('/download/:qrId', 
  authenticateToken, 
  requireUserType(['admin', 'technician']),
  qrController.downloadQRCode
);

// Middleware de tratamento de erro específico para QR codes
router.use((error, req, res, next) => {
  console.error('Erro nas rotas de QR code:', error);
  
  if (error.code === 'QR_EXPIRED') {
    return res.status(410).json({
      error: 'QR code expirado',
      message: 'Este QR code não é mais válido. Solicite um novo.',
      code: 'QR_EXPIRED'
    });
  }
  
  if (error.code === 'QR_INVALID_FORMAT') {
    return res.status(400).json({
      error: 'Formato de QR code inválido',
      message: 'O QR code escaneado não possui formato válido',
      code: 'QR_INVALID_FORMAT'
    });
  }
  
  if (error.code === 'QR_CABINET_NOT_FOUND') {
    return res.status(404).json({
      error: 'Armário não encontrado',
      message: 'O armário referenciado no QR code não existe',
      code: 'QR_CABINET_NOT_FOUND'
    });
  }
  
  if (error.code === 'QR_GENERATION_FAILED') {
    return res.status(500).json({
      error: 'Falha na geração',
      message: 'Não foi possível gerar o QR code. Tente novamente.',
      code: 'QR_GENERATION_FAILED'
    });
  }
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: 'Erro inesperado no sistema de QR codes'
  });
});

module.exports = router;