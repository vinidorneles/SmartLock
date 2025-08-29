const { Pool } = require('pg');
const logger = require('../utils/logger');

// Configuração do PostgreSQL
const dbConfig = {
  user: process.env.DB_USER || 'smartlock_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'smartlock',
  password: process.env.DB_PASSWORD || 'secure_password',
  port: process.env.DB_PORT || 5432,
  
  // Pool de conexões
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  min: parseInt(process.env.DB_MIN_CONNECTIONS) || 5,
  idle: parseInt(process.env.DB_IDLE_TIMEOUT) || 10000,
  acquire: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 30000,
  
  // SSL configuration
  ssl: process.env.NODE_ENV === 'production' ? {
    require: true,
    rejectUnauthorized: false
  } : false,
  
  // Connection timeout
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  
  // Statement timeout
  statement_timeout: 30000,
  query_timeout: 30000
};

// Criar pool de conexões
const pool = new Pool(dbConfig);

// Event listeners para o pool
pool.on('connect', (client) => {
  logger.info('Database client connected');
  // Set timezone for each connection
  client.query('SET timezone = "UTC"');
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client:', err);
  process.exit(-1);
});

pool.on('acquire', (client) => {
  logger.debug('Database connection acquired');
});

pool.on('remove', (client) => {
  logger.debug('Database connection removed');
});

// Função para testar conexão
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection test successful:', result.rows[0]);
    return true;
  } catch (err) {
    logger.error('Database connection test failed:', err);
    return false;
  }
};

// Função para executar queries com retry
const query = async (text, params = []) => {
  const maxRetries = 3;
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const start = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Query executed successfully', {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
      
      return result;
    } catch (error) {
      lastError = error;
      logger.error(`Query attempt ${i + 1} failed:`, {
        error: error.message,
        query: text.substring(0, 100)
      });
      
      // Wait before retry (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw lastError;
};

// Função para transações
const transaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Função para executar migrations
const runMigration = async (migrationSQL) => {
  try {
    await query(migrationSQL);
    logger.info('Migration executed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
};

// Função para health check do banco
const healthCheck = async () => {
  try {
    const result = await query('SELECT 1 as health_check');
    return {
      status: 'healthy',
      timestamp: new Date(),
      details: result.rows[0]
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date(),
      error: error.message
    };
  }
};

// Graceful shutdown
const closePool = async () => {
  try {
    logger.info('Closing database pool...');
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool:', error);
  }
};

// Interceptar sinais de shutdown
process.on('SIGTERM', closePool);
process.on('SIGINT', closePool);

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  runMigration,
  healthCheck,
  closePool,
  
  // Configurações para uso externo
  config: dbConfig
};