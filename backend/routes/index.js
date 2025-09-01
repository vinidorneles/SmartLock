const express = require('express');
const router = express.Router();

// Importar todas as rotas
const authRoutes = require('./auth');
const qrRoutes = require('./qr');
const lockersRoutes = require('./lockers');
const cabinetsRoutes = require('./cabinets');
const usersRoutes = require('./users');
const historyRoutes = require('./history');
const hardwareRoutes = require('./hardware');
const adminRoutes = require('./admin');

// Middleware de logging para todas as rotas da API
router.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// Rota de health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota de informações da API
router.get('/', (req, res) => {
  res.json({
    name: 'Smart Lock System API',
    version: '1.0.0',
    description: 'API para sistema de gerenciamento de armários inteligentes',
    endpoints: {
      auth: '/api/auth',
      qr: '/api/qr',
      lockers: '/api/lockers',
      cabinets: '/api/cabinets',
      users: '/api/users',
      history: '/api/history',
      hardware: '/api/hardware',
      admin: '/api/admin'
    },
    documentation: 'https://docs.smartlock.edu.br/api'
  });
});

// Configurar rotas
router.use('/auth', authRoutes);
router.use('/qr', qrRoutes);
router.use('/lockers', lockersRoutes);
router.use('/cabinets', cabinetsRoutes);
router.use('/users', usersRoutes);
router.use('/history', historyRoutes);
router.use('/hardware', hardwareRoutes);
router.use('/admin', adminRoutes);

// Middleware para rotas não encontradas
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    message: 'A rota solicitada não existe nesta API',
    availableEndpoints: [
      'GET /api/',
      'GET /api/health',
      'POST /api/auth/login',
      'POST /api/qr/validate',
      'GET /api/lockers',
      'GET /api/cabinets',
      'GET /api/history'
    ]
  });
});

module.exports = router;