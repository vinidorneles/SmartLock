// ===== CONFIGURAÇÕES DO SISTEMA =====
const SYSTEM_CONFIG = {
  APP_NAME: 'Smart Lock System',
  VERSION: '1.0.0',
  DEFAULT_TIMEZONE: 'America/Sao_Paulo',
  DEFAULT_LOCALE: 'pt-BR',
  COMPANY: 'Universidade',
  SUPPORT_EMAIL: 'suporte@smartlock.universidade.edu.br'
};

// ===== CONFIGURAÇÕES DE AUTENTICAÇÃO =====
const AUTH_CONFIG = {
  JWT_EXPIRES_IN: '8h',
  JWT_REFRESH_EXPIRES_IN: '7d',
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutos em ms
  SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 horas em ms
  REMEMBER_ME_DURATION: 30 * 24 * 60 * 60 * 1000 // 30 dias em ms
};

// ===== TIPOS DE USUÁRIO =====
const USER_TYPES = {
  STUDENT: 'student',
  PROFESSOR: 'professor',
  STAFF: 'staff',
  ADMIN: 'admin'
};

const USER_TYPE_LABELS = {
  [USER_TYPES.STUDENT]: 'Estudante',
  [USER_TYPES.PROFESSOR]: 'Professor',
  [USER_TYPES.STAFF]: 'Funcionário',
  [USER_TYPES.ADMIN]: 'Administrador'
};

const USER_PERMISSIONS = {
  [USER_TYPES.STUDENT]: ['borrow', 'return', 'view_history'],
  [USER_TYPES.PROFESSOR]: ['borrow', 'return', 'view_history', 'extend_deadline'],
  [USER_TYPES.STAFF]: ['borrow', 'return', 'view_history', 'extend_deadline', 'view_reports'],
  [USER_TYPES.ADMIN]: ['*'] // Todas as permissões
};

// ===== STATUS DE TRANSAÇÃO =====
const TRANSACTION_STATUS = {
  ACTIVE: 'active',
  RETURNED: 'returned',
  OVERDUE: 'overdue',
  MAINTENANCE: 'maintenance',
  CANCELLED: 'cancelled'
};

const TRANSACTION_STATUS_LABELS = {
  [TRANSACTION_STATUS.ACTIVE]: 'Ativo',
  [TRANSACTION_STATUS.RETURNED]: 'Devolvido',
  [TRANSACTION_STATUS.OVERDUE]: 'Em Atraso',
  [TRANSACTION_STATUS.MAINTENANCE]: 'Manutenção',
  [TRANSACTION_STATUS.CANCELLED]: 'Cancelado'
};

// ===== TIPOS DE QR CODE =====
const QR_CODE_TYPES = {
  ACCESS: 'access',
  RETURN: 'return',
  MAINTENANCE: 'maintenance'
};

const QR_CODE_PATTERNS = {
  [QR_CODE_TYPES.ACCESS]: /^CABINET_([A-Z0-9]+)_ACCESS$/,
  [QR_CODE_TYPES.RETURN]: /^RETURN_([A-Z0-9]+)_(\d{2})$/,
  [QR_CODE_TYPES.MAINTENANCE]: /^MAINTENANCE_([A-Z0-9]+)$/
};

// ===== CONFIGURAÇÕES DE HARDWARE =====
const HARDWARE_CONFIG = {
  DEFAULT_UNLOCK_DURATION: 30, // segundos
  MAX_UNLOCK_DURATION: 300,    // 5 minutos
  MIN_UNLOCK_DURATION: 10,     // 10 segundos
  CONNECTION_TIMEOUT: 5000,    // 5 segundos
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,           // 1 segundo
  HEARTBEAT_INTERVAL: 30000,   // 30 segundos
  MAX_LOCKERS_PER_CABINET: 99
};

// ===== STATUS DO LOCKER =====
const LOCKER_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  OUT_OF_ORDER: 'out_of_order',
  RESERVED: 'reserved'
};

const LOCKER_STATUS_LABELS = {
  [LOCKER_STATUS.AVAILABLE]: 'Disponível',
  [LOCKER_STATUS.OCCUPIED]: 'Ocupado',
  [LOCKER_STATUS.MAINTENANCE]: 'Em Manutenção',
  [LOCKER_STATUS.OUT_OF_ORDER]: 'Fora de Serviço',
  [LOCKER_STATUS.RESERVED]: 'Reservado'
};

// ===== STATUS DO ARMÁRIO =====
const CABINET_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
  OFFLINE: 'offline'
};

const CABINET_STATUS_LABELS = {
  [CABINET_STATUS.ACTIVE]: 'Ativo',
  [CABINET_STATUS.INACTIVE]: 'Inativo',
  [CABINET_STATUS.MAINTENANCE]: 'Em Manutenção',
  [CABINET_STATUS.OFFLINE]: 'Offline'
};

// ===== TIPOS DE EQUIPAMENTO =====
const EQUIPMENT_TYPES = {
  LAPTOP: 'laptop',
  TABLET: 'tablet',
  CHARGER: 'charger',
  MOUSE: 'mouse',
  KEYBOARD: 'keyboard',
  HEADPHONES: 'headphones',
  CALCULATOR: 'calculator',
  OTHER: 'other'
};

const EQUIPMENT_TYPE_LABELS = {
  [EQUIPMENT_TYPES.LAPTOP]: 'Notebook',
  [EQUIPMENT_TYPES.TABLET]: 'Tablet',
  [EQUIPMENT_TYPES.CHARGER]: 'Carregador',
  [EQUIPMENT_TYPES.MOUSE]: 'Mouse',
  [EQUIPMENT_TYPES.KEYBOARD]: 'Teclado',
  [EQUIPMENT_TYPES.HEADPHONES]: 'Fones de Ouvido',
  [EQUIPMENT_TYPES.CALCULATOR]: 'Calculadora',
  [EQUIPMENT_TYPES.OTHER]: 'Outro'
};

// ===== CONFIGURAÇÕES DE EMPRÉSTIMO =====
const BORROW_CONFIG = {
  DEFAULT_DEADLINE_HOURS: {
    [USER_TYPES.STUDENT]: 4,
    [USER_TYPES.PROFESSOR]: 24,
    [USER_TYPES.STAFF]: 24,
    [USER_TYPES.ADMIN]: 72
  },
  MAX_DEADLINE_HOURS: {
    [USER_TYPES.STUDENT]: 8,
    [USER_TYPES.PROFESSOR]: 48,
    [USER_TYPES.STAFF]: 48,
    [USER_TYPES.ADMIN]: 168 // 7 dias
  },
  MAX_CONCURRENT_BORROWS: {
    [USER_TYPES.STUDENT]: 1,
    [USER_TYPES.PROFESSOR]: 3,
    [USER_TYPES.STAFF]: 2,
    [USER_TYPES.ADMIN]: 5
  },
  REMINDER_HOURS_BEFORE: [2, 1, 0.5], // Lembretes em 2h, 1h e 30min antes
  OVERDUE_PENALTY_HOURS: 24,
  MAX_EXTENSIONS: 2
};

// ===== CONFIGURAÇÕES DE NOTIFICAÇÃO =====
const NOTIFICATION_TYPES = {
  BORROW_SUCCESS: 'borrow_success',
  RETURN_SUCCESS: 'return_success',
  DEADLINE_REMINDER: 'deadline_reminder',
  OVERDUE_WARNING: 'overdue_warning',
  EQUIPMENT_AVAILABLE: 'equipment_available',
  MAINTENANCE_SCHEDULED: 'maintenance_scheduled',
  SYSTEM_MAINTENANCE: 'system_maintenance'
};

const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  PUSH: 'push',
  SMS: 'sms',
  IN_APP: 'in_app'
};

const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
};

// ===== CONFIGURAÇÕES DE EMAIL =====
const EMAIL_CONFIG = {
  FROM_NAME: 'Smart Lock System',
  FROM_EMAIL: 'noreply@smartlock.universidade.edu.br',
  REPLY_TO: 'suporte@smartlock.universidade.edu.br',
  TEMPLATES: {
    BORROW_CONFIRMATION: 'borrow_confirmation',
    RETURN_CONFIRMATION: 'return_confirmation',
    DEADLINE_REMINDER: 'deadline_reminder',
    OVERDUE_NOTICE: 'overdue_notice',
    WELCOME: 'welcome',
    PASSWORD_RESET: 'password_reset'
  }
};

// ===== CONFIGURAÇÕES DE ARQUIVO =====
const FILE_CONFIG = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGES: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
  ALLOWED_DOCUMENTS: ['pdf', 'doc', 'docx', 'txt'],
  UPLOAD_PATHS: {
    QR_CODES: 'uploads/qr-codes',
    USER_PHOTOS: 'uploads/user-photos',
    EQUIPMENT_PHOTOS: 'uploads/equipment-photos',
    LOGS: 'logs'
  }
};

// ===== CONFIGURAÇÕES DE RATE LIMITING =====
const RATE_LIMITS = {
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,
    message: 'Muitas requisições. Tente novamente em 15 minutos.'
  },
  AUTH: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  API: {
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 30,
    message: 'Muitas chamadas à API. Tente novamente em 1 minuto.'
  },
  QR_SCAN: {
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: 'Muitas tentativas de leitura de QR. Aguarde 1 minuto.'
  }
};

// ===== CÓDIGOS DE RESPOSTA HTTP =====
const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

// ===== MENSAGENS DE ERRO PADRONIZADAS =====
const ERROR_MESSAGES = {
  // Autenticação
  INVALID_CREDENTIALS: 'Credenciais inválidas',
  TOKEN_EXPIRED: 'Token expirado',
  TOKEN_INVALID: 'Token inválido',
  ACCESS_DENIED: 'Acesso negado',
  USER_NOT_FOUND: 'Usuário não encontrado',
  USER_INACTIVE: 'Usuário inativo',
  
  // Validação
  REQUIRED_FIELD: 'Campo obrigatório',
  INVALID_EMAIL: 'Email inválido',
  INVALID_PASSWORD: 'Senha deve conter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial',
  INVALID_QR_CODE: 'Código QR inválido',
  INVALID_CABINET_ID: 'ID do armário inválido',
  INVALID_LOCKER_NUMBER: 'Número do locker inválido',
  
  // Negócio
  LOCKER_NOT_AVAILABLE: 'Locker não está disponível',
  LOCKER_ALREADY_OCCUPIED: 'Locker já está ocupado',
  CABINET_OFFLINE: 'Armário está offline',
  HARDWARE_ERROR: 'Erro de comunicação com o hardware',
  MAX_BORROWS_EXCEEDED: 'Limite de empréstimos simultâneos atingido',
  ALREADY_HAS_EQUIPMENT: 'Usuário já possui equipamento emprestado neste armário',
  NO_ACTIVE_BORROW: 'Não há empréstimo ativo para este locker',
  DEADLINE_EXCEEDED: 'Prazo de devolução excedido',
  
  // Sistema
  INTERNAL_ERROR: 'Erro interno do servidor',
  DATABASE_ERROR: 'Erro no banco de dados',
  NETWORK_ERROR: 'Erro de rede',
  FILE_TOO_LARGE: 'Arquivo muito grande',
  INVALID_FILE_TYPE: 'Tipo de arquivo inválido'
};

// ===== MENSAGENS DE SUCESSO PADRONIZADAS =====
const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login realizado com sucesso',
  LOGOUT_SUCCESS: 'Logout realizado com sucesso',
  USER_CREATED: 'Usuário criado com sucesso',
  USER_UPDATED: 'Usuário atualizado com sucesso',
  PASSWORD_CHANGED: 'Senha alterada com sucesso',
  BORROW_SUCCESS: 'Equipamento emprestado com sucesso',
  RETURN_SUCCESS: 'Equipamento devolvido com sucesso',
  QR_CODE_VALID: 'QR Code válido',
  EMAIL_SENT: 'Email enviado com sucesso',
  FILE_UPLOADED: 'Arquivo enviado com sucesso'
};

// ===== CONFIGURAÇÕES DE LOG =====
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

const LOG_COMPONENTS = {
  API: 'API',
  AUTH: 'AUTH',
  HARDWARE: 'HARDWARE',
  DATABASE: 'DATABASE',
  EMAIL: 'EMAIL',
  NOTIFICATION: 'NOTIFICATION',
  TRANSACTION: 'TRANSACTION',
  SECURITY: 'SECURITY'
};

// ===== CONFIGURAÇÕES DE WEBSOCKET =====
const WS_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  LOCKER_STATUS_CHANGE: 'locker_status_change',
  CABINET_STATUS_CHANGE: 'cabinet_status_change',
  NEW_NOTIFICATION: 'new_notification',
  BORROW_EVENT: 'borrow_event',
  RETURN_EVENT: 'return_event',
  HARDWARE_ALERT: 'hardware_alert',
  SYSTEM_MAINTENANCE: 'system_maintenance'
};

// ===== CONFIGURAÇÕES DE MONITORAMENTO =====
const MONITORING_CONFIG = {
  HEALTH_CHECK_INTERVAL: 30000, // 30 segundos
  METRICS_RETENTION_DAYS: 30,
  LOG_ROTATION_DAYS: 7,
  BACKUP_RETENTION_DAYS: 90,
  PERFORMANCE_THRESHOLD_MS: 1000, // 1 segundo
  ERROR_THRESHOLD_COUNT: 10, // Máximo de erros por minuto
  MEMORY_THRESHOLD_MB: 512,
  CPU_THRESHOLD_PERCENT: 80,
  DISK_THRESHOLD_PERCENT: 90
};

// ===== CONFIGURAÇÕES DE CRON JOBS =====
const CRON_SCHEDULES = {
  CLEANUP_LOGS: '0 2 * * *',          // Todo dia às 2h
  BACKUP_DATABASE: '0 3 * * *',       // Todo dia às 3h
  CHECK_OVERDUE: '*/30 * * * *',      // A cada 30 minutos
  SEND_REMINDERS: '0 */2 * * *',      // A cada 2 horas
  HEALTH_CHECK: '*/5 * * * *',        // A cada 5 minutos
  ROTATE_LOGS: '0 0 * * 0',           // Todo domingo à meia-noite
  CLEANUP_OLD_DATA: '0 1 * * 0'       // Todo domingo à 1h
};

// ===== CONFIGURAÇÕES DE CACHE =====
const CACHE_CONFIG = {
  DEFAULT_TTL: 300,                    // 5 minutos
  USER_SESSION_TTL: 28800,             // 8 horas
  QR_CODE_VALIDATION_TTL: 60,          // 1 minuto
  CABINET_STATUS_TTL: 30,              // 30 segundos
  LOCKER_STATUS_TTL: 10,               // 10 segundos
  API_RESPONSE_TTL: 120                // 2 minutos
};

// ===== PADRÕES DE REGEX =====
const REGEX_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/,
  CABINET_ID: /^CAB\d{3}$/,
  LOCKER_NUMBER: /^(0[1-9]|[1-9][0-9])$/,
  IPV4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  PHONE_BR: /^(?:\+55\s?)?(?:\([1-9]{2}\)|[1-9]{2})\s?(?:9\s?)?[0-9]{4}-?[0-9]{4}$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
};

// ===== CONFIGURAÇÕES DE AMBIENTE =====
const ENVIRONMENT = {
  DEVELOPMENT: 'development',
  TESTING: 'testing',
  STAGING: 'staging',
  PRODUCTION: 'production'
};

// ===== CONFIGURAÇÕES DE SEGURANÇA =====
const SECURITY_CONFIG = {
  BCRYPT_ROUNDS: 12,
  JWT_ALGORITHM: 'HS256',
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  HASH_ALGORITHM: 'sha256',
  MAX_REQUEST_SIZE: '10mb',
  CORS_ORIGINS: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://smartlock.universidade.edu.br'
  ],
  ALLOWED_HEADERS: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  }
};

// ===== CONFIGURAÇÕES DE API =====
const API_CONFIG = {
  VERSION: 'v1',
  BASE_PATH: '/api',
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_SORT_ORDER: 'desc',
  TIMEOUT: 30000, // 30 segundos
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000
};

// ===== CONFIGURAÇÕES DE MOBILE =====
const MOBILE_CONFIG = {
  QR_SCAN_TIMEOUT: 10000,      // 10 segundos
  CONNECTION_TIMEOUT: 15000,    // 15 segundos
  OFFLINE_CACHE_SIZE: 50,      // Número de itens no cache offline
  SYNC_INTERVAL: 300000,       // 5 minutos
  LOCATION_TIMEOUT: 10000,     // 10 segundos
  CAMERA_QUALITY: 0.8,         // 80% de qualidade
  MAX_PHOTO_SIZE: 2048         // Pixels
};

// ===== CONFIGURAÇÕES DE RELATÓRIO =====
const REPORT_CONFIG = {
  DEFAULT_DATE_RANGE: 30,      // dias
  MAX_DATE_RANGE: 365,         // dias
  EXPORT_FORMATS: ['pdf', 'excel', 'csv'],
  MAX_RECORDS: 10000,
  BATCH_SIZE: 1000
};

// ===== MENSAGENS DE VALIDAÇÃO =====
const VALIDATION_MESSAGES = {
  pt: {
    required: 'Este campo é obrigatório',
    email: 'Email deve ter formato válido',
    minLength: 'Deve ter pelo menos {min} caracteres',
    maxLength: 'Deve ter no máximo {max} caracteres',
    strongPassword: 'Senha deve conter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial',
    numeric: 'Deve ser um número',
    positive: 'Deve ser um número positivo',
    range: 'Deve estar entre {min} e {max}',
    unique: 'Este valor já está em uso',
    exists: 'Registro não encontrado'
  }
};

// ===== TEMPLATES DE EMAIL =====
const EMAIL_TEMPLATES = {
  [EMAIL_CONFIG.TEMPLATES.BORROW_CONFIRMATION]: {
    subject: 'Empréstimo Confirmado - Smart Lock',
    template: 'borrow_confirmation.html'
  },
  [EMAIL_CONFIG.TEMPLATES.RETURN_CONFIRMATION]: {
    subject: 'Devolução Confirmada - Smart Lock',
    template: 'return_confirmation.html'
  },
  [EMAIL_CONFIG.TEMPLATES.DEADLINE_REMINDER]: {
    subject: 'Lembrete: Prazo de Devolução - Smart Lock',
    template: 'deadline_reminder.html'
  },
  [EMAIL_CONFIG.TEMPLATES.OVERDUE_NOTICE]: {
    subject: 'URGENTE: Equipamento em Atraso - Smart Lock',
    template: 'overdue_notice.html'
  },
  [EMAIL_CONFIG.TEMPLATES.WELCOME]: {
    subject: 'Bem-vindo ao Smart Lock System',
    template: 'welcome.html'
  },
  [EMAIL_CONFIG.TEMPLATES.PASSWORD_RESET]: {
    subject: 'Redefinir Senha - Smart Lock',
    template: 'password_reset.html'
  }
};

// ===== CONFIGURAÇÕES DE BACKUP =====
const BACKUP_CONFIG = {
  ENABLED: true,
  RETENTION_DAYS: 30,
  COMPRESSION: true,
  ENCRYPTION: true,
  SCHEDULE: '0 3 * * *',       // Todo dia às 3h
  STORAGE_PATH: '/backups',
  MAX_SIZE_MB: 1024,           // 1GB
  NOTIFICATION_EMAIL: 'admin@smartlock.universidade.edu.br'
};

// ===== STATUS CODES CUSTOMIZADOS =====
const CUSTOM_STATUS_CODES = {
  QR_CODE_INVALID: 4001,
  LOCKER_UNAVAILABLE: 4002,
  HARDWARE_OFFLINE: 4003,
  MAX_BORROWS_EXCEEDED: 4004,
  DEADLINE_EXPIRED: 4005,
  MAINTENANCE_MODE: 5001
};

// Exportar todas as constantes
module.exports = {
  // Configurações gerais
  SYSTEM_CONFIG,
  AUTH_CONFIG,
  HARDWARE_CONFIG,
  API_CONFIG,
  MOBILE_CONFIG,
  REPORT_CONFIG,
  MONITORING_CONFIG,
  CACHE_CONFIG,
  SECURITY_CONFIG,
  BACKUP_CONFIG,

  // Tipos e status
  USER_TYPES,
  USER_TYPE_LABELS,
  USER_PERMISSIONS,
  TRANSACTION_STATUS,
  TRANSACTION_STATUS_LABELS,
  LOCKER_STATUS,
  LOCKER_STATUS_LABELS,
  CABINET_STATUS,
  CABINET_STATUS_LABELS,
  EQUIPMENT_TYPES,
  EQUIPMENT_TYPE_LABELS,

  // QR Code
  QR_CODE_TYPES,
  QR_CODE_PATTERNS,

  // Configurações de empréstimo
  BORROW_CONFIG,

  // Notificações
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,

  // Email
  EMAIL_CONFIG,
  EMAIL_TEMPLATES,

  // Arquivos
  FILE_CONFIG,

  // Rate limiting
  RATE_LIMITS,

  // HTTP Status
  HTTP_STATUS,
  CUSTOM_STATUS_CODES,

  // Mensagens
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION_MESSAGES,

  // Logs
  LOG_LEVELS,
  LOG_COMPONENTS,

  // WebSocket
  WS_EVENTS,

  // Cron
  CRON_SCHEDULES,

  // Regex
  REGEX_PATTERNS,

  // Ambiente
  ENVIRONMENT,

  // Helpers para acessar valores
  getUserPermissions: (userType) => USER_PERMISSIONS[userType] || [],
  hasPermission: (userType, permission) => {
    const permissions = USER_PERMISSIONS[userType] || [];
    return permissions.includes('*') || permissions.includes(permission);
  },
  getDefaultDeadline: (userType) => BORROW_CONFIG.DEFAULT_DEADLINE_HOURS[userType] || BORROW_CONFIG.DEFAULT_DEADLINE_HOURS[USER_TYPES.STUDENT],
  getMaxBorrows: (userType) => BORROW_CONFIG.MAX_CONCURRENT_BORROWS[userType] || BORROW_CONFIG.MAX_CONCURRENT_BORROWS[USER_TYPES.STUDENT],
  isValidUserType: (userType) => Object.values(USER_TYPES).includes(userType),
  isValidTransactionStatus: (status) => Object.values(TRANSACTION_STATUS).includes(status),
  isValidLockerStatus: (status) => Object.values(LOCKER_STATUS).includes(status),
  isValidCabinetStatus: (status) => Object.values(CABINET_STATUS).includes(status),
  isValidEquipmentType: (type) => Object.values(EQUIPMENT_TYPES).includes(type),
  getQRPattern: (type) => QR_CODE_PATTERNS[type],
  isProduction: () => process.env.NODE_ENV === ENVIRONMENT.PRODUCTION,
  isDevelopment: () => process.env.NODE_ENV === ENVIRONMENT.DEVELOPMENT,
  isTesting: () => process.env.NODE_ENV === ENVIRONMENT.TESTING
};