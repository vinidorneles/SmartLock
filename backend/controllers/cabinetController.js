const cabinetService = require('../services/cabinetService');
const lockerService = require('../services/lockerService');
const hardwareService = require('../services/hardwareService');
const redis = require('../config/redis');
const logger = require('../utils/logger');

class CabinetController {
  // Listar todos os gabinetes
  async getCabinets(req, res) {
    try {
      const { 
        location, 
        status, 
        page = 1, 
        limit = 20,
        includeLockers = false,
        includeStats = false 
      } = req.query;

      const filters = {
        location,
        status,
        isActive: true,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        includeLockers: includeLockers === 'true',
        includeStats: includeStats === 'true' && req.user.userType === 'admin'
      };

      const cabinets = await cabinetService.getCabinets(filters);

      // Se incluir lockers, obter status em tempo real
      if (filters.includeLockers) {
        for (const cabinet of cabinets) {
          if (cabinet.lockers && cabinet.lockers.length > 0) {
            const lockerIds = cabinet.lockers.map(l => l.id);
            const statusMap = await redis.lockStatus.getMultiple(lockerIds);
            
            cabinet.lockers.forEach(locker => {
              const status = statusMap[locker.id];
              locker.realtimeStatus = status ? {
                status: status.status,
                lastUpdate: status.timestamp,
                isOnline: Date.now() - status.timestamp < 60000
              } : null;
            });
          }
        }
      }

      res.json({
        success: true,
        data: {
          cabinets,
          pagination: {
            page: filters.page,
            limit: filters.limit,
            total: cabinets.totalCount || cabinets.length,
            pages: Math.ceil((cabinets.totalCount || cabinets.length) / filters.limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get cabinets error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter detalhes de um gabinete específico
  async getCabinetById(req, res) {
    try {
      const { cabinetId } = req.params;
      const { includeHistory = false } = req.query;

      if (!cabinetId) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete é obrigatório'
        });
      }

      const cabinet = await cabinetService.getCabinetById(cabinetId, {
        includeLockers: true,
        includeHardware: true
      });

      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      // Obter status em tempo real dos armários
      if (cabinet.lockers && cabinet.lockers.length > 0) {
        const lockerIds = cabinet.lockers.map(l => l.id);
        const statusMap = await redis.lockStatus.getMultiple(lockerIds);
        
        cabinet.lockers.forEach(locker => {
          const status = statusMap[locker.id];
          locker.realtimeStatus = status ? {
            status: status.status,
            lastUpdate: status.timestamp,
            isOnline: Date.now() - status.timestamp < 60000,
            currentUser: status.unlockedBy || status.reservedBy
          } : null;
        });

        // Calcular estatísticas do gabinete
        cabinet.stats = {
          totalLockers: cabinet.lockers.length,
          availableLockers: cabinet.lockers.filter(l => l.isAvailable).length,
          occupiedLockers: cabinet.lockers.filter(l => !l.isAvailable).length,
          onlineLockers: cabinet.lockers.filter(l => 
            l.realtimeStatus && l.realtimeStatus.isOnline
          ).length,
          offlineLockers: cabinet.lockers.filter(l => 
            !l.realtimeStatus || !l.realtimeStatus.isOnline
          ).length
        };
      }

      // Obter status do hardware do gabinete
      let hardwareStatus = null;
      try {
        const hwStatus = await hardwareService.getCabinetStatus(cabinetId);
        hardwareStatus = hwStatus.success ? hwStatus.status : null;
      } catch (error) {
        logger.warn(`Could not get hardware status for cabinet ${cabinetId}:`, error.message);
      }

      // Incluir histórico se solicitado e for admin
      let recentHistory = null;
      if (includeHistory === 'true' && req.user.userType === 'admin') {
        recentHistory = await cabinetService.getRecentActivity(cabinetId, 20);
      }

      res.json({
        success: true,
        data: {
          ...cabinet,
          hardwareStatus,
          recentHistory
        }
      });

    } catch (error) {
      logger.error('Get cabinet by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Criar novo gabinete (admin)
  async createCabinet(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_cabinets')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        name,
        description,
        location,
        capacity,
        hardwareType,
        hardwareConfig,
        coordinates
      } = req.body;

      // Validações
      if (!name || !location || !capacity || !hardwareType) {
        return res.status(400).json({
          success: false,
          message: 'Nome, localização, capacidade e tipo de hardware são obrigatórios'
        });
      }

      if (capacity < 1 || capacity > 100) {
        return res.status(400).json({
          success: false,
          message: 'Capacidade deve estar entre 1 e 100 armários'
        });
      }

      // Verificar se já existe gabinete com o mesmo nome
      const existingCabinet = await cabinetService.getCabinetByName(name);
      if (existingCabinet) {
        return res.status(409).json({
          success: false,
          message: 'Já existe um gabinete com este nome'
        });
      }

      const cabinetData = {
        name,
        description,
        location,
        capacity: parseInt(capacity),
        hardwareType,
        hardwareConfig: hardwareConfig || {},
        coordinates: coordinates ? {
          latitude: parseFloat(coordinates.latitude),
          longitude: parseFloat(coordinates.longitude)
        } : null,
        isActive: true,
        createdBy: req.user.userId
      };

      const cabinet = await cabinetService.createCabinet(cabinetData);

      // Criar armários automaticamente
      const lockers = await lockerService.createLockersForCabinet(cabinet.id, capacity);

      logger.info(`Cabinet created: ${cabinet.id} with ${capacity} lockers by admin ${req.user.userId}`);

      res.status(201).json({
        success: true,
        message: 'Gabinete criado com sucesso',
        data: {
          cabinet: {
            ...cabinet,
            lockers
          }
        }
      });

    } catch (error) {
      logger.error('Create cabinet error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Atualizar gabinete (admin)
  async updateCabinet(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_cabinets')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId } = req.params;
      const updateData = req.body;

      if (!cabinetId) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete é obrigatório'
        });
      }

      const cabinet = await cabinetService.getCabinetById(cabinetId);
      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      // Campos permitidos para atualização
      const allowedFields = [
        'name', 'description', 'location', 'hardwareConfig', 
        'coordinates', 'isActive', 'maintenanceMode'
      ];

      const filteredData = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredData[key] = updateData[key];
        }
      });

      if (Object.keys(filteredData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum campo válido para atualização foi fornecido'
        });
      }

      // Verificar se o novo nome já existe (se nome foi alterado)
      if (filteredData.name && filteredData.name !== cabinet.name) {
        const existingCabinet = await cabinetService.getCabinetByName(filteredData.name);
        if (existingCabinet) {
          return res.status(409).json({
            success: false,
            message: 'Já existe um gabinete com este nome'
          });
        }
      }

      filteredData.updatedBy = req.user.userId;
      filteredData.updatedAt = new Date();

      const updatedCabinet = await cabinetService.updateCabinet(cabinetId, filteredData);

      // Log da ação administrativa
      await cabinetService.logAdminAction({
        userId: req.user.userId,
        action: 'update_cabinet',
        targetType: 'cabinet',
        targetId: cabinetId,
        details: { oldData: cabinet, newData: filteredData },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`Cabinet updated: ${cabinetId} by admin ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Gabinete atualizado com sucesso',
        data: updatedCabinet
      });

    } catch (error) {
      logger.error('Update cabinet error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Deletar gabinete (admin)
  async deleteCabinet(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_cabinets')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId } = req.params;
      const { force = false } = req.body;

      if (!cabinetId) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete é obrigatório'
        });
      }

      const cabinet = await cabinetService.getCabinetById(cabinetId, { includeLockers: true });
      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      // Verificar se há armários ocupados
      const occupiedLockers = cabinet.lockers?.filter(l => !l.isAvailable) || [];
      if (occupiedLockers.length > 0 && !force) {
        return res.status(409).json({
          success: false,
          message: `Gabinete possui ${occupiedLockers.length} armários ocupados`,
          data: {
            occupiedLockers: occupiedLockers.map(l => ({
              id: l.id,
              number: l.number,
              currentUserId: l.currentUserId
            })),
            requiresForce: true
          }
        });
      }

      // Deletar gabinete e todos os seus armários
      await cabinetService.deleteCabinet(cabinetId, {
        deletedBy: req.user.userId,
        force
      });

      // Limpar status do Redis para todos os armários
      if (cabinet.lockers) {
        for (const locker of cabinet.lockers) {
          const statusKey = redis.generateKey(redis.config.keyPrefixes.lockStatus, locker.id);
          await redis.cache.del(statusKey);
        }
      }

      // Log da ação administrativa
      await cabinetService.logAdminAction({
        userId: req.user.userId,
        action: 'delete_cabinet',
        targetType: 'cabinet',
        targetId: cabinetId,
        details: { 
          cabinetName: cabinet.name, 
          lockersDeleted: cabinet.lockers?.length || 0,
          forced: force 
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.warn(`Cabinet deleted: ${cabinetId} by admin ${req.user.userId} (force: ${force})`);

      res.json({
        success: true,
        message: 'Gabinete deletado com sucesso',
        data: {
          deletedCabinetId: cabinetId,
          deletedLockersCount: cabinet.lockers?.length || 0
        }
      });

    } catch (error) {
      logger.error('Delete cabinet error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter status do hardware do gabinete
  async getCabinetHardwareStatus(req, res) {
    try {
      const { cabinetId } = req.params;

      if (!cabinetId) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete é obrigatório'
        });
      }

      const cabinet = await cabinetService.getCabinetById(cabinetId);
      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      // Obter status do Redis
      const cacheStatus = await redis.hardwareStatus.get(cabinetId);

      // Tentar obter status direto do hardware
      let hardwareStatus = null;
      try {
        const hwResult = await hardwareService.getCabinetStatus(cabinetId);
        hardwareStatus = hwResult.success ? hwResult.status : null;
      } catch (error) {
        logger.warn(`Could not get real-time hardware status for cabinet ${cabinetId}`);
      }

      res.json({
        success: true,
        data: {
          cabinetId,
          cacheStatus,
          hardwareStatus,
          lastChecked: new Date(),
          isOnline: cacheStatus ? Date.now() - cacheStatus.timestamp < 60000 : false
        }
      });

    } catch (error) {
      logger.error('Get cabinet hardware status error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Testar conectividade com hardware do gabinete
  async testCabinetHardware(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('test_hardware')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId } = req.params;
      const { testType = 'ping' } = req.body; // ping, full, lockers

      if (!cabinetId) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete é obrigatório'
        });
      }

      const cabinet = await cabinetService.getCabinetById(cabinetId, { includeLockers: true });
      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      let testResults = {};

      switch (testType) {
        case 'ping':
          // Teste básico de conectividade
          testResults = await hardwareService.pingCabinet(cabinetId);
          break;

        case 'full':
          // Teste completo do sistema
          testResults = await hardwareService.fullHardwareTest(cabinetId);
          break;

        case 'lockers':
          // Teste individual de cada armário
          testResults = await hardwareService.testAllLockers(cabinetId);
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Tipo de teste inválido. Use: ping, full, ou lockers'
          });
      }

      // Log do teste
      await cabinetService.logHardwareTest({
        cabinetId,
        testType,
        results: testResults,
        performedBy: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`Hardware test performed on cabinet ${cabinetId}: ${testType} by admin ${req.user.userId}`);

      res.json({
        success: true,
        message: `Teste de hardware (${testType}) concluído`,
        data: {
          cabinetId,
          testType,
          testResults,
          performedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Test cabinet hardware error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Atualizar configuração do hardware
  async updateHardwareConfig(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_hardware')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId } = req.params;
      const { hardwareConfig } = req.body;

      if (!cabinetId || !hardwareConfig) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete e configuração são obrigatórios'
        });
      }

      const cabinet = await cabinetService.getCabinetById(cabinetId);
      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      // Validar configuração do hardware
      const validation = await hardwareService.validateHardwareConfig(hardwareConfig, cabinet.hardwareType);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: 'Configuração de hardware inválida',
          details: validation.errors
        });
      }

      // Atualizar configuração
      const updatedCabinet = await cabinetService.updateHardwareConfig(cabinetId, hardwareConfig);

      // Enviar nova configuração para o hardware
      try {
        await hardwareService.updateCabinetConfig(cabinetId, hardwareConfig);
      } catch (error) {
        logger.warn(`Could not send config update to hardware ${cabinetId}:`, error.message);
      }

      // Log da alteração
      await cabinetService.logAdminAction({
        userId: req.user.userId,
        action: 'update_hardware_config',
        targetType: 'cabinet',
        targetId: cabinetId,
        details: { 
          oldConfig: cabinet.hardwareConfig, 
          newConfig: hardwareConfig 
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`Hardware config updated for cabinet ${cabinetId} by admin ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Configuração do hardware atualizada com sucesso',
        data: updatedCabinet
      });

    } catch (error) {
      logger.error('Update hardware config error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Reiniciar hardware do gabinete
  async restartCabinetHardware(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('restart_hardware')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId } = req.params;
      const { force = false } = req.body;

      if (!cabinetId) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete é obrigatório'
        });
      }

      const cabinet = await cabinetService.getCabinetById(cabinetId, { includeLockers: true });
      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      // Verificar se há armários ocupados
      const occupiedLockers = cabinet.lockers?.filter(l => !l.isAvailable) || [];
      if (occupiedLockers.length > 0 && !force) {
        return res.status(409).json({
          success: false,
          message: `Gabinete possui ${occupiedLockers.length} armários ocupados`,
          data: {
            occupiedLockers: occupiedLockers.map(l => ({
              id: l.id,
              number: l.number
            })),
            requiresForce: true
          }
        });
      }

      try {
        // Enviar comando de reinicialização
        const restartResult = await hardwareService.restartCabinet(cabinetId);

        if (!restartResult.success) {
          return res.status(503).json({
            success: false,
            message: 'Falha ao reiniciar hardware',
            details: restartResult.error
          });
        }

        // Atualizar status no Redis
        await redis.hardwareStatus.set(cabinetId, {
          status: 'restarting',
          restartedBy: req.user.userId,
          restartedAt: Date.now(),
          level: 'info'
        });

        // Log da ação
        await cabinetService.logAdminAction({
          userId: req.user.userId,
          action: 'restart_hardware',
          targetType: 'cabinet',
          targetId: cabinetId,
          details: { forced: force },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });

        logger.warn(`Cabinet hardware restarted: ${cabinetId} by admin ${req.user.userId} (force: ${force})`);

        res.json({
          success: true,
          message: 'Hardware reiniciado com sucesso',
          data: {
            cabinetId,
            restartedAt: new Date(),
            estimatedRecoveryTime: '2-5 minutos'
          }
        });

      } catch (hardwareError) {
        logger.error(`Hardware restart failed for cabinet ${cabinetId}:`, hardwareError);

        return res.status(503).json({
          success: false,
          message: 'Falha na comunicação com o hardware para reinicialização'
        });
      }

    } catch (error) {
      logger.error('Restart cabinet hardware error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter estatísticas de uso do gabinete
  async getCabinetStats(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_stats')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId } = req.params;
      const { 
        period = '7d', 
        groupBy = 'day',
        includeHourly = false 
      } = req.query;

      if (!cabinetId) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete é obrigatório'
        });
      }

      const cabinet = await cabinetService.getCabinetById(cabinetId);
      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      // Calcular período
      const periodMs = {
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      };

      const startDate = new Date(Date.now() - (periodMs[period] || periodMs['7d']));
      const endDate = new Date();

      const stats = await cabinetService.getCabinetStats({
        cabinetId,
        startDate,
        endDate,
        groupBy,
        includeHourly: includeHourly === 'true'
      });

      res.json({
        success: true,
        data: {
          cabinetId,
          cabinetName: cabinet.name,
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
      logger.error('Get cabinet stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter localizações disponíveis
  async getLocations(req, res) {
    try {
      const locations = await cabinetService.getAvailableLocations();

      res.json({
        success: true,
        data: {
          locations,
          count: locations.length
        }
      });

    } catch (error) {
      logger.error('Get locations error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Entrar em modo de manutenção
  async enterMaintenanceMode(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('maintenance_mode')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId } = req.params;
      const { reason, estimatedDuration } = req.body;

      if (!cabinetId || !reason) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete e motivo são obrigatórios'
        });
      }

      const cabinet = await cabinetService.getCabinetById(cabinetId, { includeLockers: true });
      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      // Entrar em modo de manutenção
      await cabinetService.enterMaintenanceMode(cabinetId, {
        reason,
        estimatedDuration,
        startedBy: req.user.userId
      });

      // Atualizar status de todos os armários
      if (cabinet.lockers) {
        for (const locker of cabinet.lockers) {
          await redis.lockStatus.set(locker.id, {
            status: 'maintenance',
            maintenanceStarted: Date.now(),
            reason,
            startedBy: req.user.userId
          });
        }
      }

      // Publicar evento de manutenção
      await redis.pubsub.publish(redis.config.pubsub.channels.MAINTENANCE_ALERTS, {
        type: 'maintenance_started',
        cabinetId,
        reason,
        estimatedDuration,
        startedBy: req.user.userId,
        timestamp: Date.now()
      });

      logger.info(`Cabinet ${cabinetId} entered maintenance mode by admin ${req.user.userId}: ${reason}`);

      res.json({
        success: true,
        message: 'Gabinete entrou em modo de manutenção',
        data: {
          cabinetId,
          reason,
          estimatedDuration,
          startedAt: new Date(),
          affectedLockers: cabinet.lockers?.length || 0
        }
      });

    } catch (error) {
      logger.error('Enter maintenance mode error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Sair do modo de manutenção
  async exitMaintenanceMode(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('maintenance_mode')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId } = req.params;
      const { notes } = req.body;

      if (!cabinetId) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete é obrigatório'
        });
      }

      const cabinet = await cabinetService.getCabinetById(cabinetId, { includeLockers: true });
      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      if (!cabinet.maintenanceMode) {
        return res.status(400).json({
          success: false,
          message: 'Gabinete não está em modo de manutenção'
        });
      }

      // Sair do modo de manutenção
      await cabinetService.exitMaintenanceMode(cabinetId, {
        notes,
        completedBy: req.user.userId
      });

      // Restaurar status dos armários
      if (cabinet.lockers) {
        for (const locker of cabinet.lockers) {
          await redis.lockStatus.set(locker.id, {
            status: 'available',
            maintenanceCompleted: Date.now(),
            completedBy: req.user.userId
          });
        }
      }

      // Publicar evento
      await redis.pubsub.publish(redis.config.pubsub.channels.MAINTENANCE_ALERTS, {
        type: 'maintenance_completed',
        cabinetId,
        notes,
        completedBy: req.user.userId,
        timestamp: Date.now()
      });

      logger.info(`Cabinet ${cabinetId} exited maintenance mode by admin ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Gabinete saiu do modo de manutenção',
        data: {
          cabinetId,
          completedAt: new Date(),
          notes,
          restoredLockers: cabinet.lockers?.length || 0
        }
      });

    } catch (error) {
      logger.error('Exit maintenance mode error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter relatório de saúde do gabinete
  async getCabinetHealthReport(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_health')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId } = req.params;

      if (!cabinetId) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete é obrigatório'
        });
      }

      const cabinet = await cabinetService.getCabinetById(cabinetId, { 
        includeLockers: true,
        includeHardware: true 
      });

      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      // Gerar relatório de saúde
      const healthReport = await cabinetService.generateHealthReport(cabinetId);

      res.json({
        success: true,
        data: {
          cabinetId,
          cabinetName: cabinet.name,
          healthReport,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Get cabinet health report error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = new CabinetController();