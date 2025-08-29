/**
 * ================================================================
 * SMART LOCK SYSTEM - Express Application
 * ================================================================
 * 
 * Main Express application configuration
 * Middleware setup, route configuration, error handling
 * 
 * @author Smart Lock System Team
 * @version 1.0.0
 * ================================================================
 */

'use strict';

// Core dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Custom modules
const logger = require('./utils/logger');
const { redisClient } = require('./config/redis');
const errorHandler = require('./middlewares/errorHandler');
const authMiddleware = require('./middlewares/auth');
const validationMiddleware = require('./middlewares/validation');
const loggingMiddleware = require('./middlewares/logging');
const metricsMiddleware = require('./middlewares/metrics');

// Route imports
const authRoutes = require('./routes/auth');
const qrRoutes = require('./routes/qr');
const lockerRoutes = require('./routes/lockers');
const cabinetRoutes = require('./routes/cabinets');
const userRoutes = require('./routes/users');
const historyRoutes = require('./routes/history');
const hardwareRoutes = require('./routes/hardware');
const adminRoutes = require('./routes/admin');

// Constants
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENABLE_SWAGGER = process.env.ENABLE_SWAGGER_DOCS === 'true';
const ENABLE_METRICS = process.env.ENABLE_METRICS === 'true';
const API_PREFIX = '/api';

/**
 * Create Express application
 */
function createApp() {
  const app = express();

  // =================================================================
  // BASIC MIDDLEWARE SETUP
  // =================================================================

  // Trust proxy (important for rate limiting and getting real IP)
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  // Request logging
  if (NODE_ENV !== 'test') {
    app.use(morgan('combined', {
      stream: {
        write: (message) => logger.http(message.trim())
      }
    }));
  }

  // Custom request logging middleware
  app.use(loggingMiddleware);

  // Metrics middleware (if enabled)
  if (ENABLE_METRICS) {
    app.use(metricsMiddleware);
  }

  // =================================================================
  // SECURITY MIDDLEWARE
  // =================================================================

  // Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    hsts: {
      maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000,
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: {
      policy: process.env.REFERRER_POLICY || 'same-origin'
    }
  }));

  // CORS configuration
  const corsOptions = {
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim());
      
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin) || NODE_ENV === 'development') {
        callback(null, true);
      } else {
        logger.warn('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };

  app.use(cors(corsOptions));

  // =================================================================
  // BODY PARSING & COMPRESSION
  // =================================================================

  // Enable compression
  if (process.env.ENABLE_COMPRESSION === 'true') {
    app.use(compression({
      level: parseInt(process.env.COMPRESSION_LEVEL) || 6,
      threshold: 1024,
    }));
  }

  // Body parsing middleware
  app.use(express.json({
    limit: process.env.REQUEST_BODY_LIMIT || '10mb',
    verify: (req, res, buf) => {
      // Store raw body for webhook verification if needed
      req.rawBody = buf;
    }
  }));

  app.use(express.urlencoded({
    extended: true,
    limit: process.env.REQUEST_BODY_LIMIT || '10mb',
    parameterLimit: parseInt(process.env.REQUEST_PARAMETER_LIMIT) || 1000,
  }));

  // File upload middleware
  app.use(fileUpload({
    limits: {
      fileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
      files: parseInt(process.env.UPLOAD_MAX_FILES) || 5,
    },
    abortOnLimit: true,
    responseOnLimit: 'File size limit exceeded',
    uploadTimeout: 30000,
    useTempFiles: true,
    tempFileDir: './temp/',
    debug: NODE_ENV === 'development',
  }));

  // =================================================================
  // SESSION CONFIGURATION
  // =================================================================

  // Session store using Redis
  const sessionConfig = {
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || 'session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'smartlock.sid',
    cookie: {
      secure: process.env.SSL_ENABLED === 'true',
      httpOnly: true,
      maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
    },
    rolling: true, // Reset expiry on activity
  };

  app.use(session(sessionConfig));

  // =================================================================
  // RATE LIMITING
  // =================================================================

  // General rate limiting
  const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
      });
    },
  });

  // Apply general rate limiting to all routes
  app.use(generalLimiter);

  // Stricter rate limiting for authentication routes
  const authLimiter = rateLimit({
    windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS) || 5,
    skipSuccessfulRequests: true,
    message: {
      error: 'Too many login attempts from this IP, please try again later.',
    },
  });

  // =================================================================
  // SWAGGER DOCUMENTATION
  // =================================================================

  if (ENABLE_SWAGGER) {
    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'Smart Lock System API',
          version: '1.0.0',
          description: 'API for Smart Lock System - University Equipment Management',
          contact: {
            name: 'Smart Lock System Team',
            email: 'dev@smartlock.universidade.edu.br',
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT',
          },
        },
        servers: [
          {
            url: process.env.APP_URL || 'http://localhost:3001',
            description: 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      apis: ['./routes/*.js', './models/*.js'], // paths to files containing OpenAPI definitions
    };

    const swaggerSpec = swaggerJsdoc(swaggerOptions);

    app.use(
      process.env.SWAGGER_PATH || '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Smart Lock System API Documentation',
      })
    );

    // Serve swagger spec as JSON
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    logger.info(`📚 Swagger documentation available at ${process.env.SWAGGER_PATH || '/api-docs'}`);
  }

  // =================================================================
  // HEALTH CHECK & STATUS ROUTES
  // =================================================================

  // Health check endpoint
  app.get(process.env.HEALTH_CHECK_PATH || '/health', async (req, res) => {
    try {
      // Check database connectivity
      const dbStatus = await checkDatabaseHealth();
      
      // Check Redis connectivity
      const redisStatus = await checkRedisHealth();
      
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: NODE_ENV,
        uptime: Math.floor(process.uptime()),
        memory: {
          used: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
        services: {
          database: dbStatus,
          redis: redisStatus,
        },
      };

      res.json(healthData);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  });

  // Readiness probe (for Kubernetes)
  app.get('/ready', (req, res) => {
    res.status(200).json({ status: 'ready' });
  });

  // Liveness probe (for Kubernetes)
  app.get('/live', (req, res) => {
    res.status(200).json({ status: 'alive' });
  });

  // Version endpoint
  app.get('/version', (req, res) => {
    res.json({
      name: process.env.npm_package_name || 'smart-lock-backend',
      version: process.env.npm_package_version || '1.0.0',
      node: process.version,
      environment: NODE_ENV,
    });
  });

  // =================================================================
  // API ROUTES
  // =================================================================

  // Authentication routes (with stricter rate limiting)
  app.use(`${API_PREFIX}/auth`, authLimiter, authRoutes);

  // Public routes (no authentication required)
  app.use(`${API_PREFIX}/qr`, qrRoutes);

  // Protected routes (require authentication)
  app.use(`${API_PREFIX}/lockers`, authMiddleware.authenticate, lockerRoutes);
  app.use(`${API_PREFIX}/cabinets`, authMiddleware.authenticate, cabinetRoutes);
  app.use(`${API_PREFIX}/users`, authMiddleware.authenticate, userRoutes);
  app.use(`${API_PREFIX}/history`, authMiddleware.authenticate, historyRoutes);

  // Hardware routes (require hardware authentication)
  app.use(`${API_PREFIX}/hardware`, hardwareRoutes);

  // Admin routes (require admin authentication)
  app.use(`${API_PREFIX}/admin`, authMiddleware.authenticate, authMiddleware.requireAdmin, adminRoutes);

  // Metrics endpoint (if enabled)
  if (ENABLE_METRICS) {
    app.get(process.env.METRICS_PATH || '/metrics', metricsMiddleware.getMetrics);
  }

  // =================================================================
  // STATIC FILE SERVING
  // =================================================================

  // Serve uploaded files (with authentication)
  app.use('/uploads', authMiddleware.authenticate, express.static('uploads', {
    maxAge: '1d',
    etag: false,
    lastModified: false,
  }));

  // Serve QR codes (public access)
  app.use('/qr-codes', express.static('uploads/qr-codes', {
    maxAge: '7d',
    etag: true,
  }));

  // =================================================================
  // ERROR HANDLING
  // =================================================================

  // 404 handler for API routes
  app.use(`${API_PREFIX}/*`, (req, res) => {
    logger.warn('API route not found:', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested API endpoint does not exist',
      path: req.path,
      method: req.method,
    });
  });

  // General 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource does not exist',
      suggestion: 'Check the API documentation for available endpoints',
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}

/**
 * Check database health
 */
async function checkDatabaseHealth() {
  try {
    const { pool } = require('./config/database');
    const result = await pool.query('SELECT NOW() as timestamp, version() as version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].timestamp,
      version: result.rows[0].version.split(' ')[0],
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

/**
 * Check Redis health
 */
async function checkRedisHealth() {
  try {
    await redisClient.ping();
    return {
      status: 'healthy',
      connected: redisClient.isReady,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

// Create and export the app
const app = createApp();

module.exports = app;

/**
 * ================================================================
 * MIDDLEWARE STACK SUMMARY
 * ================================================================
 * 
 * 1. Request Logging (Morgan + Custom)
 * 2. Metrics Collection
 * 3. Security Headers (Helmet)
 * 4. CORS Configuration
 * 5. Response Compression
 * 6. Body Parsing (JSON/URL-encoded/File uploads)
 * 7. Session Management (Redis-backed)
 * 8. Rate Limiting (General + Auth-specific)
 * 9. Route Handlers
 * 10. Error Handling
 * 
 * ================================================================
 */