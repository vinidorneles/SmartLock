const userService = require('../services/userService');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const { validateEmail, validatePassword } = require('../utils/validators');

class UserController {
  // Obter perfil do usuário atual
  async getUserProfile(req, res) {
    try {
      const userId = req.user.userId;

      const user = await userService.getUserById(userId, {
        includeStats: true,
        includeRecentActivity: true
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Obter sessões ativas
      const activeSessions = await redis.session.getUserSessions(userId);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            userType: user.userType,
            department: user.department,
            studentId: user.studentId,
            isVerified: user.isVerified,
            isActive: user.isActive,
            permissions: user.permissions || [],
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            profilePicture: user.profilePicture
          },
          stats: user.stats,
          recentActivity: user.recentActivity,
          activeSessions: activeSessions.map(session => ({
            sessionId: session.sessionId,
            loginAt: session.loginAt,
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
            isCurrent: session.sessionId === req.sessionId
          }))
        }
      });

    } catch (error) {
      logger.error('Get user profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Atualizar perfil do usuário
  async updateUserProfile(req, res) {
    try {
      const userId = req.user.userId;
      const updateData = req.body;

      // Campos permitidos para atualização pelo próprio usuário
      const allowedFields = ['name', 'department', 'profilePicture', 'preferences'];
      
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

      // Validar nome se fornecido
      if (filteredData.name && filteredData.name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Nome deve ter pelo menos 2 caracteres'
        });
      }

      filteredData.updatedAt = new Date();

      const updatedUser = await userService.updateUser(userId, filteredData);

      logger.info(`User profile updated: ${userId}`);

      res.json({
        success: true,
        message: 'Perfil atualizado com sucesso',
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          department: updatedUser.department,
          profilePicture: updatedUser.profilePicture,
          updatedAt: updatedUser.updatedAt
        }
      });

    } catch (error) {
      logger.error('Update user profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Listar usuários (admin)
  async getUsers(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_users')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        search,
        userType,
        department,
        isActive,
        isVerified,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filters = {
        search,
        userType,
        department,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        sortBy,
        sortOrder
      };

      const users = await userService.getUsers(filters);

      res.json({
        success: true,
        data: {
          users: users.records,
          pagination: {
            page: users.page,
            limit: users.limit,
            total: users.total,
            pages: Math.ceil(users.total / users.limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter usuário por ID (admin)
  async getUserById(req, res) {
    try {
      const { userId: targetUserId } = req.params;
      const requestingUserId = req.user.userId;

      // Usuários podem ver seu próprio perfil, admins podem ver qualquer um
      const isAdmin = req.user.userType === 'admin';
      const isSelf = targetUserId === requestingUserId;

      if (!isAdmin && !isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'ID do usuário é obrigatório'
        });
      }

      const user = await userService.getUserById(targetUserId, {
        includeStats: isAdmin,
        includeRecentActivity: isAdmin,
        includePermissions: isAdmin
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Obter sessões ativas se for admin ou próprio usuário
      let activeSessions = [];
      if (isAdmin || isSelf) {
        activeSessions = await redis.session.getUserSessions(targetUserId);
      }

      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        department: user.department,
        studentId: user.studentId,
        isVerified: user.isVerified,
        isActive: user.isActive,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      };

      // Incluir dados administrativos se for admin
      if (isAdmin) {
        userData.permissions = user.permissions || [];
        userData.stats = user.stats;
        userData.recentActivity = user.recentActivity;
        userData.activeSessions = activeSessions;
      }

      res.json({
        success: true,
        data: userData
      });

    } catch (error) {
      logger.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Criar novo usuário (admin)
  async createUser(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('create_users')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const {
        name,
        email,
        password,
        userType,
        department,
        studentId,
        permissions,
        sendWelcomeEmail = true
      } = req.body;

      // Validações
      if (!name || !email || !password || !userType) {
        return res.status(400).json({
          success: false,
          message: 'Nome, email, senha e tipo de usuário são obrigatórios'
        });
      }

      if (!validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Email inválido'
        });
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          message: passwordValidation.message
        });
      }

      const allowedUserTypes = ['student', 'teacher', 'staff', 'admin'];
      if (!allowedUserTypes.includes(userType)) {
        return res.status(400).json({
          success: false,
          message: `Tipo de usuário inválido. Permitidos: ${allowedUserTypes.join(', ')}`
        });
      }

      // Verificar se usuário já existe
      const existingUser = await userService.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Usuário já cadastrado com este email'
        });
      }

      const userData = {
        name,
        email,
        password,
        userType,
        department,
        studentId,
        permissions: permissions || [],
        isVerified: true, // Admin cria usuários já verificados
        isActive: true,
        createdBy: req.user.userId
      };

      const user = await userService.createUser(userData);

      // Enviar email de boas-vindas se solicitado
      if (sendWelcomeEmail) {
        try {
          const emailService = require('../services/emailService');
          await emailService.sendWelcomeEmail(user);
        } catch (emailError) {
          logger.warn(`Welcome email failed for user ${user.id}:`, emailError.message);
        }
      }

      // Log da criação
      await userService.logAdminAction({
        userId: req.user.userId,
        action: 'create_user',
        targetType: 'user',
        targetId: user.id,
        details: { userType, department, permissions },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`User created by admin: ${user.email} (type: ${userType}) by ${req.user.userId}`);

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          userType: user.userType,
          department: user.department,
          studentId: user.studentId,
          permissions: user.permissions,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      logger.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Atualizar usuário (admin)
  async updateUser(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_users')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { userId: targetUserId } = req.params;
      const updateData = req.body;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'ID do usuário é obrigatório'
        });
      }

      const user = await userService.getUserById(targetUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Campos permitidos para atualização por admin
      const allowedFields = [
        'name', 'userType', 'department', 'studentId', 
        'permissions', 'isActive', 'isVerified'
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

      // Validações específicas
      if (filteredData.userType) {
        const allowedUserTypes = ['student', 'teacher', 'staff', 'admin'];
        if (!allowedUserTypes.includes(filteredData.userType)) {
          return res.status(400).json({
            success: false,
            message: `Tipo de usuário inválido. Permitidos: ${allowedUserTypes.join(', ')}`
          });
        }
      }

      filteredData.updatedBy = req.user.userId;
      filteredData.updatedAt = new Date();

      const updatedUser = await userService.updateUser(targetUserId, filteredData);

      // Se desativado, invalidar todas as sessões
      if (filteredData.isActive === false) {
        const userSessions = await redis.session.getUserSessions(targetUserId);
        for (const session of userSessions) {
          await redis.session.destroy(session.sessionId);
        }
      }

      // Log da ação administrativa
      await userService.logAdminAction({
        userId: req.user.userId,
        action: 'update_user',
        targetType: 'user',
        targetId: targetUserId,
        details: { oldData: user, newData: filteredData },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`User updated by admin: ${targetUserId} by ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          userType: updatedUser.userType,
          department: updatedUser.department,
          studentId: updatedUser.studentId,
          permissions: updatedUser.permissions,
          isActive: updatedUser.isActive,
          isVerified: updatedUser.isVerified,
          updatedAt: updatedUser.updatedAt
        }
      });

    } catch (error) {
      logger.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Deletar usuário (admin)
  async deleteUser(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('delete_users')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { userId: targetUserId } = req.params;
      const { force = false } = req.body;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'ID do usuário é obrigatório'
        });
      }

      // Não permitir auto-deleção
      if (targetUserId === req.user.userId) {
        return res.status(400).json({
          success: false,
          message: 'Você não pode deletar sua própria conta'
        });
      }

      const user = await userService.getUserById(targetUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Verificar se há transações ativas
      const activeTransactions = await userService.getUserActiveTransactions(targetUserId);
      if (activeTransactions.length > 0 && !force) {
        return res.status(409).json({
          success: false,
          message: `Usuário possui ${activeTransactions.length} transações ativas`,
          data: {
            activeTransactions,
            requiresForce: true
          }
        });
      }

      // Deletar usuário (soft delete por padrão)
      await userService.deleteUser(targetUserId, {
        deletedBy: req.user.userId,
        force,
        hardDelete: force
      });

      // Invalidar todas as sessões do usuário
      const userSessions = await redis.session.getUserSessions(targetUserId);
      for (const session of userSessions) {
        await redis.session.destroy(session.sessionId);
      }

      // Log da ação administrativa
      await userService.logAdminAction({
        userId: req.user.userId,
        action: 'delete_user',
        targetType: 'user',
        targetId: targetUserId,
        details: { 
          userName: user.name, 
          userEmail: user.email,
          activeTransactions: activeTransactions.length,
          forced: force 
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.warn(`User deleted by admin: ${targetUserId} (${user.email}) by ${req.user.userId} (force: ${force})`);

      res.json({
        success: true,
        message: 'Usuário deletado com sucesso',
        data: {
          deletedUserId: targetUserId,
          deletedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Resetar senha de usuário (admin)
  async resetUserPassword(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('reset_passwords')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { userId: targetUserId } = req.params;
      const { newPassword, sendEmail = true } = req.body;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'ID do usuário é obrigatório'
        });
      }

      const user = await userService.getUserById(targetUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      let finalPassword = newPassword;

      // Se não foi fornecida senha, gerar uma temporária
      if (!finalPassword) {
        finalPassword = userService.generateTemporaryPassword();
      } else {
        // Validar senha fornecida
        const passwordValidation = validatePassword(finalPassword);
        if (!passwordValidation.valid) {
          return res.status(400).json({
            success: false,
            message: passwordValidation.message
          });
        }
      }

      // Atualizar senha
      await userService.updatePassword(targetUserId, finalPassword);

      // Invalidar todas as sessões do usuário
      const userSessions = await redis.session.getUserSessions(targetUserId);
      for (const session of userSessions) {
        await redis.session.destroy(session.sessionId);
      }

      // Enviar email com nova senha se solicitado
      if (sendEmail) {
        try {
          const emailService = require('../services/emailService');
          await emailService.sendPasswordReset(user, {
            temporaryPassword: newPassword ? null : finalPassword,
            resetByAdmin: true,
            adminName: req.user.name
          });
        } catch (emailError) {
          logger.warn(`Password reset email failed for user ${targetUserId}:`, emailError.message);
        }
      }

      // Log da ação
      await userService.logAdminAction({
        userId: req.user.userId,
        action: 'reset_password',
        targetType: 'user',
        targetId: targetUserId,
        details: { 
          temporaryPassword: !newPassword,
          emailSent: sendEmail 
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`Password reset by admin for user ${targetUserId} by ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Senha resetada com sucesso',
        data: {
          userId: targetUserId,
          temporaryPassword: newPassword ? null : finalPassword,
          emailSent: sendEmail,
          resetAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Reset user password error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter estatísticas do usuário
  async getUserStats(req, res) {
    try {
      const { userId: targetUserId } = req.params;
      const requestingUserId = req.user.userId;
      const { period = '30d' } = req.query;

      // Usuários podem ver suas próprias stats, admins podem ver de qualquer um
      const isAdmin = req.user.userType === 'admin';
      const isSelf = targetUserId === requestingUserId;

      if (!isAdmin && !isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'ID do usuário é obrigatório'
        });
      }

      // Calcular período
      const periodMs = {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000,
        '1y': 365 * 24 * 60 * 60 * 1000
      };

      const startDate = new Date(Date.now() - (periodMs[period] || periodMs['30d']));
      const endDate = new Date();

      const stats = await userService.getUserStats(targetUserId, {
        startDate,
        endDate,
        includeComparison: isAdmin
      });

      res.json({
        success: true,
        data: {
          userId: targetUserId,
          stats,
          period: {
            startDate,
            endDate,
            period
          }
        }
      });

    } catch (error) {
      logger.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter histórico de atividades do usuário
  async getUserActivity(req, res) {
    try {
      const { userId: targetUserId } = req.params;
      const requestingUserId = req.user.userId;
      const { 
        page = 1, 
        limit = 20, 
        startDate, 
        endDate, 
        action,
        includeDetails = false 
      } = req.query;

      // Usuários podem ver seu próprio histórico, admins podem ver de qualquer um
      const isAdmin = req.user.userType === 'admin';
      const isSelf = targetUserId === requestingUserId;

      if (!isAdmin && !isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'ID do usuário é obrigatório'
        });
      }

      const filters = {
        userId: targetUserId,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        action,
        includeDetails: (includeDetails === 'true') && isAdmin
      };

      const activity = await userService.getUserActivity(filters);

      res.json({
        success: true,
        data: {
          activity: activity.records,
          pagination: {
            page: activity.page,
            limit: activity.limit,
            total: activity.total,
            pages: Math.ceil(activity.total / activity.limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get user activity error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Alterar permissões do usuário (admin)
  async updateUserPermissions(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('manage_permissions')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { userId: targetUserId } = req.params;
      const { permissions, action = 'set' } = req.body; // set, add, remove

      if (!targetUserId || !permissions) {
        return res.status(400).json({
          success: false,
          message: 'ID do usuário e permissões são obrigatórios'
        });
      }

      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          message: 'Permissões devem ser um array'
        });
      }

      const user = await userService.getUserById(targetUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      const allowedActions = ['set', 'add', 'remove'];
      if (!allowedActions.includes(action)) {
        return res.status(400).json({
          success: false,
          message: `Ação inválida. Permitidas: ${allowedActions.join(', ')}`
        });
      }

      // Validar permissões
      const validPermissions = await userService.getValidPermissions();
      const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
      
      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Permissões inválidas: ${invalidPermissions.join(', ')}`,
          data: { validPermissions }
        });
      }

      // Atualizar permissões
      const updatedUser = await userService.updateUserPermissions(targetUserId, permissions, action);

      // Log da ação
      await userService.logAdminAction({
        userId: req.user.userId,
        action: 'update_permissions',
        targetType: 'user',
        targetId: targetUserId,
        details: { 
          action,
          permissions,
          oldPermissions: user.permissions 
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`User permissions updated: ${targetUserId} by admin ${req.user.userId} (${action})`);

      res.json({
        success: true,
        message: 'Permissões atualizadas com sucesso',
        data: {
          userId: targetUserId,
          permissions: updatedUser.permissions,
          action,
          updatedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Update user permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter transações ativas do usuário
  async getUserActiveTransactions(req, res) {
    try {
      const { userId: targetUserId } = req.params;
      const requestingUserId = req.user.userId;

      // Usuários podem ver suas próprias transações, admins podem ver de qualquer um
      const isAdmin = req.user.userType === 'admin';
      const isSelf = targetUserId === requestingUserId;

      if (!isAdmin && !isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const activeTransactions = await userService.getUserActiveTransactions(targetUserId);

      // Enriquecer com dados de status em tempo real
      for (const transaction of activeTransactions) {
        const realtimeStatus = await redis.lockStatus.get(transaction.lockerId);
        transaction.realtimeStatus = realtimeStatus;
      }

      res.json({
        success: true,
        data: {
          userId: targetUserId,
          activeTransactions,
          count: activeTransactions.length
        }
      });

    } catch (error) {
      logger.error('Get user active transactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Forçar logout de todas as sessões do usuário
  async forceLogoutUser(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('force_logout')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { userId: targetUserId } = req.params;
      const { reason } = req.body;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: 'ID do usuário é obrigatório'
        });
      }

      const user = await userService.getUserById(targetUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Obter sessões ativas
      const userSessions = await redis.session.getUserSessions(targetUserId);

      // Invalidar todas as sessões
      for (const session of userSessions) {
        await redis.session.destroy(session.sessionId);
      }

      // Log da ação
      await userService.logAdminAction({
        userId: req.user.userId,
        action: 'force_logout',
        targetType: 'user',
        targetId: targetUserId,
        details: { 
          reason,
          sessionsTerminated: userSessions.length 
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.warn(`Force logout for user ${targetUserId} by admin ${req.user.userId}: ${reason}`);

      res.json({
        success: true,
        message: 'Logout forçado realizado com sucesso',
        data: {
          userId: targetUserId,
          sessionsTerminated: userSessions.length,
          reason,
          executedAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Force logout user error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Pesquisar usuários
  async searchUsers(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_users')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { 
        query, 
        userType, 
        department,
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
        userType,
        department,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50),
        isActive: true // Buscar apenas usuários ativos por padrão
      };

      const results = await userService.searchUsers(searchFilters);

      res.json({
        success: true,
        data: {
          users: results.records,
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
      logger.error('Search users error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter usuários por departamento
  async getUsersByDepartment(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('view_users')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { department } = req.params;
      const { includeStats = false } = req.query;

      if (!department) {
        return res.status(400).json({
          success: false,
          message: 'Departamento é obrigatório'
        });
      }

      const users = await userService.getUsersByDepartment(department, {
        includeStats: includeStats === 'true'
      });

      res.json({
        success: true,
        data: {
          department,
          users,
          count: users.length
        }
      });

    } catch (error) {
      logger.error('Get users by department error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Exportar dados dos usuários (admin)
  async exportUsers(req, res) {
    try {
      if (req.user.userType !== 'admin' && !req.user.permissions?.includes('export_data')) {
        return res.status(403).json({
          success: false,
          message: 'Permissão insuficiente'
        });
      }

      const { 
        format = 'csv', // csv, json, xlsx
        includeStats = false,
        department,
        userType,
        startDate,
        endDate
      } = req.query;

      const allowedFormats = ['csv', 'json', 'xlsx'];
      if (!allowedFormats.includes(format)) {
        return res.status(400).json({
          success: false,
          message: `Formato inválido. Permitidos: ${allowedFormats.join(', ')}`
        });
      }

      const filters = {
        department,
        userType,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        includeStats: includeStats === 'true',
        isActive: true
      };

      const exportData = await userService.exportUsers(filters, format);

      // Log da exportação
      await userService.logAdminAction({
        userId: req.user.userId,
        action: 'export_users',
        targetType: 'system',
        details: { format, filters, recordCount: exportData.recordCount },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`Users exported by admin ${req.user.userId}: ${exportData.recordCount} records in ${format} format`);

      // Configurar headers baseado no formato
      const contentTypes = {
        csv: 'text/csv',
        json: 'application/json',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      const filename = `users_export_${new Date().toISOString().split('T')[0]}.${format}`;

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
      logger.error('Export users error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = new UserController();/* id: user.id, */
      /*   name: user.name,
        email: user.email,
        userType: user.userType,
        department: user.department,
        studentId: user.studentId,
        isVerified: user.isVerified, */