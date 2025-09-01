const notificationService = require('../services/notificationService');
const redis = require('../config/redis');
const logger = require('../utils/logger');

class NotificationController {
  // Obter notificações do usuário
  async getUserNotifications(req, res) {
    try {
      const userId = req.user.userId;
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        type,
        startDate,
        endDate
      } = req.query;

      const filters = {
        userId,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        unreadOnly: unreadOnly === 'true',
        type,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      };

      const notifications = await notificationService.getUserNotifications(filters);

      // Obter contadores
      const counts = await notificationService.getNotificationCounts(userId);

      res.json({
        success: true,
        data: {
          notifications: notifications.records,
          pagination: {
            page: notifications.page,
            limit: notifications.limit,
            total: notifications.total,
            pages: Math.ceil(notifications.total / notifications.limit)
          },
          counts: {
            total: counts.total,
            unread: counts.unread,
            byType: counts.byType
          }
        }
      });

    } catch (error) {
      logger.error('Get user notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Marcar notificação como lida
  async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const userId = req.user.userId;

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: 'ID da notificação é obrigatório'
        });
      }

      const notification = await notificationService.getNotificationById(notificationId);
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notificação não encontrada'
        });
      }

      // Verificar se a notificação pertence ao usuário
      if (notification.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para marcar esta notificação'
        });
      }

      if (notification.readAt) {
        return res.status(400).json({
          success: false,
          message: 'Notificação já foi lida'
        });
      }

      // Marcar como lida
      await notificationService.markAsRead(notificationId, userId);

      // Atualizar contador no cache
      const cacheKey = redis.generateKey('notification_count', userId);
      const cachedCount = await redis.cache.get(cacheKey);
      if (cachedCount && cachedCount.unread > 0) {
        cachedCount.unread -= 1;
        await redis.cache.set(cacheKey, cachedCount, 3600);
      }

      logger.debug(`Notification marked as read: ${notificationId} by user ${userId}`);

      res.json({
        success: true,
        message: 'Notificação marcada como lida',
        data: {
          notificationId,
          readAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Marcar todas as notificações como lidas
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.userId;
      const { olderThan } = req.body; // Opcional: marcar apenas notificações mais antigas que X

      const filters = {
        userId,
        unreadOnly: true,
        olderThan: olderThan ? new Date(olderThan) : null
      };

      const result = await notificationService.markAllAsRead(filters);

      // Limpar contador do cache
      const cacheKey = redis.generateKey('notification_count', userId);
      await redis.cache.del(cacheKey);

      logger.info(`All notifications marked as read for user ${userId}: ${result.updatedCount} notifications`);

      res.json({
        success: true,
        message: 'Todas as notificações foram marcadas como lidas',
        data: {
          updatedCount: result.updatedCount,
          updatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Mark all notifications as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Deletar notificação
  async deleteNotification(req, res) {
    try {
      const { notificationId } = req.params;
      const userId = req.user.userId;

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          message: 'ID da notificação é obrigatório'
        });
      }

      const notification = await notificationService.getNotificationById(notificationId);
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notificação não encontrada'
        });
      }

      // Verificar se a notificação pertence ao usuário
      if (notification.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para deletar esta notificação'
        });
      }

      // Deletar notificação
      await notificationService.deleteNotification(notificationId, userId);

      // Atualizar contador no cache se não foi lida
      if (!notification.readAt) {
        const cacheKey = redis.generateKey('notification_count', userId);
        const cachedCount = await redis.cache.get(cacheKey);
        if (cachedCount && cachedCount.unread > 0) {
          cachedCount.unread -= 1;
          cachedCount.total -= 1;
          await redis.cache.set(cacheKey, cachedCount, 3600);
        }
      }

      logger.debug(`Notification deleted: ${notificationId} by user ${userId}`);

      res.json({
        success: true,
        message: 'Notificação deletada com sucesso'
      });

    } catch (error) {
      logger.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Limpar notificações antigas
  async clearOldNotifications(req, res) {
    try {
      const userId = req.user.userId;
      const { olderThanDays = 30, readOnly = true } = req.body;

      if (olderThanDays < 7) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível deletar notificações com menos de 7 dias'
        });
      }

      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));

      const result = await notificationService.clearOldNotifications({
        userId,
        cutoffDate,
        readOnly: readOnly === 'true' // Deletar apenas as lidas se true
      });

      // Limpar contador do cache
      const cacheKey = redis.generateKey('notification_count', userId);
      await redis.cache.del(cacheKey);

      logger.info(`Old notifications cleared for user ${userId}: ${result.deletedCount} notifications`);

      res.json({
        success: true,
        message: 'Notificações antigas removidas com sucesso',
        data: {
          deletedCount: result.deletedCount,
          cutoffDate,
          readOnly
        }
      });

    } catch (error) {
      logger.error('Clear old notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Atualizar preferências de notificação
  async updateNotificationPreferences(req, res) {
    try {
      const userId = req.user.userId;
      const { preferences } = req.body;

      if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Preferências de notificação são obrigatórias'
        });
      }

      // Validar estrutura das preferências
      const allowedChannels = ['push', 'email', 'sms'];
      const allowedTypes = [
        'locker_opened',
        'locker_overdue',
        'reservation_reminder',
        'system_maintenance',
        'security_alert',
        'account_security'
      ];

      // Validar preferências
      for (const [type, settings] of Object.entries(preferences)) {
        if (!allowedTypes.includes(type)) {
          return res.status(400).json({
            success: false,
            message: `Tipo de notificação inválido: ${type}`
          });
        }

        if (settings.channels) {
          const invalidChannels = settings.channels.filter(c => !allowedChannels.includes(c));
          if (invalidChannels.length > 0) {
            return res.status(400).json({
              success: false,
              message: `Canais inválidos: ${invalidChannels.join(', ')}`
            });
          }
        }
      }

      // Atualizar preferências
      const updatedPreferences = await notificationService.updateUserPreferences(userId, preferences);

      logger.info(`Notification preferences updated for user ${userId}`);

      res.json({
        success: true,
        message: 'Preferências de notificação atualizadas com sucesso',
        data: {
          preferences: updatedPreferences,
          updatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Update notification preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Enviar notificação broadcast (admin)
  async sendBroadcastNotification(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('send_broadcast')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        title,
        message,
        type = 'info',
        recipients = 'all', // all, department, userType, specific
        recipientFilter,
        channels = ['push'],
        priority = 'normal',
        expiresAt
      } = req.body;

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Título e mensagem são obrigatórios'
        });
      }

      const allowedTypes = ['info', 'warning', 'alert', 'maintenance', 'emergency'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Tipo inválido. Permitidos: ${allowedTypes.join(', ')}`
        });
      }

      const allowedRecipients = ['all', 'department', 'userType', 'specific'];
      if (!allowedRecipients.includes(recipients)) {
        return res.status(400).json({
          success: false,
          message: `Tipo de destinatário inválido. Permitidos: ${allowedRecipients.join(', ')}`
        });
      }

      // Rate limiting para broadcast
      const rateLimitKey = redis.generateKey(redis.config.keyPrefixes.rateLimiting, 'broadcast', req.user.userId);
      const rateLimit = await redis.rateLimiting.check(rateLimitKey, 10, 3600); // 10 por hora

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Limite de broadcasts excedido',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        });
      }

      // Enviar notificação broadcast
      const broadcastResult = await notificationService.sendBroadcastNotification({
        title,
        message,
        type,
        recipients,
        recipientFilter,
        channels,
        priority,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        sentBy: req.user.userId,
        metadata: {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip
        }
      });

      logger.info(`Broadcast notification sent by admin ${req.user.userId}: "${title}" to ${broadcastResult.recipientCount} users`);

      res.json({
        success: true,
        message: 'Notificação broadcast enviada com sucesso',
        data: {
          broadcastId: broadcastResult.broadcastId,
          recipientCount: broadcastResult.recipientCount,
          channels,
          sentAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Send broadcast notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter preferências de notificação do usuário
  async getNotificationPreferences(req, res) {
    try {
      const userId = req.user.userId;

      const preferences = await notificationService.getUserPreferences(userId);

      res.json({
        success: true,
        data: {
          preferences: preferences || notificationService.getDefaultPreferences(),
          userId
        }
      });

    } catch (error) {
      logger.error('Get notification preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Registrar token de push notification
  async registerPushToken(req, res) {
    try {
      const { token, platform, deviceInfo } = req.body;
      const userId = req.user.userId;

      if (!token || !platform) {
        return res.status(400).json({
          success: false,
          message: 'Token e plataforma são obrigatórios'
        });
      }

      const allowedPlatforms = ['android', 'ios', 'web'];
      if (!allowedPlatforms.includes(platform)) {
        return res.status(400).json({
          success: false,
          message: `Plataforma inválida. Permitidas: ${allowedPlatforms.join(', ')}`
        });
      }

      // Registrar token
      await notificationService.registerPushToken({
        userId,
        token,
        platform,
        deviceInfo: deviceInfo || {},
        registeredAt: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.debug(`Push token registered for user ${userId} on ${platform}`);

      res.json({
        success: true,
        message: 'Token de push notification registrado com sucesso'
      });

    } catch (error) {
      logger.error('Register push token error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Remover token de push notification
  async unregisterPushToken(req, res) {
    try {
      const { token } = req.body;
      const userId = req.user.userId;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token é obrigatório'
        });
      }

      // Remover token
      await notificationService.unregisterPushToken(userId, token);

      logger.debug(`Push token unregistered for user ${userId}`);

      res.json({
        success: true,
        message: 'Token de push notification removido com sucesso'
      });

    } catch (error) {
      logger.error('Unregister push token error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Testar envio de notificação
  async testNotification(req, res) {
    try {
      const { type = 'test', channels = ['push'] } = req.body;
      const userId = req.user.userId;

      const allowedChannels = ['push', 'email'];
      const invalidChannels = channels.filter(c => !allowedChannels.includes(c));
      
      if (invalidChannels.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Canais inválidos: ${invalidChannels.join(', ')}`
        });
      }

      // Rate limiting para testes
      const rateLimitKey = redis.generateKey(redis.config.keyPrefixes.rateLimiting, 'test_notification', userId);
      const rateLimit = await redis.rateLimiting.check(rateLimitKey, 5, 3600); // 5 por hora

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Limite de testes de notificação excedido'
        });
      }

      // Enviar notificação de teste
      const testResult = await notificationService.sendTestNotification({
        userId,
        type,
        channels,
        sentBy: userId,
        metadata: {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip
        }
      });

      logger.debug(`Test notification sent to user ${userId} via ${channels.join(', ')}`);

      res.json({
        success: true,
        message: 'Notificação de teste enviada',
        data: {
          channels,
          results: testResult.results,
          sentAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Test notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter estatísticas de notificações (admin)
  async getNotificationStats(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_notification_stats')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { 
        period = '30d',
        groupBy = 'day',
        type,
        channel 
      } = req.query;

      // Calcular período
      const periodMs = {
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000
      };

      const startDate = new Date(Date.now() - (periodMs[period] || periodMs['30d']));
      const endDate = new Date();

      const stats = await notificationService.getNotificationStats({
        startDate,
        endDate,
        groupBy,
        type,
        channel
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
          },
          generatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Get notification stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter templates de notificação (admin)
  async getNotificationTemplates(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_templates')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const templates = await notificationService.getNotificationTemplates();

      res.json({
        success: true,
        data: {
          templates
        }
      });

    } catch (error) {
      logger.error('Get notification templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Atualizar template de notificação (admin)
  async updateNotificationTemplate(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_templates')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { templateId } = req.params;
      const { title, body, channels, variables, isActive } = req.body;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          message: 'ID do template é obrigatório'
        });
      }

      const template = await notificationService.getTemplateById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template não encontrado'
        });
      }

      const updateData = {
        title: title || template.title,
        body: body || template.body,
        channels: channels || template.channels,
        variables: variables || template.variables,
        isActive: isActive !== undefined ? isActive : template.isActive,
        updatedBy: req.user.userId,
        updatedAt: new Date()
      };

      const updatedTemplate = await notificationService.updateTemplate(templateId, updateData);

      logger.info(`Notification template updated: ${templateId} by admin ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Template atualizado com sucesso',
        data: updatedTemplate
      });

    } catch (error) {
      logger.error('Update notification template error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter dispositivos registrados do usuário
  async getUserDevices(req, res) {
    try {
      const userId = req.user.userId;

      const devices = await notificationService.getUserDevices(userId);

      res.json({
        success: true,
        data: {
          devices,
          count: devices.length
        }
      });

    } catch (error) {
      logger.error('Get user devices error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Remover dispositivo
  async removeDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const userId = req.user.userId;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: 'ID do dispositivo é obrigatório'
        });
      }

      const device = await notificationService.getDeviceById(deviceId);
      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Dispositivo não encontrado'
        });
      }

      // Verificar se o dispositivo pertence ao usuário
      if (device.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para remover este dispositivo'
        });
      }

      // Remover dispositivo
      await notificationService.removeDevice(deviceId, userId);

      logger.debug(`Device removed: ${deviceId} by user ${userId}`);

      res.json({
        success: true,
        message: 'Dispositivo removido com sucesso'
      });

    } catch (error) {
      logger.error('Remove device error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter log de entrega de notificações (admin)
  async getDeliveryLogs(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_delivery_logs')) {
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
        channel,
        status,
        userId
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 200),
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate) : new Date(),
        channel, // push, email, sms
        status, // sent, delivered, failed, opened
        userId
      };

      const logs = await notificationService.getDeliveryLogs(filters);

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
          summary: logs.summary
        }
      });

    } catch (error) {
      logger.error('Get delivery logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = new NotificationController();