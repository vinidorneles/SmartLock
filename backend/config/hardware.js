const logger = require('../utils/logger');

// Configurações de hardware
const hardwareConfig = {
  // Configurações de comunicação
  communication: {
    protocol: process.env.HARDWARE_PROTOCOL || 'http', // http, mqtt, websocket
    timeout: parseInt(process.env.HARDWARE_TIMEOUT) || 5000,
    retryAttempts: parseInt(process.env.HARDWARE_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.HARDWARE_RETRY_DELAY) || 1000,
    
    // HTTP específico
    http: {
      port: parseInt(process.env.HARDWARE_HTTP_PORT) || 8080,
      endpoint: process.env.HARDWARE_HTTP_ENDPOINT || '/api/command'
    },
    
    // MQTT específico
    mqtt: {
      broker: process.env.MQTT_BROKER || 'localhost:1883',
      username: process.env.MQTT_USERNAME || '',
      password: process.env.MQTT_PASSWORD || '',
      topicPrefix: process.env.MQTT_TOPIC_PREFIX || 'smartlock',
      qos: parseInt(process.env.MQTT_QOS) || 1
    },
    
    // WebSocket específico
    websocket: {
      port: parseInt(process.env.HARDWARE_WS_PORT) || 8081,
      heartbeatInterval: parseInt(process.env.HARDWARE_HEARTBEAT) || 30000
    }
  },
  
  // Configurações de fechaduras
  locks: {
    // Duração padrão para manter destrancado (em segundos)
    defaultUnlockDuration: parseInt(process.env.DEFAULT_UNLOCK_DURATION) || 30,
    maxUnlockDuration: parseInt(process.env.MAX_UNLOCK_DURATION) || 300,
    minUnlockDuration: parseInt(process.env.MIN_UNLOCK_DURATION) || 5,
    
    // Tipos de fechadura suportados
    supportedTypes: {
      SOLENOID: 'solenoid',
      SERVO: 'servo',
      MAGNETIC: 'magnetic',
      ELECTRONIC: 'electronic'
    },
    
    // Configurações específicas por tipo
    solenoid: {
      activationVoltage: 12, // Volts
      activationCurrent: 0.5, // Amperes
      holdCurrent: 0.1 // Amperes
    },
    
    servo: {
      minAngle: 0,
      maxAngle: 180,
      speed: 100 // graus por segundo
    },
    
    magnetic: {
      holdingForce: 180, // kg
      voltage: 12 // Volts
    }
  },
  
  // Configurações de sensores
  sensors: {
    // Sensor de porta (reed switch, magnetic sensor)
    door: {
      enabled: process.env.DOOR_SENSOR_ENABLED === 'true',
      type: process.env.DOOR_SENSOR_TYPE || 'reed', // reed, magnetic, optical
      debounceTime: parseInt(process.env.DOOR_DEBOUNCE_TIME) || 100, // ms
      pollInterval: parseInt(process.env.DOOR_POLL_INTERVAL) || 1000 // ms
    },
    
    // Sensor de presença/movimento
    motion: {
      enabled: process.env.MOTION_SENSOR_ENABLED === 'true',
      type: process.env.MOTION_SENSOR_TYPE || 'pir', // pir, ultrasonic
      sensitivity: parseInt(process.env.MOTION_SENSITIVITY) || 5,
      cooldownTime: parseInt(process.env.MOTION_COOLDOWN) || 5000 // ms
    },
    
    // Sensor de temperatura (para monitoramento do hardware)
    temperature: {
      enabled: process.env.TEMP_SENSOR_ENABLED === 'true',
      type: process.env.TEMP_SENSOR_TYPE || 'dht22',
      alertThreshold: parseFloat(process.env.TEMP_ALERT_THRESHOLD) || 60, // Celsius
      pollInterval: parseInt(process.env.TEMP_POLL_INTERVAL) || 30000 // ms
    }
  },
  
  // Configurações de segurança
  security: {
    // Criptografia para comandos
    encryptCommands: process.env.ENCRYPT_HARDWARE_COMMANDS === 'true',
    encryptionKey: process.env.HARDWARE_ENCRYPTION_KEY || 'default-key-change-in-production',
    
    // Rate limiting para hardware
    rateLimiting: {
      enabled: process.env.HARDWARE_RATE_LIMIT_ENABLED === 'true',
      maxCommands: parseInt(process.env.HARDWARE_MAX_COMMANDS) || 10,
      timeWindow: parseInt(process.env.HARDWARE_TIME_WINDOW) || 60000 // ms
    },
    
    // Autenticação de hardware
    requireAuth: process.env.HARDWARE_REQUIRE_AUTH === 'true',
    authToken: process.env.HARDWARE_AUTH_TOKEN || ''
  },
  
  // Configurações de monitoramento
  monitoring: {
    // Health check
    healthCheck: {
      enabled: process.env.HARDWARE_HEALTH_CHECK_ENABLED === 'true',
      interval: parseInt(process.env.HARDWARE_HEALTH_INTERVAL) || 60000, // ms
      timeout: parseInt(process.env.HARDWARE_HEALTH_TIMEOUT) || 5000 // ms
    },
    
    // Métricas
    metrics: {
      enabled: process.env.HARDWARE_METRICS_ENABLED === 'true',
      collectInterval: parseInt(process.env.HARDWARE_METRICS_INTERVAL) || 30000, // ms
      retentionPeriod: parseInt(process.env.HARDWARE_METRICS_RETENTION) || 86400000 // ms (24h)
    },
    
    // Alertas
    alerts: {
      enabled: process.env.HARDWARE_ALERTS_ENABLED === 'true',
      
      // Condições de alerta
      conditions: {
        offline: {
          enabled: true,
          threshold: parseInt(process.env.HARDWARE_OFFLINE_THRESHOLD) || 300000 // 5 min
        },
        highTemperature: {
          enabled: true,
          threshold: parseFloat(process.env.HARDWARE_TEMP_THRESHOLD) || 60 // Celsius
        },
        lowBattery: {
          enabled: true,
          threshold: parseFloat(process.env.HARDWARE_BATTERY_THRESHOLD) || 20 // %
        },
        commandFailure: {
          enabled: true,
          threshold: parseInt(process.env.HARDWARE_FAILURE_THRESHOLD) || 3 // tentativas consecutivas
        }
      }
    }
  },
  
  // Configurações de rede
  network: {
    // WiFi (para ESP32/ESP8266)
    wifi: {
      ssid: process.env.HARDWARE_WIFI_SSID || '',
      password: process.env.HARDWARE_WIFI_PASSWORD || '',
      reconnectDelay: parseInt(process.env.HARDWARE_WIFI_RECONNECT_DELAY) || 30000,
      maxReconnectAttempts: parseInt(process.env.HARDWARE_WIFI_MAX_RECONNECT) || 5
    },
    
    // Ethernet (para Raspberry Pi)
    ethernet: {
      enabled: process.env.HARDWARE_ETHERNET_ENABLED === 'true',
      staticIP: process.env.HARDWARE_STATIC_IP || '',
      gateway: process.env.HARDWARE_GATEWAY || '',
      dns: process.env.HARDWARE_DNS || '8.8.8.8'
    }
  },
  
  // Tipos de controlador
  controllerTypes: {
    ARDUINO_UNO: 'arduino_uno',
    ARDUINO_NANO: 'arduino_nano',
    ESP32: 'esp32',
    ESP8266: 'esp8266',
    RASPBERRY_PI: 'raspberry_pi',
    RASPBERRY_PI_ZERO: 'raspberry_pi_zero'
  },
  
  // Comandos disponíveis
  commands: {
    UNLOCK: 'unlock',
    LOCK: 'lock',
    STATUS: 'status',
    HEALTH: 'health',
    RESET: 'reset',
    UPDATE: 'update',
    CONFIG: 'config'
  },
  
  // Status possíveis
  status: {
    ONLINE: 'online',
    OFFLINE: 'offline',
    MAINTENANCE: 'maintenance',
    ERROR: 'error',
    UPDATING: 'updating'
  }
};

// Validar configurações essenciais
const validateConfig = () => {
  const errors = [];
  
  // Validar timeout
  if (hardwareConfig.communication.timeout < 1000) {
    errors.push('Timeout muito baixo (mínimo 1000ms)');
  }
  
  // Validar duração de destravamento
  if (hardwareConfig.locks.defaultUnlockDuration > hardwareConfig.locks.maxUnlockDuration) {
    errors.push('Duração padrão não pode ser maior que a máxima');
  }
  
  // Validar chave de criptografia em produção
  if (process.env.NODE_ENV === 'production' && 
      hardwareConfig.security.encryptCommands && 
      hardwareConfig.security.encryptionKey === 'default-key-change-in-production') {
    errors.push('Chave de criptografia padrão não deve ser usada em produção');
  }
  
  // Validar configurações de WiFi se necessário
  if (hardwareConfig.network.wifi.ssid && !hardwareConfig.network.wifi.password) {
    logger.warn('WiFi SSID configurado mas senha está vazia');
  }
  
  if (errors.length > 0) {
    logger.error('Erros na configuração de hardware:', errors);
    throw new Error(`Configuração inválida: ${errors.join(', ')}`);
  }
  
  logger.info('Configuração de hardware validada com sucesso');
};

// Função para obter configuração específica de um controlador
const getControllerConfig = (controllerType) => {
  const baseConfig = { ...hardwareConfig };
  
  // Configurações específicas por tipo de controlador
  switch (controllerType) {
    case hardwareConfig.controllerTypes.ESP32:
    case hardwareConfig.controllerTypes.ESP8266:
      return {
        ...baseConfig,
        preferredProtocol: 'http',
        supportsWifi: true,
        supportsOTA: true,
        maxMemory: controllerType === hardwareConfig.controllerTypes.ESP32 ? 520 : 80 // KB
      };
      
    case hardwareConfig.controllerTypes.RASPBERRY_PI:
    case hardwareConfig.controllerTypes.RASPBERRY_PI_ZERO:
      return {
        ...baseConfig,
        preferredProtocol: 'websocket',
        supportsEthernet: true,
        supportsWifi: true,
        canRunPython: true,
        maxMemory: controllerType === hardwareConfig.controllerTypes.RASPBERRY_PI ? 1024 : 512 // MB
      };
      
    case hardwareConfig.controllerTypes.ARDUINO_UNO:
    case hardwareConfig.controllerTypes.ARDUINO_NANO:
      return {
        ...baseConfig,
        preferredProtocol: 'http',
        supportsWifi: false,
        requiresShield: true,
        maxMemory: 2 // KB
      };
      
    default:
      logger.warn(`Tipo de controlador desconhecido: ${controllerType}`);
      return baseConfig;
  }
};

// Função para formatar comando para envio
const formatCommand = (command, params = {}) => {
  const timestamp = Date.now();
  
  return {
    command,
    params,
    timestamp,
    id: `cmd_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
  };
};

// Função para validar resposta do hardware
const validateHardwareResponse = (response) => {
  if (!response) {
    return { valid: false, error: 'Resposta vazia' };
  }
  
  const requiredFields = ['command', 'status', 'timestamp'];
  const missingFields = requiredFields.filter(field => !response[field]);
  
  if (missingFields.length > 0) {
    return { 
      valid: false, 
      error: `Campos obrigatórios ausentes: ${missingFields.join(', ')}` 
    };
  }
  
  // Validar timestamp (não pode ser muito antigo)
  const age = Date.now() - response.timestamp;
  if (age > 60000) { // 1 minuto
    return { 
      valid: false, 
      error: 'Resposta muito antiga' 
    };
  }
  
  return { valid: true };
};

// Inicializar configurações
try {
  validateConfig();
  logger.info('Hardware configuration loaded successfully');
} catch (error) {
  logger.error('Failed to load hardware configuration:', error);
  process.exit(1);
}

module.exports = {
  config: hardwareConfig,
  validateConfig,
  getControllerConfig,
  formatCommand,
  validateHardwareResponse
};