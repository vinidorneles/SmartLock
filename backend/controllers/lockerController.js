const lockerService = require('../services/lockerService');
const hardwareService = require('../services/hardwareService');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class LockerController {
  // Listar armários disponíveis
  async getAvailableLockers(req, res) {
    try {
      const { 
        cabinetId, 
        location, 
        page = 1, 
        limit = 50,
        includeStatus = true 
      } = req.query;

      const filters = {
        cabinetId,
        location,
        isAvailable: true,
        isActive: true,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100) // Máximo 100 por página
      };

      const lockers = await lockerService.getLockers(filters);

      // Se solicitado, incluir status em tempo real
      if (includeStatus === 'true' && lockers.length > 0) {
        const lockerIds = lockers.map(l => l.id);
        const statusMap = await redis.lockStatus.getMultiple(lockerIds);
        
        lockers.forEach(locker => {
          const status = statusMap[locker.id];
          locker.realtimeStatus = status ? {
            status: status.status,
            lastUpdate: status.timestamp,
            isOnline: Date.now() - status.timestamp < 60000 // 1 minuto
          } : null;
        });
      }

      res.json({
        success: true,
        data: {
          lockers,
          pagination: {
            page: filters.page,
            limit: filters.limit,
            total: lockers.totalCount || lockers.length,
            pages: Math.ceil((lockers.totalCount || lockers.length) / filters.limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get available lockers error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter detalhes de um armário específico
  async getLockerById(req, res) {
    try {
      const { lockerId } = req.params;
      const userId = req.user.userId;

      if (!lockerId) {
        return res.status(400).json({
          success: false,
          message: 'ID do armário é obrigatório'
        });
      }

      const locker = await lockerService.getLockerById(lockerId);
      
      if (!locker) {
        return res.status(404).json({
          success: false,
          message: 'Armário não encontrado'
        });
      }

      // Verificar permissões do usuário para este armário
      const hasPermission = await lockerService.checkUserPermission(userId, lockerId);
      
      // Obter status em tempo real
      const realtimeStatus = await redis.lockStatus.get(lockerId);
      
      // Obter histórico recente se for admin ou tiver permissão
      let recentActivity = null;
      if (req.user.userType === 'admin' || hasPermission) {
        recentActivity = await lockerService.getRecentActivity(lockerId, 10);
      }

      res.json({
        success: true,
        data: {
          ...locker,
          hasPermission,
          realtimeStatus: realtimeStatus ? {
            status: realtimeStatus.status,
            lastUpdate: realtimeStatus.timestamp,
            isOnline: Date.now() - realtimeStatus.timestamp < 60000
          } : null,
          recentActivity
        }
      });

    } catch (error) {
      logger.error('Get locker by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Abrir armário (através de QR ou comando direto para admin)
  async unlockLocker(req, res) {
    try {
      const { lockerId, qrId, duration, force } = req.body;
      const userId = req.user.userId;
      const isAdmin = req.user.userType === 'admin';

      if (!lockerId) {
        return res.status(400).json({
          success: false,
          message: 'ID do armário é obrigatório'
        });
      }

      // Rate limiting
      const rateLimitKey = redis.generateKey(redis.config.keyPrefixes.rateLimiting, 'unlock', userId);
      const rateLimit = await redis.rateLimiting.check(rateLimitKey, 20, 3600); // 20 por hora

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Limite de comandos de abertura excedido',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
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

      // Verificar se o armário está disponível (exceto se for força admin)
      if (!locker.isAvailable && !force && !isAdmin) {
        return res.status(409).json({
          success: false,
          message: 'Armário não está disponível'
        });
      }

      let validationMethod = 'permission';
      let qrData = null;

      // Se um QR foi fornecido, validar
      if (qrId) {
        const qrResult = await redis.qrCode.consume(qrId);
        
        if (!qrResult.valid) {
          return res.status(400).json({
            success: false,
            message: 'QR code inválido, expirado ou já utilizado'
          });
        }

        qrData = qrResult.data;
        validationMethod = 'qr';

        // Verificar se o QR é para este armário
        if (qrData.lockerId !== lockerId) {
          return res.status(400).json({
            success: false,
            message: 'QR code não é válido para este armário'
          });
        }
      } else if (!isAdmin) {
        // Se não tem QR e não é admin, verificar permissões
        const hasPermission = await lockerService.checkUserPermission(userId, lockerId);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'Você não tem permissão para usar este armário'
          });
        }
      }

      // Determinar duração do destravamento
      const unlockDuration = duration || qrData?.duration || 30; // 30 segundos por padrão
      const maxDuration = isAdmin ? 600 : 300; // 10min admin, 5min usuário

      if (unlockDuration > maxDuration) {
        return res.status(400).json({
          success: false,
          message: `Duração máxima permitida: ${maxDuration} segundos`
        });
      }

      // Gerar ID da transação
      const transactionId = uuidv4();

      try {
        // Enviar comando para o hardware
        const hardwareResult = await hardwareService.sendUnlockCommand({
          lockerId,
          cabinetId: locker.cabinetId,
          duration: unlockDuration,
          transactionId,
          userId,
          method: validationMethod,
          metadata: {
            qrId: qrData?.qrId,
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip,
            timestamp: Date.now()
          }
        });

        if (!hardwareResult.success) {
          logger.error(`Hardware unlock failed for locker ${lockerId}:`, hardwareResult.error);
          
          return res.status(503).json({
            success: false,
            message: 'Falha na comunicação com o hardware',
            errorCode: 'HARDWARE_ERROR',
            details: hardwareResult.error
          });
        }

        // Atualizar status no Redis
        await redis.lockStatus.set(lockerId, {
          status: 'unlocked',
          unlockedBy: userId,
          unlockedAt: Date.now(),
          duration: unlockDuration,
          transactionId,
          method: validationMethod
        });

        // Registrar transação no banco
        const transaction = await lockerService.createTransaction({
          transactionId,
          lockerId,
          userId,
          action: 'unlock',
          method: validationMethod,
          duration: unlockDuration,
          qrId: qrData?.qrId,
          status: 'success',
          hardwareResponse: hardwareResult.response,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });

        // Publicar evento via WebSocket/Redis
        await redis.pubsub.publish(redis.config.pubsub.channels.LOCKER_STATUS, {
          action: 'unlock',
          lockerId,
          userId,
          transactionId,
          timestamp: Date.now(),
          duration: unlockDuration
        });

        // Agendar fechamento automático (backup caso o hardware falhe)
        setTimeout(async () => {
          try {
            await hardwareService.sendLockCommand({
              lockerId,
              cabinetId: locker.cabinetId,
              transactionId,
              autoClose: true
            });

            await redis.lockStatus.set(lockerId, {
              status: 'locked',
              autoLocked: true,
              timestamp: Date.now()
            });
          } catch (error) {
            logger.error(`Auto-lock failed for locker ${lockerId}:`, error);
          }
        }, unlockDuration * 1000 + 5000); // +5s de margem

        logger.info(`Locker unlocked successfully: ${lockerId} by user ${userId} (${validationMethod})`);

        res.json({
          success: true,
          message: 'Armário aberto com sucesso',
          data: {
            transactionId,
            lockerId,
            duration: unlockDuration,
            unlockedAt: new Date(),
            autoCloseAt: new Date(Date.now() + (unlockDuration * 1000)),
            method: validationMethod,
            locker: {
              id: locker.id,
              number: locker.number,
              cabinetName: locker.cabinetName,
              location: locker.location
            }
          }
        });

      } catch (hardwareError) {
        logger.error(`Hardware communication error for locker ${lockerId}:`, hardwareError);

        // Registrar transação falhada
        await lockerService.createTransaction({
          transactionId,
          lockerId,
          userId,
          action: 'unlock',
          method: validationMethod,
          duration: unlockDuration,
          qrId: qrData?.qrId,
          status: 'failed',
          errorMessage: hardwareError.message,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });

        return res.status(503).json({
          success: false,
          message: 'Falha na comunicação com o hardware',
          errorCode: 'HARDWARE_TIMEOUT',
          transactionId
        });
      }

    } catch (error) {
      logger.error('Unlock locker error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Fechar armário manualmente (admin)
  async lockLocker(req, res) {
    try {
      const { lockerId } = req.body;
      const userId = req.user.userId;

      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('lock_control')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      if (!lockerId) {
        return res.status(400).json({
          success: false,
          message: 'ID do armário é obrigatório'
        });
      }

      const locker = await lockerService.getLockerById(lockerId);
      if (!locker) {
        return res.status(404).json({
          success: false,
          message: 'Armário não encontrado'
        });
      }

      const transactionId = uuidv4();

      try {
        // Enviar comando para o hardware
        const hardwareResult = await hardwareService.sendLockCommand({
          lockerId,
          cabinetId: locker.cabinetId,
          transactionId,
          userId,
          forced: true
        });

        if (!hardwareResult.success) {
          return res.status(503).json({
            success: false,
            message: 'Falha na comunicação com o hardware'
          });
        }

        // Atualizar status
        await redis.lockStatus.set(lockerId, {
          status: 'locked',
          lockedBy: userId,
          lockedAt: Date.now(),
          transactionId,
          method: 'manual'
        });

        // Registrar transação
        await lockerService.createTransaction({
          transactionId,
          lockerId,
          userId,
          action: 'lock',
          method: 'manual',
          status: 'success',
          hardwareResponse: hardwareResult.response,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });

        // Publicar evento
        await redis.pubsub.publish(redis.config.pubsub.channels.LOCKER_STATUS, {
          action: 'lock',
          lockerId,
          userId,
          transactionId,
          timestamp: Date.now()
        });

        logger.info(`Locker locked manually: ${lockerId} by admin ${userId}`);

        res.json({
          success: true,
          message: 'Armário fechado com sucesso',
          data: {
            transactionId,
            lockerId,
            lockedAt: new Date()
          }
        });

      } catch (hardwareError) {
        logger.error(`Manual lock failed for locker ${lockerId}:`, hardwareError);

        await lockerService.createTransaction({
          transactionId,
          lockerId,
          userId,
          action: 'lock',
          method: 'manual',
          status: 'failed',
          errorMessage: hardwareError.message,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });

        return res.status(503).json({
          success: false,
          message: 'Falha na comunicação com o hardware'
        });
      }

    } catch (error) {
      logger.error('Lock locker error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter status em tempo real
  async getLockerStatus(req, res) {
    try {
      const { lockerId } = req.params;
      const userId = req.user.userId;

      if (!lockerId) {
        return res.status(400).json({
          success: false,
          message: 'ID do armário é obrigatório'
        });
      }

      const locker = await lockerService.getLockerById(lockerId);
      if (!locker) {
        return res.status(404).json({
          success: false,
          message: 'Armário não encontrado'
        });
      }

      // Verificar permissões
      const isAdmin = req.user.userType === 'admin';
      const hasPermission = await lockerService.checkUserPermission(userId, lockerId);

      if (!isAdmin && !hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para visualizar este armário'
        });
      }

      // Obter status do Redis
      const redisStatus = await redis.lockStatus.get(lockerId);

      // Tentar obter status direto do hardware
      let hardwareStatus = null;
      try {
        const statusResult = await hardwareService.getLockerStatus(lockerId, locker.cabinetId);
        if (statusResult.success) {
          hardwareStatus = statusResult.status;
        }
      } catch (error) {
        logger.warn(`Could not get hardware status for locker ${lockerId}:`, error.message);
      }

      res.json({
        success: true,
        data: {
          lockerId,
          databaseStatus: {
            isAvailable: locker.isAvailable,
            isActive: locker.isActive,
            currentUserId: locker.currentUserId,
            lastUpdated: locker.updatedAt
          },
          cacheStatus: redisStatus ? {
            status: redisStatus.status,
            lastUpdate: redisStatus.timestamp,
            unlockedBy: redisStatus.unlockedBy,
            transactionId: redisStatus.transactionId,
            isOnline: Date.now() - redisStatus.timestamp < 60000
          } : null,
          hardwareStatus,
          locker: {
            id: locker.id,
            number: locker.number,
            cabinetName: locker.cabinetName,
            location: locker.location
          }
        }
      });

    } catch (error) {
      logger.error('Get locker status error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Reservar armário (para uso futuro)
  async reserveLocker(req, res) {
    try {
      const { lockerId, duration = 60 } = req.body; // 60 minutos por padrão
      const userId = req.user.userId;

      if (!lockerId) {
        return res.status(400).json({
          success: false,
          message: 'ID do armário é obrigatório'
        });
      }

      // Verificar se o usuário já tem uma reserva ativa
      const existingReservation = await lockerService.getUserActiveReservation(userId);
      if (existingReservation) {
        return res.status(409).json({
          success: false,
          message: 'Você já possui uma reserva ativa',
          data: {
            lockerId: existingReservation.lockerId,
            expiresAt: existingReservation.expiresAt
          }
        });
      }

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

      // Verificar permissões
      const hasPermission = await lockerService.checkUserPermission(userId, lockerId);
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para reservar este armário'
        });
      }

      // Validar duração da reserva
      const maxReservationDuration = 240; // 4 horas máximo
      if (duration > maxReservationDuration) {
        return res.status(400).json({
          success: false,
          message: `Duração máxima da reserva: ${maxReservationDuration} minutos`
        });
      }

      // Criar reserva
      const reservation = await lockerService.createReservation({
        userId,
        lockerId,
        duration,
        expiresAt: new Date(Date.now() + (duration * 60 * 1000))
      });

      // Atualizar status no Redis
      await redis.lockStatus.set(lockerId, {
        status: 'reserved',
        reservedBy: userId,
        reservedAt: Date.now(),
        reservationId: reservation.id,
        expiresAt: reservation.expiresAt.getTime()
      });

      logger.info(`Locker reserved: ${lockerId} by user ${userId} for ${duration} minutes`);

      res.json({
        success: true,
        message: 'Armário reservado com sucesso',
        data: {
          reservationId: reservation.id,
          lockerId,
          duration,
          expiresAt: reservation.expiresAt,
          locker: {
            id: locker.id,
            number: locker.number,
            cabinetName: locker.cabinetName,
            location: locker.location
          }
        }
      });

    } catch (error) {
      logger.error('Reserve locker error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Cancelar reserva
  async cancelReservation(req, res) {
    try {
      const { reservationId } = req.params;
      const userId = req.user.userId;

      if (!reservationId) {
        return res.status(400).json({
          success: false,
          message: 'ID da reserva é obrigatório'
        });
      }

      const reservation = await lockerService.getReservationById(reservationId);
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Reserva não encontrada'
        });
      }

      // Verificar se o usuário pode cancelar esta reserva
      const isAdmin = req.user.userType === 'admin';
      if (reservation.userId !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Você não pode cancelar esta reserva'
        });
      }

      // Cancelar reserva
      await lockerService.cancelReservation(reservationId, userId);

      // Atualizar status no Redis
      await redis.lockStatus.set(reservation.lockerId, {
        status: 'available',
        availableAt: Date.now(),
        lastAction: 'reservation_cancelled'
      });

      logger.info(`Reservation cancelled: ${reservationId} by user ${userId}`);

      res.json({
        success: true,
        message: 'Reserva cancelada com sucesso'
      });

    } catch (error) {
      logger.error('Cancel reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter histórico de uso de um armário específico
  async getLockerHistory(req, res) {
    try {
      const { lockerId } = req.params;
      const { page = 1, limit = 20, startDate, endDate, action } = req.query;
      const userId = req.user.userId;

      if (!lockerId) {
        return res.status(400).json({
          success: false,
          message: 'ID do armário é obrigatório'
        });
      }

      // Verificar permissões
      const isAdmin = req.user.userType === 'admin';
      const hasPermission = await lockerService.checkUserPermission(userId, lockerId);

      if (!isAdmin && !hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para visualizar o histórico deste armário'
        });
      }

      const filters = {
        lockerId,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        action, // 'unlock', 'lock', 'reserve', etc.
        includeUserData: isAdmin // Incluir dados do usuário apenas para admin
      };

      const history = await lockerService.getLockerHistory(filters);

      res.json({
        success: true,
        data: {
          history: history.records,
          pagination: {
            page: history.page,
            limit: history.limit,
            total: history.total,
            pages: Math.ceil(history.total / history.limit)
          },
          lockerId
        }
      });

    } catch (error) {
      logger.error('Get locker history error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Forçar status do armário (admin/manutenção)
  async forceLockerStatus(req, res) {
    try {
      const { lockerId, status, reason } = req.body;
      const userId = req.user.userId;

      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('force_status')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      if (!lockerId || !status) {
        return res.status(400).json({
          success: false,
          message: 'ID do armário e status são obrigatórios'
        });
      }

      const allowedStatuses = ['available', 'occupied', 'maintenance', 'offline', 'error'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status inválido. Permitidos: ${allowedStatuses.join(', ')}`
        });
      }

      const locker = await lockerService.getLockerById(lockerId);
      if (!locker) {
        return res.status(404).json({
          success: false,
          message: 'Armário não encontrado'
        });
      }

      // Atualizar status no banco
      await lockerService.updateLockerStatus(lockerId, {
        status,
        isAvailable: status === 'available',
        isActive: status !== 'maintenance' && status !== 'offline',
        lastModifiedBy: userId,
        statusReason: reason
      });

      // Atualizar status no Redis
      await redis.lockStatus.set(lockerId, {
        status,
        forcedBy: userId,
        forcedAt: Date.now(),
        reason,
        method: 'forced'
      });

      // Log da ação administrativa
      await lockerService.logAdminAction({
        userId,
        action: 'force_status',
        targetType: 'locker',
        targetId: lockerId,
        details: { oldStatus: locker.status, newStatus: status, reason },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.warn(`Locker status forced: ${lockerId} to ${status} by admin ${userId} - ${reason}`);

      res.json({
        success: true,
        message: 'Status do armário alterado com sucesso',
        data: {
          lockerId,
          newStatus: status,
          reason,
          changedBy: userId,
          changedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Force locker status error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter estatísticas de uso dos armários
  async getLockerStats(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_stats')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { 
        cabinetId, 
        period = '7d', // 1d, 7d, 30d, 90d
        groupBy = 'day' // hour, day, week
      } = req.query;

      // Calcular período
      const periodMs = {
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      };

      const startDate = new Date(Date.now() - (periodMs[period] || periodMs['7d']));
      const endDate = new Date();

      const stats = await lockerService.getUsageStats({
        cabinetId,
        startDate,
        endDate,
        groupBy
      });

      res.json({
        success: true,
        data: {
          stats,
          period: {
            startDate,
            endDate,
            period,
            groupBy
          }
        }
      });

    } catch (error) {
      logger.error('Get locker stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Pesquisar armários
  async searchLockers(req, res) {
    try {
      const { 
        query, 
        cabinetId, 
        location, 
        status,
        page = 1, 
        limit = 20 
      } = req.query;

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Termo de busca deve ter pelo menos 2 caracteres'
        });
      }

      const searchFilters = {
        query: query.trim(),
        cabinetId,
        location,
        status,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50),
        userId: req.user.userId, // Para filtrar apenas armários que o usuário pode acessar
        includeRestricted: req.user.userType === 'admin'
      };

      const results = await lockerService.searchLockers(searchFilters);

      res.json({
        success: true,
        data: {
          results: results.lockers,
          pagination: {
            page: results.page,
            limit: results.limit,
            total: results.total,
            pages: Math.ceil(results.total / results.limit)
          },
          searchQuery: query
        }
      });

    } catch (error) {
      logger.error('Search lockers error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter armários próximos (baseado em localização)
  async getNearbyLockers(req, res) {
    try {
      const { latitude, longitude, radius = 1000 } = req.query; // radius em metros
      const userId = req.user.userId;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'Latitude e longitude são obrigatórias'
        });
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radiusMeters = Math.min(parseInt(radius), 5000); // Máximo 5km

      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Coordenadas inválidas'
        });
      }

      const nearbyLockers = await lockerService.getNearbyLockers({
        latitude: lat,
        longitude: lng,
        radius: radiusMeters,
        userId,
        onlyAvailable: true
      });

      res.json({
        success: true,
        data: {
          lockers: nearbyLockers,
          searchCenter: { latitude: lat, longitude: lng },
          radius: radiusMeters,
          count: nearbyLockers.length
        }
      });

    } catch (error) {
      logger.error('Get nearby lockers error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Relatar problema com armário
  async reportIssue(req, res) {
    try {
      const { lockerId, issueType, description, severity = 'medium' } = req.body;
      const userId = req.user.userId;

      if (!lockerId || !issueType || !description) {
        return res.status(400).json({
          success: false,
          message: 'ID do armário, tipo do problema e descrição são obrigatórios'
        });
      }

      const allowedIssueTypes = [
        'hardware_failure',
        'door_stuck',
        'sensor_error',
        'connectivity_issue',
        'physical_damage',
        'other'
      ];

      if (!allowedIssueTypes.includes(issueType)) {
        return res.status(400).json({
          success: false,
          message: `Tipo de problema inválido. Permitidos: ${allowedIssueTypes.join(', ')}`
        });
      }

      const allowedSeverities = ['low', 'medium', 'high', 'critical'];
      if (!allowedSeverities.includes(severity)) {
        return res.status(400).json({
          success: false,
          message: `Severidade inválida. Permitidas: ${allowedSeverities.join(', ')}`
        });
      }

      const locker = await lockerService.getLockerById(lockerId);
      if (!locker) {
        return res.status(404).json({
          success: false,
          message: 'Armário não encontrado'
        });
      }

      // Criar ticket de problema
      const issue = await lockerService.createIssue({
        lockerId,
        reportedBy: userId,
        issueType,
        description,
        severity,
        status: 'open',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Se for problema crítico, marcar armário como fora de serviço
      if (severity === 'critical') {
        await lockerService.updateLockerStatus(lockerId, {
          isAvailable: false,
          status: 'maintenance',
          statusReason: `Problema crítico reportado: ${issueType}`
        });

        await redis.lockStatus.set(lockerId, {
          status: 'maintenance',
          reason: 'critical_issue',
          issueId: issue.id,
          timestamp: Date.now()
        });
      }

      // Notificar administradores se severidade alta ou crítica
      if (['high', 'critical'].includes(severity)) {
        await redis.pubsub.publish(redis.config.pubsub.channels.MAINTENANCE_ALERTS, {
          type: 'locker_issue',
          lockerId,
          issueId: issue.id,
          severity,
          issueType,
          description,
          reportedBy: userId,
          timestamp: Date.now()
        });
      }

      logger.info(`Issue reported for locker ${lockerId}: ${issueType} (${severity}) by user ${userId}`);

      res.json({
        success: true,
        message: 'Problema reportado com sucesso',
        data: {
          issueId: issue.id,
          lockerId,
          issueType,
          severity,
          status: 'open',
          reportedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Report issue error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = new LockerController();