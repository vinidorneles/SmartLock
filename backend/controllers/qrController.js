const qrService = require('../services/qrService');
const lockerService = require('../services/lockerService');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class QRController {
  // Gerar QR Code para abertura de armário
  async generateQRCode(req, res) {
    try {
      const { lockerId, duration } = req.body;
      const userId = req.user.userId;

      // Validações
      if (!lockerId) {
        return res.status(400).json({
          success: false,
          message: 'ID do armário é obrigatório'
        });
      }

      // Rate limiting para geração de QR
      const rateLimitKey = redis.generateKey(redis.config.keyPrefixes.rateLimiting, 'qr_generation', userId);
      const rateLimit = await redis.rateLimiting.check(rateLimitKey, 10, 3600); // 10 por hora

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Limite de geração de QR codes excedido. Tente novamente mais tarde.',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        });
      }

      // Verificar se o armário existe e está disponível
      const locker = await lockerService.getLockerById(lockerId);
      if (!locker) {
        return res.status(404).json({
          success: false,
          message: 'Armário não encontrado'
        });
      }

      if (!locker.isAvailable) {
        return res.status(409).json({
          success: false,
          message: 'Armário não está disponível'
        });
      }

      // Verificar permissões do usuário
      const hasPermission = await lockerService.checkUserPermission(userId, lockerId);
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para usar este armário'
        });
      }

      // Verificar se o usuário já tem um QR ativo para este armário
      const existingQR = await qrService.getActiveQRForUser(userId, lockerId);
      if (existingQR) {
        return res.status(409).json({
          success: false,
          message: 'Você já possui um QR code ativo para este armário',
          data: {
            qrId: existingQR.qrId,
            expiresAt: existingQR.expiresAt
          }
        });
      }

      // Validar duração
      const unlockDuration = duration || 30; // 30 segundos por padrão
      const maxDuration = 300; // 5 minutos máximo
      const minDuration = 5; // 5 segundos mínimo

      if (unlockDuration < minDuration || unlockDuration > maxDuration) {
        return res.status(400).json({
          success: false,
          message: `Duração deve estar entre ${minDuration} e ${maxDuration} segundos`
        });
      }

      // Gerar ID único para o QR
      const qrId = uuidv4();
      const expirationTime = 300; // QR expira em 5 minutos

      // Dados para o QR code
      const qrData = {
        qrId,
        userId,
        lockerId,
        cabinetId: locker.cabinetId,
        action: 'unlock',
        duration: unlockDuration,
        createdBy: userId,
        validUntil: Date.now() + (expirationTime * 1000),
        permissions: req.user.permissions || [],
        metadata: {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          timestamp: Date.now()
        }
      };

      // Salvar no Redis com TTL
      await redis.qrCode.create(qrId, qrData, expirationTime);

      // Gerar imagem QR
      const qrCodeImage = await qrService.generateQRImage(qrId, qrData);

      // Registrar tentativa no banco
      await qrService.logQRGeneration({
        qrId,
        userId,
        lockerId,
        expiresAt: new Date(qrData.validUntil),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`QR code generated for user ${userId} and locker ${lockerId}`);

      res.json({
        success: true,
        message: 'QR code gerado com sucesso',
        data: {
          qrId,
          qrCode: qrCodeImage,
          expiresAt: qrData.validUntil,
          expiresIn: expirationTime,
          locker: {
            id: locker.id,
            number: locker.number,
            cabinetName: locker.cabinetName,
            location: locker.location
          },
          duration: unlockDuration
        }
      });

    } catch (error) {
      logger.error('Generate QR code error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Escanear e validar QR Code
  async scanQRCode(req, res) {
    try {
      const { qrId } = req.body;
      const scannedBy = req.user.userId;

      if (!qrId) {
        return res.status(400).json({
          success: false,
          message: 'ID do QR code é obrigatório'
        });
      }

      // Rate limiting para escaneamento
      const rateLimitKey = redis.generateKey(redis.config.keyPrefixes.rateLimiting, 'qr_scan', req.ip);
      const rateLimit = await redis.rateLimiting.check(rateLimitKey, 20, 300); // 20 por 5min

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Muitas tentativas de escaneamento. Aguarde um momento.',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        });
      }

      // Consumir QR code (validar e remover do Redis)
      const qrResult = await redis.qrCode.consume(qrId);

      if (!qrResult.valid) {
        logger.warn(`Invalid QR scan attempt: ${qrId} - ${qrResult.reason}`);
        
        // Log da tentativa inválida
        await qrService.logQRScan({
          qrId,
          scannedBy,
          success: false,
          reason: qrResult.reason,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });

        return res.status(400).json({
          success: false,
          message: 'QR code inválido, expirado ou já utilizado'
        });
      }

      const qrData = qrResult.data;

      // Verificar se o armário ainda está disponível
      const locker = await lockerService.getLockerById(qrData.lockerId);
      if (!locker) {
        return res.status(404).json({
          success: false,
          message: 'Armário não encontrado'
        });
      }

      if (!locker.isAvailable) {
        return res.status(409).json({
          success: false,
          message: 'Armário não está mais disponível'
        });
      }

      // Log do escaneamento bem-sucedido
      await qrService.logQRScan({
        qrId,
        scannedBy,
        success: true,
        lockerId: qrData.lockerId,
        userId: qrData.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`Valid QR scan: ${qrId} by user ${scannedBy} for locker ${qrData.lockerId}`);

      res.json({
        success: true,
        message: 'QR code válido',
        data: {
          qrId,
          action: qrData.action,
          lockerId: qrData.lockerId,
          cabinetId: qrData.cabinetId,
          duration: qrData.duration,
          locker: {
            id: locker.id,
            number: locker.number,
            cabinetName: locker.cabinetName,
            location: locker.location,
            description: locker.description
          },
          user: {
            id: qrData.userId,
            name: qrData.userName || 'Usuário'
          },
          scannedAt: new Date(),
          validForUnlock: true
        }
      });

    } catch (error) {
      logger.error('Scan QR code error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter QR codes ativos do usuário
  async getActiveQRCodes(req, res) {
    try {
      const userId = req.user.userId;

      // Buscar QR codes ativos no Redis
      const activeQRs = await qrService.getUserActiveQRs(userId);

      // Enriquecer com dados dos armários
      const enrichedQRs = await Promise.all(
        activeQRs.map(async (qr) => {
          const locker = await lockerService.getLockerById(qr.lockerId);
          return {
            qrId: qr.qrId,
            lockerId: qr.lockerId,
            expiresAt: qr.validUntil,
            duration: qr.duration,
            action: qr.action,
            createdAt: qr.createdAt,
            locker: locker ? {
              id: locker.id,
              number: locker.number,
              cabinetName: locker.cabinetName,
              location: locker.location
            } : null
          };
        })
      );

      res.json({
        success: true,
        data: {
          activeQRs: enrichedQRs,
          count: enrichedQRs.length
        }
      });

    } catch (error) {
      logger.error('Get active QR codes error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Cancelar QR code ativo
  async cancelQRCode(req, res) {
    try {
      const { qrId } = req.params;
      const userId = req.user.userId;

      if (!qrId) {
        return res.status(400).json({
          success: false,
          message: 'ID do QR code é obrigatório'
        });
      }

      // Buscar QR no Redis
      const qrKey = redis.generateKey(redis.config.keyPrefixes.qrCode, qrId);
      const qrData = await redis.cache.get(qrKey);

      if (!qrData) {
        return res.status(404).json({
          success: false,
          message: 'QR code não encontrado ou já expirado'
        });
      }

      // Verificar se o usuário pode cancelar este QR
      if (qrData.userId !== userId && req.user.userType !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para cancelar este QR code'
        });
      }

      // Remover QR do Redis
      await redis.cache.del(qrKey);

      // Log do cancelamento
      await qrService.logQRCancellation({
        qrId,
        userId,
        cancelledBy: userId,
        reason: 'user_cancelled',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`QR code cancelled: ${qrId} by user ${userId}`);

      res.json({
        success: true,
        message: 'QR code cancelado com sucesso'
      });

    } catch (error) {
      logger.error('Cancel QR code error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter histórico de QR codes do usuário
  async getQRHistory(req, res) {
    try {
      const userId = req.user.userId;
      const { page = 1, limit = 20, startDate, endDate, status } = req.query;

      const filters = {
        userId,
        page: parseInt(page),
        limit: parseInt(limit),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status // 'success', 'failed', 'cancelled', 'expired'
      };

      const history = await qrService.getQRHistory(filters);

      res.json({
        success: true,
        data: {
          history: history.records,
          pagination: {
            page: history.page,
            limit: history.limit,
            total: history.total,
            pages: Math.ceil(history.total / history.limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get QR history error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Validar QR code sem consumir (para preview)
  async validateQRCode(req, res) {
    try {
      const { qrId } = req.params;

      if (!qrId) {
        return res.status(400).json({
          success: false,
          message: 'ID do QR code é obrigatório'
        });
      }

      // Buscar QR no Redis sem consumir
      const qrKey = redis.generateKey(redis.config.keyPrefixes.qrCode, qrId);
      const qrData = await redis.cache.get(qrKey);

      if (!qrData) {
        return res.status(404).json({
          success: false,
          message: 'QR code não encontrado ou expirado',
          valid: false
        });
      }

      // Verificar se ainda é válido
      if (Date.now() > qrData.validUntil) {
        // Remover QR expirado
        await redis.cache.del(qrKey);
        
        return res.status(400).json({
          success: false,
          message: 'QR code expirado',
          valid: false
        });
      }

      // Buscar dados do armário
      const locker = await lockerService.getLockerById(qrData.lockerId);
      
      res.json({
        success: true,
        message: 'QR code válido',
        valid: true,
        data: {
          qrId,
          action: qrData.action,
          lockerId: qrData.lockerId,
          duration: qrData.duration,
          expiresAt: qrData.validUntil,
          timeRemaining: Math.max(0, qrData.validUntil - Date.now()),
          locker: locker ? {
            id: locker.id,
            number: locker.number,
            cabinetName: locker.cabinetName,
            location: locker.location,
            isAvailable: locker.isAvailable
          } : null
        }
      });

    } catch (error) {
      logger.error('Validate QR code error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Gerar QR code para administradores (com mais opções)
  async generateAdminQRCode(req, res) {
    try {
      const { lockerId, action, duration, expirationTime, metadata } = req.body;
      const userId = req.user.userId;

      // Verificar se é administrador
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_qr')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      // Validações
      if (!lockerId || !action) {
        return res.status(400).json({
          success: false,
          message: 'ID do armário e ação são obrigatórios'
        });
      }

      const allowedActions = ['unlock', 'lock', 'status', 'maintenance', 'reset'];
      if (!allowedActions.includes(action)) {
        return res.status(400).json({
          success: false,
          message: `Ação inválida. Permitidas: ${allowedActions.join(', ')}`
        });
      }

      // Verificar se o armário existe
      const locker = await lockerService.getLockerById(lockerId);
      if (!locker) {
        return res.status(404).json({
          success: false,
          message: 'Armário não encontrado'
        });
      }

      // Gerar ID único para o QR
      const qrId = uuidv4();
      const qrExpiration = expirationTime || 3600; // 1 hora por padrão para admin
      const unlockDuration = duration || 60; // 60 segundos por padrão para admin

      // Dados para o QR code administrativo
      const qrData = {
        qrId,
        userId,
        lockerId,
        cabinetId: locker.cabinetId,
        action,
        duration: unlockDuration,
        createdBy: userId,
        isAdminQR: true,
        validUntil: Date.now() + (qrExpiration * 1000),
        permissions: ['admin_access', ...req.user.permissions],
        metadata: {
          ...metadata,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          timestamp: Date.now(),
          adminUser: req.user.name
        }
      };

      // Salvar no Redis
      await redis.qrCode.create(qrId, qrData, qrExpiration);

      // Gerar imagem QR
      const qrCodeImage = await qrService.generateQRImage(qrId, qrData);

      // Log da geração administrativa
      await qrService.logQRGeneration({
        qrId,
        userId,
        lockerId,
        action,
        isAdmin: true,
        expiresAt: new Date(qrData.validUntil),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`Admin QR code generated: ${qrId} by ${userId} for ${action} on locker ${lockerId}`);

      res.json({
        success: true,
        message: 'QR code administrativo gerado com sucesso',
        data: {
          qrId,
          qrCode: qrCodeImage,
          action,
          expiresAt: qrData.validUntil,
          expiresIn: qrExpiration,
          locker: {
            id: locker.id,
            number: locker.number,
            cabinetName: locker.cabinetName,
            location: locker.location
          },
          duration: unlockDuration,
          isAdminQR: true
        }
      });

    } catch (error) {
      logger.error('Generate admin QR code error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter estatísticas de uso de QR codes (admin)
  async getQRStats(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_stats')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { startDate, endDate, groupBy = 'day' } = req.query;

      const filters = {
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
        endDate: endDate ? new Date(endDate) : new Date(),
        groupBy // 'hour', 'day', 'week', 'month'
      };

      const stats = await qrService.getQRStats(filters);

      res.json({
        success: true,
        data: {
          stats,
          period: {
            startDate: filters.startDate,
            endDate: filters.endDate,
            groupBy: filters.groupBy
          }
        }
      });

    } catch (error) {
      logger.error('Get QR stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Limpar QR codes expirados (cleanup job)
  async cleanupExpiredQRs(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('system_maintenance')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const cleanupResult = await qrService.cleanupExpiredQRs();

      logger.info(`QR cleanup completed: ${cleanupResult.cleaned} expired QRs removed`);

      res.json({
        success: true,
        message: 'Limpeza de QR codes expirados concluída',
        data: {
          cleanedCount: cleanupResult.cleaned,
          totalScanned: cleanupResult.totalScanned,
          executionTime: cleanupResult.executionTime
        }
      });

    } catch (error) {
      logger.error('QR cleanup error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = new QRController();