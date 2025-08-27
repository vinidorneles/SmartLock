// =================================================================
// SMART LOCK SYSTEM - PM2 Ecosystem Configuration
// =================================================================
//
// Este arquivo configura o PM2 para gerenciar os processos do sistema
// em ambiente de produção com cluster, monitoramento e auto-restart
//
// Para usar:
// pm2 start ecosystem.config.js --env production
// pm2 monit
// pm2 logs
// =================================================================

module.exports = {
  apps: [
    // =================================================================
    // MAIN API SERVER
    // =================================================================
    {
      name: 'smartlock-api',
      script: 'server.js',
      cwd: './backend',
      instances: process.env.NODE_ENV === 'production' ? 'max' : 1,
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        DATABASE_URL: 'postgresql://smartlock_user:dev_password@localhost:5432/smartlock',
        REDIS_URL: 'redis://localhost:6379/0',
        JWT_SECRET: 'jwt_secret_development_2025',
        JWT_EXPIRES_IN: '8h',
        LOG_LEVEL: 'debug',
        LOG_FILE: 'logs/smartlock-dev.log'
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
        DATABASE_URL: 'postgresql://smartlock_user:staging_password@db-staging:5432/smartlock',
        REDIS_URL: 'redis://cache-staging:6379/0',
        JWT_SECRET: process.env.JWT_SECRET_STAGING,
        JWT_EXPIRES_IN: '4h',
        LOG_LEVEL: 'info',
        LOG_FILE: 'logs/smartlock-staging.log'
      },
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES_IN: '8h',
        LOG_LEVEL: 'warn',
        LOG_FILE: 'logs/smartlock-production.log',
        
        // Email configuration
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
        
        // Hardware configuration
        HARDWARE_TIMEOUT: 5000,
        DEFAULT_UNLOCK_DURATION: 30
      },
      
      // PM2 options
      watch: process.env.NODE_ENV === 'development',
      watch_delay: 1000,
      ignore_watch: [
        'node_modules',
        'logs',
        'uploads',
        'tests',
        'coverage',
        '.git'
      ],
      
      // Resource management
      max_memory_restart: '1G',
      node_args: process.env.NODE_ENV === 'production' ? '--optimize-for-size' : '',
      
      // Logging
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto restart settings
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Health monitoring
      health_check_grace_period: 10000,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000,
      
      // Advanced options
      source_map_support: true,
      instance_var: 'INSTANCE_ID',
      
      // Custom options for Smart Lock System
      automation_args: [
        '--max-old-space-size=1024',
        '--experimental-modules'
      ],
      
      // Cron restart (restart every day at 2 AM)
      cron_restart: process.env.NODE_ENV === 'production' ? '0 2 * * *' : null
    },

    // =================================================================
    // WEBSOCKET SERVER (separate process for better isolation)
    // =================================================================
    {
      name: 'smartlock-websocket',
      script: 'websocket/wsServer.js',
      cwd: './backend',
      instances: 1, // WebSocket typically runs on single instance
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'development',
        WS_PORT: 3002,
        API_BASE_URL: 'http://localhost:3001',
        REDIS_URL: 'redis://localhost:6379/1',
        LOG_LEVEL: 'debug'
      },
      
      env_production: {
        NODE_ENV: 'production',
        WS_PORT: 3002,
        API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001',
        REDIS_URL: process.env.REDIS_URL_WS,
        LOG_LEVEL: 'info'
      },
      
      watch: process.env.NODE_ENV === 'development',
      max_memory_restart: '512M',
      
      log_file: './logs/ws-combined.log',
      out_file: './logs/ws-out.log',
      error_file: './logs/ws-error.log',
      
      restart_delay: 2000,
      max_restarts: 5,
      min_uptime: '10s'
    },

    // =================================================================
    // CRON JOBS MANAGER
    // =================================================================
    {
      name: 'smartlock-cron',
      script: 'services/cronService.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://smartlock_user:dev_password@localhost:5432/smartlock',
        REDIS_URL: 'redis://localhost:6379/2',
        LOG_LEVEL: 'info'
      },
      
      env_production: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL_CRON,
        LOG_LEVEL: 'warn',
        
        // Email for notifications
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS
      },
      
      watch: false, // Cron jobs shouldn't restart on file changes
      max_memory_restart: '256M',
      
      log_file: './logs/cron-combined.log',
      out_file: './logs/cron-out.log',
      error_file: './logs/cron-error.log',
      
      restart_delay: 5000,
      max_restarts: 3,
      min_uptime: '30s',
      
      // Cron-specific: restart every 6 hours to prevent memory leaks
      cron_restart: '0 */6 * * *'
    },

    // =================================================================
    // HARDWARE COMMUNICATION SERVICE
    // =================================================================
    {
      name: 'smartlock-hardware',
      script: 'services/hardwareService.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'development',
        HARDWARE_PORT: 8081,
        DATABASE_URL: 'postgresql://smartlock_user:dev_password@localhost:5432/smartlock',
        REDIS_URL: 'redis://localhost:6379/3',
        HARDWARE_TIMEOUT: 5000,
        LOG_LEVEL: 'debug'
      },
      
      env_production: {
        NODE_ENV: 'production',
        HARDWARE_PORT: 8081,
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL_HARDWARE,
        HARDWARE_TIMEOUT: process.env.HARDWARE_TIMEOUT || 5000,
        DEFAULT_UNLOCK_DURATION: process.env.DEFAULT_UNLOCK_DURATION || 30,
        LOG_LEVEL: 'info'
      },
      
      watch: process.env.NODE_ENV === 'development',
      max_memory_restart: '256M',
      
      log_file: './logs/hardware-combined.log',
      out_file: './logs/hardware-out.log',
      error_file: './logs/hardware-error.log',
      
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '15s',
      
      // Hardware service is critical - restart immediately on failure
      autorestart: true,
      kill_timeout: 3000
    }
  ],

  // =================================================================
  // DEPLOYMENT CONFIGURATION
  // =================================================================
  deploy: {
    // Production deployment
    production: {
      user: 'deploy',
      host: ['smartlock-prod-01.universidade.edu.br', 'smartlock-prod-02.universidade.edu.br'],
      ref: 'origin/main',
      repo: 'git@github.com:sua-universidade/smart-lock-system.git',
      path: '/var/www/smartlock',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run migrate:prod && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': 'sudo mkdir -p /var/www/smartlock && sudo chown deploy:deploy /var/www/smartlock',
      'ssh_options': 'StrictHostKeyChecking=no',
      env: {
        NODE_ENV: 'production'
      }
    },

    // Staging deployment
    staging: {
      user: 'deploy',
      host: 'smartlock-staging.universidade.edu.br',
      ref: 'origin/develop',
      repo: 'git@github.com:sua-universidade/smart-lock-system.git',
      path: '/var/www/smartlock-staging',
      'post-deploy': 'npm install && npm run migrate:staging && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  },

  // =================================================================
  // PM2+ MONITORING CONFIGURATION
  // =================================================================
  pmx: {
    network: true,
    ports: true,
    custom_probes: true,
    actions: true
  },

  // =================================================================
  // CUSTOM PM2 SCRIPTS
  // =================================================================
  scripts: {
    // Start all services
    start: 'pm2 start ecosystem.config.js --env production',
    
    // Stop all services
    stop: 'pm2 stop all',
    
    // Restart all services
    restart: 'pm2 restart all',
    
    // Reload all services (zero-downtime)
    reload: 'pm2 reload all',
    
    // Delete all services
    delete: 'pm2 delete all',
    
    // Show status
    status: 'pm2 status',
    
    // Show logs
    logs: 'pm2 logs',
    
    // Monitor
    monitor: 'pm2 monit',
    
    // Save current processes
    save: 'pm2 save',
    
    // Resurrect saved processes
    resurrect: 'pm2 resurrect',
    
    // Generate startup script
    startup: 'pm2 startup',
    
    // Dump current processes to file
    dump: 'pm2 dump > pm2_processes.json',
    
    // Kill PM2 daemon
    kill: 'pm2 kill'
  }
};

// =================================================================
// USAGE EXAMPLES AND COMMANDS
// =================================================================

/*

# BASIC USAGE
pm2 start ecosystem.config.js                    # Start with default env (development)
pm2 start ecosystem.config.js --env production   # Start with production env
pm2 start ecosystem.config.js --env staging      # Start with staging env

# PROCESS MANAGEMENT
pm2 list                                          # List all processes
pm2 status                                        # Show detailed status
pm2 logs                                          # Show all logs
pm2 logs smartlock-api                           # Show logs for specific app
pm2 monit                                         # Open monitoring dashboard

# RESTART STRATEGIES
pm2 restart smartlock-api                        # Restart specific app
pm2 reload smartlock-api                         # Reload with zero-downtime
pm2 gracefulReload smartlock-api                 # Graceful reload
pm2 restart all                                  # Restart all apps

# SCALING
pm2 scale smartlock-api 4                        # Scale to 4 instances
pm2 scale smartlock-api +2                       # Add 2 more instances
pm2 scale smartlock-api -1                       # Remove 1 instance

# MONITORING
pm2 show smartlock-api                           # Show detailed app info
pm2 describe smartlock-api                       # Describe app configuration
pm2 web                                           # Launch web interface (port 9615)

# MEMORY MANAGEMENT
pm2 reset smartlock-api                          # Reset restart counter
pm2 flush                                         # Clear all logs
pm2 reloadLogs                                    # Reload log configuration

# DEPLOYMENT
pm2 deploy ecosystem.config.js production setup  # Setup production deployment
pm2 deploy ecosystem.config.js production        # Deploy to production
pm2 deploy ecosystem.config.js staging           # Deploy to staging

# STARTUP MANAGEMENT
pm2 startup                                       # Generate startup script
pm2 save                                          # Save current process list
pm2 resurrect                                     # Restore saved processes
pm2 unstartup systemd                           # Disable startup script

# PROCESS CONTROL
pm2 stop smartlock-api                           # Stop specific app
pm2 stop all                                     # Stop all apps
pm2 delete smartlock-api                         # Delete specific app
pm2 delete all                                   # Delete all apps
pm2 kill                                          # Kill PM2 daemon

# ENVIRONMENT SPECIFIC
NODE_ENV=production pm2 start ecosystem.config.js
NODE_ENV=staging pm2 start ecosystem.config.js
NODE_ENV=development pm2 start ecosystem.config.js

# ADVANCED MONITORING
pm2 install pm2-logrotate                        # Install log rotation
pm2 set pm2-logrotate:max_size 10M               # Set max log size
pm2 set pm2-logrotate:retain 30                  # Keep 30 rotated logs

pm2 install pm2-server-monit                     # Install server monitoring
pm2 install pm2-auto-pull                        # Auto-pull from git

# HEALTH CHECKS
pm2 ping                                          # Check if PM2 daemon is alive
pm2 sendSignal SIGUSR2 smartlock-api            # Send custom signal

# CLUSTER MODE
pm2 reload smartlock-api                         # Zero-downtime reload in cluster
pm2 scale smartlock-api 0                        # Scale down to 0 (stop)
pm2 scale smartlock-api max                      # Scale to max CPU cores

# DEBUGGING
pm2 logs smartlock-api --lines 100               # Show last 100 log lines
pm2 logs smartlock-api --timestamp               # Show logs with timestamp
pm2 logs smartlock-api --raw                     # Show raw logs
pm2 prettylist                                   # Pretty print process list

*/

// =================================================================
// PRODUCTION CHECKLIST
// =================================================================

/*

BEFORE DEPLOYING TO PRODUCTION:

1. Environment Variables:
   ✓ Set strong JWT_SECRET
   ✓ Configure production DATABASE_URL
   ✓ Set proper REDIS_URL
   ✓ Configure SMTP settings
   ✓ Set appropriate LOG_LEVEL

2. Security:
   ✓ Change default passwords
   ✓ Enable SSL/TLS
   ✓ Configure firewall rules
   ✓ Set up proper user permissions
   ✓ Enable audit logging

3. Performance:
   ✓ Set max_memory_restart appropriately
   ✓ Configure cluster instances
   ✓ Set up log rotation
   ✓ Configure monitoring
   ✓ Set up health checks

4. Monitoring:
   ✓ Install PM2+ or similar
   ✓ Set up alerts
   ✓ Configure log aggregation
   ✓ Set up backup procedures
   ✓ Configure uptime monitoring

5. Backup & Recovery:
   ✓ Database backup strategy
   ✓ Log backup and rotation
   ✓ Configuration backup
   ✓ Recovery procedures testing
   ✓ Disaster recovery plan

6. Testing:
   ✓ Load testing
   ✓ Failover testing
   ✓ Database migration testing
   ✓ Hardware integration testing
   ✓ Security testing

*/