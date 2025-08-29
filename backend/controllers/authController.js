const bcrypt = require('bcryptjs');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const jwt = require('../config/jwt');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const { validateEmail, validatePassword } = require('../utils/validators');

class AuthController {
  // Registro de novo usuário
  async register(req, res) {
    try {
      const { name, email, password, userType, studentId, department } = req.body;

      // Validações
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Nome, email e senha são obrigatórios'
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

      // Verificar se usuário já existe
      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Usuário já cadastrado com este email'
        });
      }

      // Criar usuário
      const userData = {
        name,
        email,
        password,
        userType: userType || 'student',
        studentId,
        department,
        isVerified: false,
        createdAt: new Date()
      };

      const user = await authService.createUser(userData);

      // Gerar token de verificação de email
      const emailToken = jwt.generateEmailVerificationToken(user.id, email);

      // Enviar email de verificação
      await emailService.sendEmailVerification(user, emailToken);

      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso. Verifique seu email para ativar a conta.',
        data: {
          userId: user.id,
          name: user.name,
          email: user.email,
          userType: user.userType
        }
      });

    } catch (error) {
      logger.error('Register error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Login do usuário
  async login(req, res) {
    try {
      const { email, password, rememberMe } = req.body;

      // Validações básicas
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email e senha são obrigatórios'
        });
      }

      // Rate limiting
      const rateLimitKey = redis.generateKey(redis.config.keyPrefixes.rateLimiting, 'login', req.ip);
      const rateLimit = await redis.rateLimiting.check(rateLimitKey, 5, 900); // 5 tentativas em 15min

      if (!rateLimit.allowed) {
        logger.warn(`Login rate limit exceeded for IP: ${req.ip}`);
        return res.status(429).json({
          success: false,
          message: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        });
      }

      // Buscar usuário
      const user = await authService.findUserByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email ou senha incorretos'
        });
      }

      // Verificar senha
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Email ou senha incorretos'
        });
      }

      // Verificar se o email foi verificado
      if (!user.isVerified) {
        return res.status(401).json({
          success: false,
          message: 'Email não verificado. Verifique sua caixa de entrada.',
          requiresVerification: true
        });
      }

      // Verificar se a conta está ativa
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Conta desativada. Entre em contato com o administrador.'
        });
      }

      // Gerar tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        permissions: user.permissions || []
      };

      const tokens = jwt.generateTokenPair(tokenPayload);

      // Criar sessão
      const sessionId = `session_${user.id}_${Date.now()}`;
      const sessionData = {
        userId: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        loginAt: new Date(),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      };

      const sessionTTL = rememberMe ? 604800 : 3600; // 7 dias ou 1 hora
      await redis.session.create(sessionId, sessionData, sessionTTL);

      // Atualizar último login
      await authService.updateLastLogin(user.id, req.ip, req.headers['user-agent']);

      logger.info(`User logged in: ${email}`);

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            userType: user.userType,
            department: user.department,
            studentId: user.studentId,
            permissions: user.permissions || []
          },
          tokens,
          sessionId
        }
      });

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Logout
  async logout(req, res) {
    try {
      const { sessionId } = req.body;
      const authHeader = req.headers.authorization;

      // Destruir sessão se fornecida
      if (sessionId) {
        await redis.session.destroy(sessionId);
      }

      // Adicionar token à blacklist se fornecido
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.decodeToken(token);
          if (decoded && decoded.payload.exp) {
            const blacklistKey = redis.generateKey('blacklist', 'token', decoded.payload.jti || token.substring(0, 20));
            const ttl = decoded.payload.exp - Math.floor(Date.now() / 1000);
            
            if (ttl > 0) {
              await redis.cache.set(blacklistKey, true, ttl);
            }
          }
        } catch (error) {
          logger.warn('Token blacklist error:', error);
        }
      }

      logger.info(`User logged out: ${req.user?.email || 'unknown'}`);

      res.json({
        success: true,
        message: 'Logout realizado com sucesso'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token é obrigatório'
        });
      }

      // Verificar refresh token
      const decoded = jwt.verifyRefreshToken(refreshToken);
      
      // Buscar usuário
      const user = await authService.findUserById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Usuário inválido ou inativo'
        });
      }

      // Gerar novo access token
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        permissions: user.permissions || []
      };

      const accessToken = jwt.generateAccessToken(tokenPayload);

      res.json({
        success: true,
        data: {
          accessToken,
          expiresIn: jwt.config.accessTokenExpiry
        }
      });

    } catch (error) {
      logger.error('Refresh token error:', error);
      
      if (error.message.includes('Token') || error.message.includes('token')) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token inválido ou expirado'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Verificar email
  async verifyEmail(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token de verificação é obrigatório'
        });
      }

      // Verificar token
      const decoded = jwt.verifyEmailToken(token);

      // Buscar usuário
      const user = await authService.findUserById(decoded.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email já verificado'
        });
      }

      // Verificar email
      await authService.verifyUserEmail(user.id);

      // Enviar email de boas-vindas
      await emailService.sendWelcomeEmail(user);

      logger.info(`Email verified for user: ${user.email}`);

      res.json({
        success: true,
        message: 'Email verificado com sucesso!'
      });

    } catch (error) {
      logger.error('Email verification error:', error);
      
      if (error.message.includes('Token') || error.message.includes('token')) {
        return res.status(400).json({
          success: false,
          message: 'Token de verificação inválido ou expirado'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Reenviar email de verificação
  async resendVerification(req, res) {
    try {
      const { email } = req.body;

      if (!email || !validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Email válido é obrigatório'
        });
      }

      // Rate limiting
      const rateLimitKey = redis.generateKey(redis.config.keyPrefixes.rateLimiting, 'resend_verification', email);
      const rateLimit = await redis.rateLimiting.check(rateLimitKey, 3, 3600); // 3 vezes por hora

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Muitas tentativas. Tente novamente mais tarde.'
        });
      }

      // Buscar usuário
      const user = await authService.findUserByEmail(email);
      if (!user) {
        // Por segurança, não revelamos se o email existe
        return res.json({
          success: true,
          message: 'Se o email existir, um novo link de verificação será enviado.'
        });
      }

      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email já verificado'
        });
      }

      // Gerar novo token
      const emailToken = jwt.generateEmailVerificationToken(user.id, user.email);

      // Enviar email
      await emailService.sendEmailVerification(user, emailToken);

      res.json({
        success: true,
        message: 'Link de verificação reenviado com sucesso'
      });

    } catch (error) {
      logger.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Solicitar reset de senha
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email || !validateEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Email válido é obrigatório'
        });
      }

      // Rate limiting
      const rateLimitKey = redis.generateKey(redis.config.keyPrefixes.rateLimiting, 'forgot_password', email);
      const rateLimit = await redis.rateLimiting.check(rateLimitKey, 3, 3600); // 3 vezes por hora

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Muitas tentativas. Tente novamente mais tarde.'
        });
      }

      // Buscar usuário
      const user = await authService.findUserByEmail(email);
      if (!user) {
        // Por segurança, não revelamos se o email existe
        return res.json({
          success: true,
          message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.'
        });
      }

      // Gerar token de reset
      const resetToken = jwt.generatePasswordResetToken(user.id, user.email);

      // Salvar token no banco (opcional, para controle adicional)
      await authService.savePasswordResetToken(user.id, resetToken);

      // Enviar email
      await emailService.sendPasswordReset(user, resetToken);

      logger.info(`Password reset requested for: ${email}`);

      res.json({
        success: true,
        message: 'Instruções para redefinir sua senha foram enviadas para seu email.'
      });

    } catch (error) {
      logger.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Reset de senha
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({
          success: false,
          message: 'Token e nova senha são obrigatórios'
        });
      }

      // Validar senha
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          message: passwordValidation.message
        });
      }

      // Verificar token
      const decoded = jwt.verifyPasswordResetToken(token);

      // Buscar usuário
      const user = await authService.findUserById(decoded.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Verificar se o token ainda é válido no banco (opcional)
      const isValidToken = await authService.validatePasswordResetToken(user.id, token);
      if (!isValidToken) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido ou já utilizado'
        });
      }

      // Atualizar senha
      await authService.updatePassword(user.id, password);

      // Invalidar token
      await authService.invalidatePasswordResetToken(user.id, token);

      // Invalidar todas as sessões do usuário
      const userSessions = await redis.session.getUserSessions(user.id);
      for (const session of userSessions) {
        await redis.session.destroy(session.sessionId);
      }

      logger.info(`Password reset successful for: ${user.email}`);

      res.json({
        success: true,
        message: 'Senha redefinida com sucesso. Faça login com sua nova senha.'
      });

    } catch (error) {
      logger.error('Reset password error:', error);
      
      if (error.message.includes('Token') || error.message.includes('token')) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido ou expirado'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Verificar status da autenticação
  async me(req, res) {
    try {
      // req.user é preenchido pelo middleware de auth
      const user = req.user;

      // Buscar dados atualizados do usuário
      const currentUser = await authService.findUserById(user.userId);
      
      if (!currentUser || !currentUser.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Usuário inativo ou não encontrado'
        });
      }

      res.json({
        success: true,
        data: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          userType: currentUser.userType,
          department: currentUser.department,
          studentId: currentUser.studentId,
          permissions: currentUser.permissions || [],
          isVerified: currentUser.isVerified,
          lastLogin: currentUser.lastLogin,
          createdAt: currentUser.createdAt
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

  // Alterar senha
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Senha atual e nova senha são obrigatórias'
        });
      }

      // Validar nova senha
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          message: passwordValidation.message
        });
      }

      // Buscar usuário
      const user = await authService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Verificar senha atual
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Senha atual incorreta'
        });
      }

      // Atualizar senha
      await authService.updatePassword(userId, newPassword);

      logger.info(`Password changed for user: ${user.email}`);

      res.json({
        success: true,
        message: 'Senha alterada com sucesso'
      });

    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = new AuthController();