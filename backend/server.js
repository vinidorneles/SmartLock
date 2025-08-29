#!/usr/bin/env node

/**
 * ================================================================
 * SMART LOCK SYSTEM - Server Entry Point
 * ================================================================
 * 
 * Main server file that starts the HTTP server and WebSocket server
 * Handles graceful shutdown and process management
 * 
 * @author Smart Lock System Team
 * @version 1.0.0
 * ================================================================
 */

'use strict';

// Load environment variables first
require('dotenv').config();

// Core modules
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

// Application modules
const app = require('./app');
const logger = require('./utils/logger');
const { connectDatabase, closeDatabase } = require('./config/database');
const { connectRedis, closeRedis } = require('./config/redis');
const wsServer = require('./websocket/wsServer');

// Constants
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CLUSTER_MODE = process.env.CLUSTER_MODE === 'true' || NODE_ENV === 'production';
const SSL_ENABLED = process.env.SSL_ENABLED === 'true';

/**
 * Create HTTP/HTTPS Server
 */
function createServer() {
  let server;

  if (SSL_ENABLED) {
    // HTTPS Server
    const options = {
      cert: fs.readFileSync(process.env.SSL_CERT_PATH),
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      ca: process.env.SSL_CA_PATH ? fs.readFileSync(process.env.SSL_CA_PATH) : undefined,
    };
    
    server = https.createServer(options, app);
    logger.info('HTTPS Server created with SSL certificates');
  } else {
    // HTTP Server
    server = http.createServer(app);
    logger.info('HTTP Server created');
  }

  return server;
}

/**
 * Initialize Database and Redis connections
 */
async function initializeConnections() {
  try {
    logger.info('Initializing database connection...');
    await connectDatabase();
    
    logger.info('Initializing Redis connection...');
    await connectRedis();
    
    logger.info('All connections initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize connections:', error);
    throw error;
  }
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Initialize connections
    await initializeConnections();

    // Create server
    const server = createServer();

    // Initialize WebSocket server
    wsServer.initialize(server);

    // Start listening
    server.listen(PORT, () => {
      logger.info(`🚀 Smart Lock System Server started`, {
        port: PORT,
        environment: NODE_ENV,
        ssl: SSL_ENABLED,
        pid: process.pid,
        worker: cluster.worker?.id || 'master',
        timestamp: new Date().toISOString(),
      });

      // Log server info
      logger.info('📊 Server Information:', {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        uptime: process.uptime(),
      });
    });

    // Server error handling
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          logger.error('Server error:', error);
          throw error;
      }
    });

    // Graceful shutdown handling
    setupGracefulShutdown(server);

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown
 */
function setupGracefulShutdown(server) {
  const gracefulShutdown = async (signal) => {
    logger.info(`📴 Received ${signal}. Starting graceful shutdown...`);

    // Set shutdown timeout
    const shutdownTimeout = setTimeout(() => {
      logger.error('⚠️ Forceful shutdown due to timeout');
      process.exit(1);
    }, 30000);

    try {
      // Stop accepting new connections
      server.close(() => {
        logger.info('✅ HTTP server closed');
      });

      // Close WebSocket connections
      wsServer.close();
      logger.info('✅ WebSocket server closed');

      // Close database connections
      await closeDatabase();
      logger.info('✅ Database connections closed');

      // Close Redis connections
      await closeRedis();
      logger.info('✅ Redis connections closed');

      clearTimeout(shutdownTimeout);
      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown:', error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  };

  // Handle different shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR1', () => gracefulShutdown('SIGUSR1'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

/**
 * Worker process logic for cluster mode
 */
function runWorker() {
  logger.info(`🔧 Worker ${process.pid} starting...`);
  
  startServer().then(() => {
    logger.info(`✅ Worker ${process.pid} started successfully`);
  }).catch((error) => {
    logger.error(`❌ Worker ${process.pid} failed to start:`, error);
    process.exit(1);
  });

  // Worker-specific error handling
  process.on('disconnect', () => {
    logger.info(`🔌 Worker ${process.pid} disconnected from master`);
  });
}

/**
 * Master process logic for cluster mode
 */
function runMaster() {
  logger.info(`🎯 Master ${process.pid} is running`);

  const workerCount = Math.min(numCPUs, 4); // Limit to 4 workers max
  
  logger.info(`🚀 Starting ${workerCount} workers...`);

  // Fork workers
  for (let i = 0; i < workerCount; i++) {
    const worker = cluster.fork();
    logger.info(`👷 Worker ${worker.process.pid} forked`);
  }

  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`💀 Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    
    // Restart worker after a delay
    setTimeout(() => {
      const newWorker = cluster.fork();
      logger.info(`🔄 New worker ${newWorker.process.pid} started`);
    }, 5000);
  });

  // Handle worker online
  cluster.on('online', (worker) => {
    logger.info(`✅ Worker ${worker.process.pid} is online`);
  });

  // Handle worker listening
  cluster.on('listening', (worker, address) => {
    logger.info(`🎧 Worker ${worker.process.pid} listening on ${address.address}:${address.port}`);
  });

  // Master process shutdown
  process.on('SIGTERM', () => {
    logger.info('📴 Master received SIGTERM, shutting down workers...');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });
}

/**
 * Application startup
 */
function main() {
  // Display startup banner
  console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║                                                              ║
  ║                   🔐 SMART LOCK SYSTEM                       ║
  ║                                                              ║
  ║              University Equipment Management                 ║
  ║                       Backend API                            ║
  ║                                                              ║
  ║                     Version 1.0.0                           ║
  ║                                                              ║
  ╚══════════════════════════════════════════════════════════════╝
  `);

  logger.info('🔍 Environment Check:', {
    nodeEnv: NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid,
    port: PORT,
    clusterMode: CLUSTER_MODE,
    sslEnabled: SSL_ENABLED,
  });

  // Validate environment
  if (!process.env.DATABASE_URL) {
    logger.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    logger.error('❌ JWT_SECRET environment variable is required');
    process.exit(1);
  }

  // Start application
  if (CLUSTER_MODE && cluster.isMaster) {
    runMaster();
  } else {
    runWorker();
  }
}

// Check if this file is being run directly
if (require.main === module) {
  main();
}

// Export for testing
module.exports = {
  createServer,
  startServer,
  setupGracefulShutdown,
  app,
};

/**
 * ================================================================
 * STARTUP CHECKLIST FOR PRODUCTION
 * ================================================================
 * 
 * Environment Variables:
 * ✓ DATABASE_URL - PostgreSQL connection string
 * ✓ REDIS_URL - Redis connection string
 * ✓ JWT_SECRET - Strong JWT secret (64+ characters)
 * ✓ SESSION_SECRET - Strong session secret
 * ✓ SMTP_* - Email configuration
 * ✓ SSL_* - SSL certificate paths (if using HTTPS)
 * 
 * System Requirements:
 * ✓ Node.js >= 18.0.0
 * ✓ PostgreSQL >= 12.0
 * ✓ Redis >= 6.0
 * ✓ Sufficient disk space for logs and uploads
 * ✓ Network connectivity to hardware controllers
 * 
 * Security:
 * ✓ Change default passwords
 * ✓ Configure firewall rules
 * ✓ Set up SSL certificates
 * ✓ Configure rate limiting
 * ✓ Enable audit logging
 * 
 * Monitoring:
 * ✓ Configure log rotation
 * ✓ Set up health checks
 * ✓ Configure alerts
 * ✓ Set up backup procedures
 * ✓ Monitor system resources
 * 
 * ================================================================
 */