import React from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Users, 
  Wrench, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap
} from 'lucide-react';

// Utils
import { cn, formatNumber, formatPercentage } from '../../utils/helpers';

// =========================================
// DADOS MOCK (em produção viria da API)
// =========================================
const mockStats = {
  totalCabinets: 12,
  activeCabinets: 11,
  totalLockers: 144,
  occupiedLockers: 87,
  totalUsers: 1250,
  activeUsers: 145,
  totalEquipment: 432,
  availableEquipment: 298,
  maintenanceAlerts: 3,
  systemUptime: 99.8,
  todayTransactions: 67,
  avgUsageTime: 4.2
};

// =========================================
// CONFIGURAÇÃO DOS CARDS
// =========================================
const cardConfigs = [
  {
    id: 'cabinets',
    title: 'Armários',
    value: mockStats.activeCabinets,
    total: mockStats.totalCabinets,
    icon: Package,
    color: 'blue',
    description: 'Armários online',
    trend: {
      value: 2.1,
      direction: 'up',
      period: 'vs. semana passada'
    },
    details: [
      { label: 'Total de Lockers', value: mockStats.totalLockers },
      { label: 'Ocupados', value: mockStats.occupiedLockers },
      { label: 'Taxa de Ocupação', value: `${Math.round((mockStats.occupiedLockers / mockStats.totalLockers) * 100)}%` }
    ]
  },
  {
    id: 'users',
    title: 'Usuários',
    value: mockStats.activeUsers,
    total: mockStats.totalUsers,
    icon: Users,
    color: 'green',
    description: 'Usuários ativos hoje',
    trend: {
      value: 12.5,
      direction: 'up',
      period: 'vs. ontem'
    },
    details: [
      { label: 'Novos hoje', value: 8 },
      { label: 'Total cadastrados', value: mockStats.totalUsers },
      { label: 'Taxa de atividade', value: `${Math.round((mockStats.activeUsers / mockStats.totalUsers) * 100)}%` }
    ]
  },
  {
    id: 'equipment',
    title: 'Equipamentos',
    value: mockStats.availableEquipment,
    total: mockStats.totalEquipment,
    icon: Wrench,
    color: 'purple',
    description: 'Equipamentos disponíveis',
    trend: {
      value: 5.3,
      direction: 'down',
      period: 'equipamentos em manutenção'
    },
    details: [
      { label: 'Em uso', value: mockStats.totalEquipment - mockStats.availableEquipment },
      { label: 'Manutenção', value: mockStats.maintenanceAlerts },
      { label: 'Disponibilidade', value: `${Math.round((mockStats.availableEquipment / mockStats.totalEquipment) * 100)}%` }
    ]
  },
  {
    id: 'system',
    title: 'Sistema',
    value: mockStats.systemUptime,
    format: 'percentage',
    icon: Activity,
    color: 'indigo',
    description: 'Uptime do sistema',
    trend: {
      value: 0.2,
      direction: 'up',
      period: 'vs. mês passado'
    },
    details: [
      { label: 'Transações hoje', value: mockStats.todayTransactions },
      { label: 'Tempo médio uso', value: `${mockStats.avgUsageTime}h` },
      { label: 'Alertas ativos', value: mockStats.maintenanceAlerts }
    ]
  }
];

// =========================================
// COMPONENTE INDIVIDUAL DO CARD
// =========================================
const DashboardCard = ({ config, index }) => {
  const Icon = config.icon;
  
  // Configuração de cores por tipo
  const colorConfig = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      border: 'border-blue-200',
      trend: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'text-green-600',
      border: 'border-green-200',
      trend: 'text-green-600'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      border: 'border-purple-200',
      trend: 'text-purple-600'
    },
    indigo: {
      bg: 'bg-indigo-50',
      icon: 'text-indigo-600',
      border: 'border-indigo-200',
      trend: 'text-indigo-600'
    }
  };

  const colors = colorConfig[config.color] || colorConfig.blue;
  
  // Formatar valor principal
  const formatValue = (value, format) => {
    switch (format) {
      case 'percentage':
        return `${value}%`;
      default:
        return formatNumber(value);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-300 group"
    >
      {/* Header do Card */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={cn(
            "p-3 rounded-lg",
            colors.bg,
            colors.border,
            "border group-hover:scale-110 transition-transform duration-300"
          )}>
            <Icon className={cn("w-6 h-6", colors.icon)} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">
              {config.title}
            </h3>
            <p className="text-xs text-gray-400">
              {config.description}
            </p>
          </div>
        </div>

        {/* Status indicator */}
        <div className={cn(
          "w-2 h-2 rounded-full",
          config.id === 'system' && mockStats.systemUptime > 99 ? 'bg-green-500' :
          config.id === 'equipment' && mockStats.maintenanceAlerts > 0 ? 'bg-yellow-500' :
          'bg-green-500'
        )} />
      </div>

      {/* Valor Principal */}
      <div className="mb-4">
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold text-gray-900">
            {formatValue(config.value, config.format)}
          </span>
          {config.total && (
            <span className="text-lg text-gray-400">
              / {formatNumber(config.total)}
            </span>
          )}
        </div>
        
        {/* Barra de progresso (se aplicável) */}
        {config.total && (
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(config.value / config.total) * 100}%` }}
              transition={{ duration: 1, delay: index * 0.1 }}
              className={cn(
                "h-2 rounded-full",
                config.color === 'blue' && 'bg-blue-500',
                config.color === 'green' && 'bg-green-500',
                config.color === 'purple' && 'bg-purple-500',
                config.color === 'indigo' && 'bg-indigo-500'
              )}
            />
          </div>
        )}
      </div>

      {/* Trend */}
      {config.trend && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-1">
            {config.trend.direction === 'up' ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={cn(
              "text-sm font-medium",
              config.trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
            )}>
              {config.trend.direction === 'up' ? '+' : '-'}{config.trend.value}%
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {config.trend.period}
          </span>
        </div>
      )}

      {/* Detalhes */}
      <div className="space-y-2">
        {config.details.map((detail, detailIndex) => (
          <div key={detailIndex} className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{detail.label}</span>
            <span className="font-medium text-gray-900">{detail.value}</span>
          </div>
        ))}
      </div>

      {/* Ação rápida */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <button className={cn(
          "w-full text-sm font-medium py-2 px-3 rounded-lg transition-colors duration-200",
          colors.trend,
          "hover:bg-gray-50"
        )}>
          Ver detalhes
        </button>
      </div>
    </motion.div>
  );
};

// =========================================
// COMPONENTE PRINCIPAL
// =========================================
const DashboardCards = ({ className = '' }) => {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", className)}>
      {cardConfigs.map((config, index) => (
        <DashboardCard 
          key={config.id} 
          config={config} 
          index={index} 
        />
      ))}
    </div>
  );
};

// =========================================
// COMPONENTE DE ALERTAS DO SISTEMA
// =========================================
export const SystemAlerts = () => {
  const alerts = [
    {
      id: 1,
      type: 'warning',
      title: 'Manutenção Programada',
      message: 'Armário B-12 necessita manutenção preventiva',
      time: '2 horas atrás',
      action: 'Agendar'
    },
    {
      id: 2,
      type: 'success',
      title: 'Backup Concluído',
      message: 'Backup automático realizado com sucesso',
      time: '6 horas atrás',
      action: null
    },
    {
      id: 3,
      type: 'error',
      title: 'Falha de Conexão',
      message: 'Armário C-05 offline há 15 minutos',
      time: '15 minutos atrás',
      action: 'Verificar'
    }
  ];

  const getAlertIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Alertas do Sistema</h3>
        <div className="flex items-center space-x-1 text-sm text-gray-500">
          <Activity className="w-4 h-4" />
          <span>{alerts.length} alertas</span>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map((alert, index) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "flex items-start space-x-3 p-3 rounded-lg border",
              alert.type === 'success' && 'bg-green-50 border-green-200',
              alert.type === 'warning' && 'bg-yellow-50 border-yellow-200',
              alert.type === 'error' && 'bg-red-50 border-red-200',
              alert.type === 'info' && 'bg-blue-50 border-blue-200'
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getAlertIcon(alert.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">
                  {alert.title}
                </h4>
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{alert.time}</span>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mt-1">
                {alert.message}
              </p>
              
              {alert.action && (
                <button className={cn(
                  "mt-2 text-xs font-medium px-3 py-1 rounded-full transition-colors duration-200",
                  alert.type === 'success' && 'bg-green-100 text-green-700 hover:bg-green-200',
                  alert.type === 'warning' && 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
                  alert.type === 'error' && 'bg-red-100 text-red-700 hover:bg-red-200',
                  alert.type === 'info' && 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                )}>
                  {alert.action}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Ver todos os alertas */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200">
          Ver todos os alertas
        </button>
      </div>
    </div>
  );
};

// =========================================
// COMPONENTE DE ESTATÍSTICAS RÁPIDAS
// =========================================
export const QuickStats = () => {
  const stats = [
    {
      label: 'Transações Hoje',
      value: mockStats.todayTransactions,
      icon: Zap,
      color: 'text-blue-600'
    },
    {
      label: 'Tempo Médio de Uso',
      value: `${mockStats.avgUsageTime}h`,
      icon: Clock,
      color: 'text-green-600'
    },
    {
      label: 'Uptime',
      value: `${mockStats.systemUptime}%`,
      icon: Activity,
      color: 'text-purple-600'
    },
    {
      label: 'Alertas',
      value: mockStats.maintenanceAlerts,
      icon: AlertTriangle,
      color: mockStats.maintenanceAlerts > 0 ? 'text-red-600' : 'text-green-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className="bg-white rounded-lg border border-gray-200 p-4 text-center hover:shadow-md transition-shadow duration-300"
        >
          <div className="flex items-center justify-center mb-2">
            <stat.icon className={cn("w-5 h-5", stat.color)} />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {stat.value}
          </div>
          <div className="text-xs text-gray-500">
            {stat.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default DashboardCards;