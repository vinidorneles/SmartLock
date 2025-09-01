const hardwareService = require('../services/hardwareService');
const redis = require('../config/redis');
const jwt = require('../config/jwt');
const logger = require('../utils/logger');

class HardwareController {
  // Receber status do hardware (endpoint para dispositivos)
  async receiveHardwareStatus(req, res) {
    try {
      const { cabinetId, status, lockers, sensors, system } = req.body;

      // Validar token de hardware
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Token de autenticação necessário'
        });
      }

      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verifyHardwareToken(token);
        
        // Verificar se o token é para este gabinete
        if (decoded.cabinetId !== cabinetId) {
          return res.status(403).json({
            success: false,
            message: 'Token não válido para este gabinete'
          });
        }
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Token inválido'
        });
      }

      if (!cabinetId || !status) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete e status são obrigatórios'
        });
      }

      // Rate limiting por gabinete
      const rateLimitKey = redis.generateKey(redis.config.keyPrefixes.rateLimiting, 'hardware_status', cabinetId);
      const rateLimit = await redis.rateLimiting.check(rateLimitKey, 60, 60); // 60 por minuto

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit excedido para este gabinete'
        });
      }

      // Processar status do gabinete
      await hardwareService.processHardwareStatus({
        cabinetId,
        status: {
          ...status,
          timestamp: Date.now(),
          ipAddress: req.ip
        },
        lockers: lockers || [],
        sensors: sensors || {},
        system: system || {}
      });

      // Atualizar status no Redis
      await redis.hardwareStatus.set(cabinetId, {
        ...status,
        lastSeen: Date.now(),
        ipAddress: req.ip,
        level: status.health || 'info'
      });

      // Atualizar status individual dos armários
      if (lockers && Array.isArray(lockers)) {
        for (const locker of lockers) {
          if (locker.id && locker.status) {
            await redis.lockStatus.set(locker.id, {
              status: locker.status,
              timestamp: Date.now(),
              sensorData: locker.sensors || {},
              hardwareId: cabinetId
            });
          }
        }
      }

      // Verificar alertas críticos
      if (status.level === 'error' || status.level === 'critical') {
        await redis.pubsub.publish(redis.config.pubsub.channels.HARDWARE_ALERTS, {
          type: 'critical_status',
          cabinetId,
          status,
          timestamp: Date.now()
        });
      }

      logger.debug(`Hardware status received from cabinet ${cabinetId}`);

      res.json({
        success: true,
        message: 'Status recebido com sucesso',
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Receive hardware status error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Enviar comando para hardware
  async sendHardwareCommand(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('send_hardware_commands')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId, lockerId, command, parameters, priority = 'normal' } = req.body;

      if (!cabinetId || !command) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete e comando são obrigatórios'
        });
      }

      const allowedCommands = ['unlock', 'lock', 'status', 'reset', 'maintenance', 'reboot'];
      if (!allowedCommands.includes(command)) {
        return res.status(400).json({
          success: false,
          message: `Comando inválido. Permitidos: ${allowedCommands.join(', ')}`
        });
      }

      // Rate limiting para comandos
      const rateLimitKey = redis.generateKey(redis.config.keyPrefixes.rateLimiting, 'hardware_commands', req.user.userId);
      const rateLimit = await redis.rateLimiting.check(rateLimitKey, 50, 3600); // 50 por hora

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Limite de comandos excedido',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        });
      }

      // Verificar se o gabinete existe e está online
      const cabinetStatus = await redis.hardwareStatus.get(cabinetId);
      if (!cabinetStatus) {
        return res.status(404).json({
          success: false,
          message: 'Status do gabinete não encontrado'
        });
      }

      const isOnline = Date.now() - cabinetStatus.lastSeen < 300000; // 5 minutos
      if (!isOnline) {
        return res.status(503).json({
          success: false,
          message: 'Gabinete offline - não é possível enviar comandos'
        });
      }

      // Enviar comando
      const result = await hardwareService.sendCommand({
        cabinetId,
        lockerId,
        command,
        parameters: parameters || {},
        priority,
        sentBy: req.user.userId,
        metadata: {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          timestamp: Date.now()
        }
      });

      // Log do comando enviado
      await hardwareService.logHardwareCommand({
        cabinetId,
        lockerId,
        command,
        parameters,
        success: result.success,
        response: result.response,
        sentBy: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      if (!result.success) {
        return res.status(503).json({
          success: false,
          message: 'Falha ao enviar comando para o hardware',
          details: result.error
        });
      }

      logger.info(`Hardware command sent: ${command} to cabinet ${cabinetId} by admin ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Comando enviado com sucesso',
        data: {
          cabinetId,
          lockerId,
          command,
          commandId: result.commandId,
          sentAt: new Date(),
          response: result.response
        }
      });

    } catch (error) {
      logger.error('Send hardware command error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter status de todos os hardwares
  async getHardwareStatus(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_hardware_status')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { includeOffline = true, includeDetails = false } = req.query;

      const hardwareList = await hardwareService.getAllHardwareStatus({
        includeOffline: includeOffline === 'true',
        includeDetails: includeDetails === 'true'
      });

      // Enriquecer com dados do Redis
      for (const hardware of hardwareList) {
        const realtimeStatus = await redis.hardwareStatus.get(hardware.cabinetId);
        hardware.realtimeStatus = realtimeStatus;
        
        if (realtimeStatus) {
          hardware.isOnline = Date.now() - realtimeStatus.lastSeen < 300000; // 5 minutos
          hardware.lastSeen = realtimeStatus.lastSeen;
        } else {
          hardware.isOnline = false;
          hardware.lastSeen = null;
        }
      }

      // Calcular estatísticas
      const stats = {
        total: hardwareList.length,
        online: hardwareList.filter(h => h.isOnline).length,
        offline: hardwareList.filter(h => !h.isOnline).length,
        error: hardwareList.filter(h => h.realtimeStatus?.level === 'error').length,
        warning: hardwareList.filter(h => h.realtimeStatus?.level === 'warning').length
      };

      res.json({
        success: true,
        data: {
          hardware: hardwareList,
          stats,
          lastUpdated: new Date()
        }
      });

    } catch (error) {
      logger.error('Get hardware status error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter logs de hardware
  async getHardwareLogs(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_hardware_logs')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        cabinetId,
        page = 1,
        limit = 50,
        startDate,
        endDate,
        level,
        logType
      } = req.query;

      const filters = {
        cabinetId,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 200),
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000), // 24h por padrão
        endDate: endDate ? new Date(endDate) : new Date(),
        level, // info, warning, error, critical
        logType // status, command, alert, system
      };

      const logs = await hardwareService.getHardwareLogs(filters);

      res.json({
        success: true,
        data: {
          logs: logs.records,
          pagination: {
            page: logs.page,
            limit: logs.limit,
            total: logs.total,
            pages: Math.ceil(logs.total / logs.limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get hardware logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Registrar dispositivo hardware
  async registerHardware(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('register_hardware')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        cabinetId,
        hardwareType,
        hardwareId,
        version,
        capabilities,
        networkConfig
      } = req.body;

      if (!cabinetId || !hardwareType || !hardwareId) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete, tipo e ID do hardware são obrigatórios'
        });
      }

      // Verificar se o hardware já está registrado
      const existingHardware = await hardwareService.getHardwareByDeviceId(hardwareId);
      if (existingHardware) {
        return res.status(409).json({
          success: false,
          message: 'Hardware já registrado',
          data: { existingCabinetId: existingHardware.cabinetId }
        });
      }

      // Registrar hardware
      const hardware = await hardwareService.registerHardware({
        cabinetId,
        hardwareType,
        hardwareId,
        version,
        capabilities: capabilities || [],
        networkConfig: networkConfig || {},
        registeredBy: req.user.userId,
        registeredAt: new Date()
      });

      // Gerar token de autenticação para o hardware
      const hardwareToken = jwt.generateHardwareToken(cabinetId, hardwareId);

      logger.info(`Hardware registered: ${hardwareId} for cabinet ${cabinetId} by admin ${req.user.userId}`);

      res.status(201).json({
        success: true,
        message: 'Hardware registrado com sucesso',
        data: {
          hardware,
          authToken: hardwareToken
        }
      });

    } catch (error) {
      logger.error('Register hardware error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Remover registro de hardware
  async unregisterHardware(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('unregister_hardware')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { hardwareId } = req.params;
      const { reason } = req.body;

      if (!hardwareId) {
        return res.status(400).json({
          success: false,
          message: 'ID do hardware é obrigatório'
        });
      }

      const hardware = await hardwareService.getHardwareByDeviceId(hardwareId);
      if (!hardware) {
        return res.status(404).json({
          success: false,
          message: 'Hardware não encontrado'
        });
      }

      // Remover registro
      await hardwareService.unregisterHardware(hardwareId, {
        unregisteredBy: req.user.userId,
        reason: reason || 'Removido pelo administrador'
      });

      // Limpar status do Redis
      const statusKey = redis.generateKey(redis.config.keyPrefixes.hardwareStatus, hardware.cabinetId);
      await redis.cache.del(statusKey);

      logger.warn(`Hardware unregistered: ${hardwareId} by admin ${req.user.userId} - ${reason}`);

      res.json({
        success: true,
        message: 'Hardware removido com sucesso',
        data: {
          hardwareId,
          unregisteredAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Unregister hardware error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Atualizar firmware (iniciar processo)
  async updateFirmware(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('update_firmware')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId } = req.params;
      const { firmwareVersion, forceUpdate = false } = req.body;

      if (!cabinetId || !firmwareVersion) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete e versão do firmware são obrigatórios'
        });
      }

      // Verificar se o gabinete está online
      const cabinetStatus = await redis.hardwareStatus.get(cabinetId);
      if (!cabinetStatus) {
        return res.status(404).json({
          success: false,
          message: 'Gabinete não encontrado'
        });
      }

      const isOnline = Date.now() - cabinetStatus.lastSeen < 300000;
      if (!isOnline) {
        return res.status(503).json({
          success: false,
          message: 'Gabinete offline - não é possível atualizar firmware'
        });
      }

      // Verificar se há armários ocupados
      if (!forceUpdate) {
        const occupiedLockers = await hardwareService.getOccupiedLockers(cabinetId);
        if (occupiedLockers.length > 0) {
          return res.status(409).json({
            success: false,
            message: `Gabinete possui ${occupiedLockers.length} armários ocupados`,
            data: { requiresForce: true }
          });
        }
      }

      // Iniciar processo de atualização
      const updateResult = await hardwareService.startFirmwareUpdate({
        cabinetId,
        firmwareVersion,
        forceUpdate,
        initiatedBy: req.user.userId
      });

      if (!updateResult.success) {
        return res.status(503).json({
          success: false,
          message: 'Falha ao iniciar atualização do firmware',
          details: updateResult.error
        });
      }

      // Atualizar status no Redis
      await redis.hardwareStatus.set(cabinetId, {
        status: 'updating',
        updateStarted: Date.now(),
        firmwareVersion,
        initiatedBy: req.user.userId,
        level: 'info'
      });

      logger.info(`Firmware update started for cabinet ${cabinetId} to version ${firmwareVersion} by admin ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Atualização de firmware iniciada',
        data: {
          cabinetId,
          firmwareVersion,
          updateId: updateResult.updateId,
          estimatedDuration: '5-15 minutos',
          startedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Update firmware error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter alertas de hardware
  async getHardwareAlerts(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_hardware_alerts')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        cabinetId,
        severity,
        status = 'open',
        page = 1,
        limit = 20,
        startDate,
        endDate
      } = req.query;

      const filters = {
        cabinetId,
        severity, // low, medium, high, critical
        status, // open, acknowledged, resolved
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 dias
        endDate: endDate ? new Date(endDate) : new Date()
      };

      const alerts = await hardwareService.getHardwareAlerts(filters);

      res.json({
        success: true,
        data: {
          alerts: alerts.records,
          pagination: {
            page: alerts.page,
            limit: alerts.limit,
            total: alerts.total,
            pages: Math.ceil(alerts.total / alerts.limit)
          },
          summary: {
            critical: alerts.summary?.critical || 0,
            high: alerts.summary?.high || 0,
            medium: alerts.summary?.medium || 0,
            low: alerts.summary?.low || 0
          }
        }
      });

    } catch (error) {
      logger.error('Get hardware alerts error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Reconhecer alerta
  async acknowledgeAlert(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_hardware_alerts')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { alertId } = req.params;
      const { notes } = req.body;

      if (!alertId) {
        return res.status(400).json({
          success: false,
          message: 'ID do alerta é obrigatório'
        });
      }

      const alert = await hardwareService.getAlertById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alerta não encontrado'
        });
      }

      if (alert.status !== 'open') {
        return res.status(400).json({
          success: false,
          message: 'Alerta já foi processado'
        });
      }

      // Reconhecer alerta
      await hardwareService.acknowledgeAlert(alertId, {
        acknowledgedBy: req.user.userId,
        notes: notes || '',
        acknowledgedAt: new Date()
      });

      logger.info(`Hardware alert acknowledged: ${alertId} by admin ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Alerta reconhecido com sucesso',
        data: {
          alertId,
          acknowledgedBy: req.user.userId,
          acknowledgedAt: new Date(),
          notes
        }
      });

    } catch (error) {
      logger.error('Acknowledge alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Resolver alerta
  async resolveAlert(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_hardware_alerts')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { alertId } = req.params;
      const { resolution, notes } = req.body;

      if (!alertId || !resolution) {
        return res.status(400).json({
          success: false,
          message: 'ID do alerta e resolução são obrigatórios'
        });
      }

      const alert = await hardwareService.getAlertById(alertId);
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alerta não encontrado'
        });
      }

      if (alert.status === 'resolved') {
        return res.status(400).json({
          success: false,
          message: 'Alerta já foi resolvido'
        });
      }

      // Resolver alerta
      await hardwareService.resolveAlert(alertId, {
        resolution,
        notes: notes || '',
        resolvedBy: req.user.userId,
        resolvedAt: new Date()
      });

      logger.info(`Hardware alert resolved: ${alertId} by admin ${req.user.userId} - ${resolution}`);

      res.json({
        success: true,
        message: 'Alerta resolvido com sucesso',
        data: {
          alertId,
          resolution,
          resolvedBy: req.user.userId,
          resolvedAt: new Date(),
          notes
        }
      });

    } catch (error) {
      logger.error('Resolve alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Executar diagnóstico de hardware
  async runDiagnostics(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('run_diagnostics')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { cabinetId } = req.params;
      const { testType = 'basic', includeLockers = true } = req.body;

      if (!cabinetId) {
        return res.status(400).json({
          success: false,
          message: 'ID do gabinete é obrigatório'
        });
      }

      const allowedTestTypes = ['basic', 'comprehensive', 'network', 'sensors', 'locks'];
      if (!allowedTestTypes.includes(testType)) {
        return res.status(400).json({
          success: false,
          message: `Tipo de teste inválido. Permitidos: ${allowedTestTypes.join(', ')}`
        });
      }

      // Verificar se o gabinete está online
      const cabinetStatus = await redis.hardwareStatus.get(cabinetId);
      if (!cabinetStatus || Date.now() - cabinetStatus.lastSeen > 300000) {
        return res.status(503).json({
          success: false,
          message: 'Gabinete offline - não é possível executar diagnósticos'
        });
      }

      // Executar diagnósticos
      const diagnostics = await hardwareService.runDiagnostics({
        cabinetId,
        testType,
        includeLockers,
        executedBy: req.user.userId
      });

      // Log dos diagnósticos
      await hardwareService.logDiagnostics({
        cabinetId,
        testType,
        results: diagnostics,
        executedBy: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`Hardware diagnostics completed for cabinet ${cabinetId}: ${testType} by admin ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Diagnósticos concluídos',
        data: {
          cabinetId,
          testType,
          results: diagnostics,
          executedAt: new Date(),
          executionTime: diagnostics.executionTime
        }
      });

    } catch (error) {
      logger.error('Run diagnostics error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter configuração do hardware
  async getHardwareConfig(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_hardware_config')) {
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

      const config = await hardwareService.getHardwareConfig(cabinetId);

      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Configuração de hardware não encontrada'
        });
      }

      res.json({
        success: true,
        data: {
          cabinetId,
          config,
          lastUpdated: config.updatedAt
        }
      });

    } catch (error) {
      logger.error('Get hardware config error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Gerar relatório de saúde do hardware
  async generateHealthReport(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('generate_reports')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        cabinetId,
        period = '7d',
        includeRecommendations = true,
        format = 'json'
      } = req.query;

      const allowedFormats = ['json', 'pdf'];
      if (!allowedFormats.includes(format)) {
        return res.status(400).json({
          success: false,
          message: `Formato inválido. Permitidos: ${allowedFormats.join(', ')}`
        });
      }

      // Calcular período
      const periodMs = {
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const startDate = new Date(Date.now() - (periodMs[period] || periodMs['7d']));
      const endDate = new Date();

      // Gerar relatório
      const report = await hardwareService.generateHealthReport({
        cabinetId,
        startDate,
        endDate,
        includeRecommendations: includeRecommendations === 'true',
        generatedBy: req.user.userId
      });

      logger.info(`Hardware health report generated by admin ${req.user.userId} for cabinet ${cabinetId || 'all'}`);

      if (format === 'pdf') {
        // Gerar PDF (implementar conforme necessário)
        const pdf = await hardwareService.generateReportPDF(report);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="hardware_health_report_${new Date().toISOString().split('T')[0]}.pdf"`);
        res.send(pdf);
      } else {
        res.json({
          success: true,
          data: {
            report,
            period: { startDate, endDate, period },
            generatedAt: new Date()
          }
        });
      }

    } catch (error) {
      logger.error('Generate health report error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = new HardwareController();