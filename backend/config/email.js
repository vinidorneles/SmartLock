const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Configurações de email
const emailConfig = {
  // Configurações SMTP
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outras portas
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    
    // Configurações avançadas
    pool: true, // usar pool de conexões
    maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS) || 5,
    maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES) || 100,
    rateDelta: parseInt(process.env.SMTP_RATE_DELTA) || 1000, // ms
    rateLimit: parseInt(process.env.SMTP_RATE_LIMIT) || 5, // emails por rateDelta
    
    // Timeouts
    connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT) || 60000,
    greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT) || 30000,
    socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT) || 60000,
    
    // TLS options
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2'
    }
  },
  
  // Configurações de remetente
  from: {
    name: process.env.EMAIL_FROM_NAME || 'Smart Lock System',
    address: process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'noreply@smartlock.university.edu'
  },
  
  // Configurações de templates
  templates: {
    baseUrl: process.env.BASE_URL || 'https://smartlock.university.edu',
    logoUrl: process.env.EMAIL_LOGO_URL || 'https://smartlock.university.edu/logo.png',
    
    // Cores do tema
    colors: {
      primary: '#007bff',
      secondary: '#6c757d',
      success: '#28a745',
      danger: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8'
    },
    
    // Configurações de estilo
    styles: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.6',
      backgroundColor: '#f8f9fa',
      contentBackgroundColor: '#ffffff'
    }
  },
  
  // Tipos de email
  emailTypes: {
    WELCOME: 'welcome',
    EMAIL_VERIFICATION: 'email_verification',
    PASSWORD_RESET: 'password_reset',
    LOCKER_OPENED: 'locker_opened',
    LOCKER_OVERDUE: 'locker_overdue',
    MAINTENANCE_ALERT: 'maintenance_alert',
    SYSTEM_NOTIFICATION: 'system_notification',
    SECURITY_ALERT: 'security_alert'
  },
  
  // Configurações de retry
  retry: {
    attempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS) || 3,
    delay: parseInt(process.env.EMAIL_RETRY_DELAY) || 5000, // ms
    exponentialBackoff: process.env.EMAIL_EXPONENTIAL_BACKOFF === 'true'
  },
  
  // Configurações de rate limiting
  rateLimiting: {
    enabled: process.env.EMAIL_RATE_LIMITING_ENABLED === 'true',
    maxEmailsPerHour: parseInt(process.env.EMAIL_MAX_PER_HOUR) || 100,
    maxEmailsPerDay: parseInt(process.env.EMAIL_MAX_PER_DAY) || 1000
  },
  
  // Configurações de queue (se usando redis)
  queue: {
    enabled: process.env.EMAIL_QUEUE_ENABLED === 'true',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    queueName: 'email_queue',
    jobOptions: {
      removeOnComplete: 50,
      removeOnFail: 100,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    }
  }
};

// Validar configurações essenciais
const validateConfig = () => {
  const errors = [];
  
  if (!emailConfig.smtp.auth.user) {
    errors.push('SMTP_USER não configurado');
  }
  
  if (!emailConfig.smtp.auth.pass) {
    errors.push('SMTP_PASS não configurado');
  }
  
  if (!emailConfig.from.address) {
    errors.push('EMAIL_FROM_ADDRESS não configurado');
  }
  
  if (errors.length > 0) {
    logger.error('Erros na configuração de email:', errors);
    throw new Error(`Configuração de email inválida: ${errors.join(', ')}`);
  }
  
  logger.info('Configuração de email validada com sucesso');
};

// Criar transporter
let transporter = null;

const createTransporter = () => {
  try {
    transporter = nodemailer.createTransporter(emailConfig.smtp);
    
    // Configurar eventos
    transporter.on('idle', () => {
      logger.debug('SMTP transporter is idle');
    });
    
    transporter.on('error', (error) => {
      logger.error('SMTP transporter error:', error);
    });
    
    logger.info('Email transporter created successfully');
    return transporter;
  } catch (error) {
    logger.error('Failed to create email transporter:', error);
    throw error;
  }
};

// Testar conexão SMTP
const testConnection = async () => {
  try {
    if (!transporter) {
      createTransporter();
    }
    
    await transporter.verify();
    logger.info('SMTP connection test successful');
    return true;
  } catch (error) {
    logger.error('SMTP connection test failed:', error);
    return false;
  }
};

// Template base HTML
const getBaseTemplate = (title, content) => {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: ${emailConfig.templates.styles.fontFamily};
            font-size: ${emailConfig.templates.styles.fontSize};
            line-height: ${emailConfig.templates.styles.lineHeight};
            background-color: ${emailConfig.templates.styles.backgroundColor};
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: ${emailConfig.templates.styles.contentBackgroundColor};
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background-color: ${emailConfig.templates.colors.primary};
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 30px 20px;
        }
        .button {
            display: inline-block;
            background-color: ${emailConfig.templates.colors.primary};
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
            font-weight: bold;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
            border-top: 1px solid #dee2e6;
        }
        .alert {
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
        .alert-info {
            background-color: #d1ecf1;
            border: 1px solid #b8daff;
            color: #0c5460;
        }
        .alert-warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
        }
        .alert-danger {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Smart Lock System</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>Este é um email automático do Sistema Smart Lock.</p>
            <p>Se você não solicitou esta ação, entre em contato com o suporte.</p>
            <p>&copy; 2025 Smart Lock System. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>`;
};

// Templates específicos
const templates = {
  welcome: (userData) => ({
    subject: 'Bem-vindo ao Smart Lock System!',
    html: getBaseTemplate('Bem-vindo!', `
      <h2>Olá, ${userData.name}!</h2>
      <p>Bem-vindo ao Smart Lock System! Sua conta foi criada com sucesso.</p>
      <div class="alert alert-info">
        <strong>Email:</strong> ${userData.email}<br>
        <strong>Tipo de conta:</strong> ${userData.userType || 'Usuário'}
      </div>
      <p>Agora você pode usar o aplicativo móvel para acessar os armários inteligentes em todo o campus.</p>
      <a href="${emailConfig.templates.baseUrl}/download" class="button">Baixar App</a>
      <p>Se você tiver alguma dúvida, não hesite em entrar em contato conosco.</p>
    `)
  }),

  emailVerification: (userData, token) => ({
    subject: 'Verificação de Email - Smart Lock System',
    html: getBaseTemplate('Verificar Email', `
      <h2>Verificação de Email</h2>
      <p>Olá, ${userData.name}!</p>
      <p>Para completar seu cadastro no Smart Lock System, você precisa verificar seu endereço de email.</p>
      <p>Clique no botão abaixo para verificar sua conta:</p>
      <a href="${emailConfig.templates.baseUrl}/verify-email?token=${token}" class="button">Verificar Email</a>
      <div class="alert alert-warning">
        <strong>Atenção:</strong> Este link expira em 24 horas.
      </div>
      <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
      <p style="word-break: break-all;">${emailConfig.templates.baseUrl}/verify-email?token=${token}</p>
    `)
  }),

  passwordReset: (userData, token) => ({
    subject: 'Redefinir Senha - Smart Lock System',
    html: getBaseTemplate('Redefinir Senha', `
      <h2>Redefinição de Senha</h2>
      <p>Olá, ${userData.name}!</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
      <p>Clique no botão abaixo para criar uma nova senha:</p>
      <a href="${emailConfig.templates.baseUrl}/reset-password?token=${token}" class="button">Redefinir Senha</a>
      <div class="alert alert-warning">
        <strong>Importante:</strong> Este link expira em 1 hora por motivos de segurança.
      </div>
      <p>Se você não solicitou a redefinição de senha, ignore este email. Sua senha permanecerá inalterada.</p>
      <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
      <p style="word-break: break-all;">${emailConfig.templates.baseUrl}/reset-password?token=${token}</p>
    `)
  }),

  lockerOpened: (userData, lockerData) => ({
    subject: 'Armário Aberto - Smart Lock System',
    html: getBaseTemplate('Armário Aberto', `
      <h2>Armário Aberto com Sucesso</h2>
      <p>Olá, ${userData.name}!</p>
      <p>O armário foi aberto com sucesso através do seu dispositivo móvel.</p>
      <div class="alert alert-info">
        <strong>Armário:</strong> ${lockerData.cabinetName} - Compartimento ${lockerData.lockerNumber}<br>
        <strong>Data/Hora:</strong> ${new Date(lockerData.timestamp).toLocaleString('pt-BR')}<br>
        <strong>Localização:</strong> ${lockerData.location}
      </div>
      <p>Lembre-se de fechar o armário após retirar seus pertences.</p>
    `)
  }),

  lockerOverdue: (userData, lockerData) => ({
    subject: 'Armário em Atraso - Smart Lock System',
    html: getBaseTemplate('Armário em Atraso', `
      <h2>Armário em Uso Prolongado</h2>
      <p>Olá, ${userData.name}!</p>
      <div class="alert alert-warning">
        <strong>Atenção:</strong> Você tem um armário aberto há mais tempo que o permitido.
      </div>
      <div class="alert alert-info">
        <strong>Armário:</strong> ${lockerData.cabinetName} - Compartimento ${lockerData.lockerNumber}<br>
        <strong>Aberto desde:</strong> ${new Date(lockerData.openedAt).toLocaleString('pt-BR')}<br>
        <strong>Tempo limite:</strong> ${lockerData.maxDuration} minutos<br>
        <strong>Localização:</strong> ${lockerData.location}
      </div>
      <p>Por favor, retire seus pertences e feche o armário o quanto antes.</p>
      <p>Caso tenha esquecido algo importante no armário, entre em contato com o suporte.</p>
    `)
  }),

  maintenanceAlert: (adminData, alertData) => ({
    subject: 'Alerta de Manutenção - Smart Lock System',
    html: getBaseTemplate('Alerta de Manutenção', `
      <h2>Alerta de Manutenção</h2>
      <p>Olá, ${adminData.name}!</p>
      <div class="alert alert-danger">
        <strong>Alerta:</strong> ${alertData.message}
      </div>
      <div class="alert alert-info">
        <strong>Equipamento:</strong> ${alertData.cabinetName} - ${alertData.hardwareType}<br>
        <strong>Tipo do Alerta:</strong> ${alertData.alertType}<br>
        <strong>Detectado em:</strong> ${new Date(alertData.timestamp).toLocaleString('pt-BR')}<br>
        <strong>Status Atual:</strong> ${alertData.status}
      </div>
      <p>Ação imediata pode ser necessária para resolver este problema.</p>
      <a href="${emailConfig.templates.baseUrl}/admin/maintenance" class="button">Acessar Painel</a>
    `)
  }),

  securityAlert: (adminData, alertData) => ({
    subject: 'Alerta de Segurança - Smart Lock System',
    html: getBaseTemplate('Alerta de Segurança', `
      <h2>Alerta de Segurança</h2>
      <p>Olá, ${adminData.name}!</p>
      <div class="alert alert-danger">
        <strong>Alerta de Segurança:</strong> ${alertData.message}
      </div>
      <div class="alert alert-info">
        <strong>Tipo:</strong> ${alertData.alertType}<br>
        <strong>Origem:</strong> ${alertData.source}<br>
        <strong>IP:</strong> ${alertData.ipAddress}<br>
        <strong>Detectado em:</strong> ${new Date(alertData.timestamp).toLocaleString('pt-BR')}
      </div>
      <p>Este alerta requer atenção imediata da equipe de segurança.</p>
      <a href="${emailConfig.templates.baseUrl}/admin/security" class="button">Investigar</a>
    `)
  })
};

// Função para obter template
const getTemplate = (type, data) => {
  const templateFunction = templates[type];
  if (!templateFunction) {
    throw new Error(`Template não encontrado: ${type}`);
  }
  return templateFunction(data);
};

// Inicializar configurações
try {
  validateConfig();
  createTransporter();
  logger.info('Email configuration loaded successfully');
} catch (error) {
  logger.error('Failed to load email configuration:', error);
}

module.exports = {
  config: emailConfig,
  transporter,
  validateConfig,
  createTransporter,
  testConnection,
  getTemplate,
  templates
};