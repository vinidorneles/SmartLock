const historyService = require('../services/historyService');
const userService = require('../services/userService');
const lockerService = require('../services/lockerService');
const redis = require('../config/redis');
const logger = require('../utils/logger');

class HistoryController {
  // Obter histórico geral do sistema (admin)
  async getSystemHistory(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_system_history')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        action,
        userId,
        lockerId,
        cabinetId,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 200),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        action,
        userId,
        lockerId,
        cabinetId,
        status,
        sortBy,
        sortOrder,
        includeUserData: true,
        includeLockerData: true
      };

      const history = await historyService.getSystemHistory(filters);

      res.json({
        success: true,
        data: {
          transactions: history.records,
          pagination: {
            page: history.page,
            limit: history.limit,
            total: history.total,
            pages: Math.ceil(history.total / history.limit)
          },
          filters: {
            startDate: filters.startDate,
            endDate: filters.endDate,
            action,
            status
          }
        }
      });

    } catch (error) {
      logger.error('Get system history error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter histórico de transações do usuário atual
  async getUserHistory(req, res) {
    try {
      const userId = req.user.userId;
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        action,
        status,
        lockerId
      } = req.query;

      const filters = {
        userId,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        action,
        status,
        lockerId,
        includeLockerData: true
      };

      const history = await historyService.getUserHistory(filters);

      res.json({
        success: true,
        data: {
          transactions: history.records,
          pagination: {
            page: history.page,
            limit: history.limit,
            total: history.total,
            pages: Math.ceil(history.total / history.limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get user history error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter detalhes de uma transação específica
  async getTransactionDetails(req, res) {
    try {
      const { transactionId } = req.params;
      const userId = req.user.userId;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          message: 'ID da transação é obrigatório'
        });
      }

      const transaction = await historyService.getTransactionById(transactionId, {
        includeUserData: true,
        includeLockerData: true,
        includeHardwareData: true
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transação não encontrada'
        });
      }

      // Verificar permissões
      const isAdmin = req.user.userType === 'admin';
      const isOwner = transaction.userId === userId;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para visualizar esta transação'
        });
      }

      // Obter logs relacionados se for admin
      let relatedLogs = null;
      if (isAdmin) {
        relatedLogs = await historyService.getTransactionLogs(transactionId);
      }

      res.json({
        success: true,
        data: {
          transaction,
          relatedLogs
        }
      });

    } catch (error) {
      logger.error('Get transaction details error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter estatísticas de uso geral (admin)
  async getUsageStatistics(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_statistics')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        period = '30d',
        groupBy = 'day',
        includeComparison = false,
        cabinetId,
        department
      } = req.query;

      // Calcular período
      const periodMs = {
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000,
        '1y': 365 * 24 * 60 * 60 * 1000
      };

      const startDate = new Date(Date.now() - (periodMs[period] || periodMs['30d']));
      const endDate = new Date();

      const stats = await historyService.getUsageStatistics({
        startDate,
        endDate,
        groupBy,
        cabinetId,
        department,
        includeComparison: includeComparison === 'true'
      });

      res.json({
        success: true,
        data: {
          statistics: stats,
          period: {
            startDate,
            endDate,
            period,
            groupBy
          },
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Get usage statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter relatório de atividade por período
  async getActivityReport(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_reports')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        startDate,
        endDate,
        reportType = 'summary', // summary, detailed, analytics
        format = 'json', // json, csv
        includeCharts = false
      } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Data de início e fim são obrigatórias'
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: 'Data de início deve ser anterior à data de fim'
        });
      }

      // Limite máximo de 1 ano
      const maxPeriod = 365 * 24 * 60 * 60 * 1000;
      if (end.getTime() - start.getTime() > maxPeriod) {
        return res.status(400).json({
          success: false,
          message: 'Período máximo permitido: 1 ano'
        });
      }

      const reportData = await historyService.generateActivityReport({
        startDate: start,
        endDate: end,
        reportType,
        includeCharts: includeCharts === 'true',
        generatedBy: req.user.userId
      });

      // Log da geração do relatório
      await historyService.logReportGeneration({
        reportType: 'activity',
        startDate: start,
        endDate: end,
        format,
        generatedBy: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`Activity report generated by admin ${req.user.userId}: ${start.toISOString()} to ${end.toISOString()}`);

      if (format === 'csv') {
        const csv = await historyService.convertToCSV(reportData);
        const filename = `activity_report_${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.csv`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
      } else {
        res.json({
          success: true,
          data: {
            report: reportData,
            period: { startDate: start, endDate: end },
            reportType,
            generatedAt: new Date()
          }
        });
      }

    } catch (error) {
      logger.error('Get activity report error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter logs de erro (admin)
  async getErrorLogs(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_error_logs')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        level,
        component,
        search
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 200),
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000), // Último dia por padrão
        endDate: endDate ? new Date(endDate) : new Date(),
        level, // error, warn, info
        component, // auth, hardware, api, etc.
        search
      };

      const logs = await historyService.getErrorLogs(filters);

      res.json({
        success: true,
        data: {
          logs: logs.records,
          pagination: {
            page: logs.page,
            limit: logs.limit,
            total: logs.total,
            pages: Math.ceil(logs.total / logs.limit)
          },
          summary: {
            errorCount: logs.errorCount,
            warningCount: logs.warningCount,
            topErrors: logs.topErrors
          }
        }
      });

    } catch (error) {
      logger.error('Get error logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter métricas em tempo real
  async getRealtimeMetrics(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_metrics')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      // Obter métricas do Redis
      const today = new Date().toISOString().split('T')[0];
      
      const metrics = {
        // Métricas de hoje
        today: {
          totalUnlocks: await redis.metrics.get('unlocks', today),
          totalUsers: await redis.metrics.get('active_users', today),
          totalQRGenerated: await redis.metrics.get('qr_generated', today),
          totalErrors: await redis.metrics.get('errors', today)
        },
        
        // Status atual dos armários
        lockers: {
          total: await redis.metrics.get('total_lockers'),
          available: await redis.metrics.get('available_lockers'),
          occupied: await redis.metrics.get('occupied_lockers'),
          maintenance: await redis.metrics.get('maintenance_lockers'),
          offline: await redis.metrics.get('offline_lockers')
        },
        
        // Status do hardware
        hardware: {
          onlineCabinets: await redis.metrics.get('online_cabinets'),
          totalCabinets: await redis.metrics.get('total_cabinets'),
          alertsCount: await redis.metrics.get('hardware_alerts', today)
        },
        
        // Usuários online
        users: {
          currentlyActive: await redis.metrics.get('users_online'),
          totalRegistered: await redis.metrics.get('total_users'),
          newToday: await redis.metrics.get('new_users', today)
        }
      };

      // Obter tendências (comparação com período anterior)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const trends = {
        unlocks: {
          today: metrics.today.totalUnlocks,
          yesterday: await redis.metrics.get('unlocks', yesterday),
          change: 0
        },
        users: {
          today: metrics.today.totalUsers,
          yesterday: await redis.metrics.get('active_users', yesterday),
          change: 0
        },
        qrCodes: {
          today: metrics.today.totalQRGenerated,
          yesterday: await redis.metrics.get('qr_generated', yesterday),
          change: 0
        }
      };

      // Calcular mudanças percentuais
      Object.keys(trends).forEach(key => {
        const today = trends[key].today;
        const yesterday = trends[key].yesterday;
        
        if (yesterday > 0) {
          trends[key].change = ((today - yesterday) / yesterday * 100).toFixed(1);
        }
      });

      res.json({
        success: true,
        data: {
          metrics,
          trends,
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Get realtime metrics error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter transações por armário
  async getLockerTransactions(req, res) {
    try {
      const { lockerId } = req.params;
      const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        action,
        status
      } = req.query;

      if (!lockerId) {
        return res.status(400).json({
          success: false,
          message: 'ID do armário é obrigatório'
        });
      }

      // Verificar se o usuário tem permissão para ver este armário
      const isAdmin = req.user.userType === 'admin';
      if (!isAdmin) {
        const hasPermission = await lockerService.checkUserPermission(req.user.userId, lockerId);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'Você não tem permissão para visualizar este armário'
          });
        }
      }

      const filters = {
        lockerId,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        action,
        status,
        includeUserData: isAdmin // Incluir dados do usuário apenas para admin
      };

      const transactions = await historyService.getLockerTransactions(filters);

      res.json({
        success: true,
        data: {
          lockerId,
          transactions: transactions.records,
          pagination: {
            page: transactions.page,
            limit: transactions.limit,
            total: transactions.total,
            pages: Math.ceil(transactions.total / transactions.limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get locker transactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter relatório de uso por departamento
  async getDepartmentReport(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_department_reports')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        startDate,
        endDate,
        department,
        includeUsers = false,
        groupBy = 'day'
      } = req.query;

      const filters = {
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate) : new Date(),
        department,
        includeUsers: includeUsers === 'true',
        groupBy
      };

      const report = await historyService.getDepartmentReport(filters);

      res.json({
        success: true,
        data: {
          report,
          period: {
            startDate: filters.startDate,
            endDate: filters.endDate,
            groupBy
          },
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Get department report error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter logs de auditoria (admin)
  async getAuditLogs(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_audit_logs')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        action,
        userId,
        targetType,
        targetId
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 200),
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 dias por padrão
        endDate: endDate ? new Date(endDate) : new Date(),
        action,
        userId,
        targetType, // user, locker, cabinet, system
        targetId
      };

      const auditLogs = await historyService.getAuditLogs(filters);

      res.json({
        success: true,
        data: {
          auditLogs: auditLogs.records,
          pagination: {
            page: auditLogs.page,
            limit: auditLogs.limit,
            total: auditLogs.total,
            pages: Math.ceil(auditLogs.total / auditLogs.limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get audit logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Exportar histórico de transações
  async exportHistory(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('export_history')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        startDate,
        endDate,
        format = 'csv', // csv, json, xlsx
        includeUserData = true,
        cabinetId,
        department,
        action,
        status
      } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Data de início e fim são obrigatórias'
        });
      }

      const allowedFormats = ['csv', 'json', 'xlsx'];
      if (!allowedFormats.includes(format)) {
        return res.status(400).json({
          success: false,
          message: `Formato inválido. Permitidos: ${allowedFormats.join(', ')}`
        });
      }

      const filters = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        cabinetId,
        department,
        action,
        status,
        includeUserData: includeUserData === 'true',
        includeLockerData: true
      };

      const exportData = await historyService.exportHistory(filters, format);

      // Log da exportação
      await historyService.logReportGeneration({
        reportType: 'history_export',
        startDate: filters.startDate,
        endDate: filters.endDate,
        format,
        recordCount: exportData.recordCount,
        generatedBy: req.user.userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`History exported by admin ${req.user.userId}: ${exportData.recordCount} records in ${format} format`);

      // Configurar headers baseado no formato
      const contentTypes = {
        csv: 'text/csv',
        json: 'application/json',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      const filename = `history_export_${filters.startDate.toISOString().split('T')[0]}_to_${filters.endDate.toISOString().split('T')[0]}.${format}`;

      res.setHeader('Content-Type', contentTypes[format]);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      if (format === 'json') {
        res.json({
          success: true,
          data: exportData.data,
          meta: {
            exportedAt: new Date(),
            recordCount: exportData.recordCount,
            filters
          }
        });
      } else {
        res.send(exportData.data);
      }

    } catch (error) {
      logger.error('Export history error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Limpar histórico antigo (admin)
  async cleanupOldHistory(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('system_maintenance')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { 
        olderThanDays = 365, // Manter 1 ano por padrão
        dryRun = false 
      } = req.body;

      if (olderThanDays < 90) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível deletar registros com menos de 90 dias'
        });
      }

      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
      
      const cleanupResult = await historyService.cleanupOldHistory({
        cutoffDate,
        dryRun: dryRun === 'true',
        executedBy: req.user.userId
      });

      if (!dryRun) {
        // Log da limpeza
        await historyService.logSystemMaintenance({
          action: 'cleanup_old_history',
          details: {
            cutoffDate,
            recordsDeleted: cleanupResult.deletedCount,
            tablesAffected: cleanupResult.tablesAffected
          },
          executedBy: req.user.userId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });

        logger.info(`History cleanup completed by admin ${req.user.userId}: ${cleanupResult.deletedCount} records deleted`);
      }

      res.json({
        success: true,
        message: dryRun ? 'Simulação de limpeza concluída' : 'Limpeza de histórico concluída',
        data: {
          cutoffDate,
          deletedCount: cleanupResult.deletedCount,
          tablesAffected: cleanupResult.tablesAffected,
          executionTime: cleanupResult.executionTime,
          dryRun
        }
      });

    } catch (error) {
      logger.error('Cleanup old history error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter dashboard de métricas
  async getDashboardMetrics(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_dashboard')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { period = '7d' } = req.query;

      // Obter métricas consolidadas para o dashboard
      const dashboardData = await historyService.getDashboardMetrics(period);

      // Obter alertas recentes
      const recentAlerts = await historyService.getRecentAlerts(10);

      // Obter atividade recente
      const recentActivity = await historyService.getRecentActivity(20);

      res.json({
        success: true,
        data: {
          metrics: dashboardData.metrics,
          charts: dashboardData.charts,
          alerts: recentAlerts,
          recentActivity,
          period,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Get dashboard metrics error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = new HistoryController();