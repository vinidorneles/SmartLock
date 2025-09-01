import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  User, 
  Package, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  CheckCircle2, 
  Settings,
  RefreshCw,
  Filter,
  Eye,
  MoreHorizontal,
  ExternalLink
} from 'lucide-react';

// Utils
import { cn, formatDate, timeAgo } from '../../utils/helpers';

// =========================================
// TIPOS DE ATIVIDADE
// =========================================
const ACTIVITY_TYPES = {
  LOCKER_OPEN: {
    icon: Unlock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Abertura de Locker'
  },
  LOCKER_CLOSE: {
    icon: Lock,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Fechamento de Locker'
  },
  USER_LOGIN: {
    icon: User,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    label: 'Login de Usuário'
  },
  EQUIPMENT_CHECKOUT: {
    icon: Package,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    label: 'Retirada de Equipamento'
  },
  EQUIPMENT_RETURN: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Devolução de Equipamento'
  },
  SYSTEM_ALERT: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Alerta do Sistema'
  },
  MAINTENANCE: {
    icon: Settings,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Manutenção'
  }
};

// =========================================
// DADOS MOCK DE ATIVIDADES
// =========================================
const generateMockActivities = () => {
  const activities = [];
  const users = ['João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Oliveira', 'Carlos Lima'];
  const cabinets = ['A-01', 'A-02', 'B-12', 'C-05', 'D-08'];
  const equipment = ['Notebook Dell', 'Tablet Samsung', 'Câmera Canon', 'Projetor Epson', 'Microscópio'];
  
  for (let i = 0; i < 50; i++) {
    const types = Object.keys(ACTIVITY_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    const cabinet = cabinets[Math.floor(Math.random() * cabinets.length)];
    const equipmentItem = equipment[Math.floor(Math.random() * equipment.length)];
    
    activities.push({
      id: i + 1,
      type,
      user,
      cabinet,
      equipment: type.includes('EQUIPMENT') ? equipmentItem : null,
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      duration: type.includes('LOCKER') ? Math.floor(Math.random() * 240) + 30 : null,
      success: Math.random() > 0.1, // 90% de sucesso
      ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
      details: generateActivityDetails(type, user, cabinet, equipmentItem)
    });
  }
  
  return activities.sort((a, b) => b.timestamp - a.timestamp);
};

const generateActivityDetails = (type, user, cabinet, equipment) => {
  switch (type) {
    case 'LOCKER_OPEN':
      return `${user} abriu o locker ${cabinet}`;
    case 'LOCKER_CLOSE':
      return `${user} fechou o locker ${cabinet}`;
    case 'USER_LOGIN':
      return `${user} fez login no sistema`;
    case 'EQUIPMENT_CHECKOUT':
      return `${user} retirou ${equipment} do armário ${cabinet}`;
    case 'EQUIPMENT_RETURN':
      return `${user} devolveu ${equipment} ao armário ${cabinet}`;
    case 'SYSTEM_ALERT':
      return `Alerta: Problema detectado no armário ${cabinet}`;
    case 'MAINTENANCE':
      return `Manutenção realizada no armário ${cabinet}`;
    default:
      return `Atividade de ${user}`;
  }
};

// =========================================
// COMPONENTE PRINCIPAL
// =========================================
const ActivityFeed = ({ className = '', maxItems = 20 }) => {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showDetails, setShowDetails] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(true);

  // =========================================
  // EFEITOS
  // =========================================
  useEffect(() => {
    loadActivities();
  }, []);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadActivities(false);
    }, 30000); // Atualiza a cada 30 segundos

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // =========================================
  // HANDLERS
  // =========================================
  const loadActivities = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    
    try {
      // Simular chamada de API
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const newActivities = generateMockActivities();
      setActivities(newActivities.slice(0, maxItems));
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadActivities();
  };

  const toggleDetails = (activityId) => {
    setShowDetails(prev => ({
      ...prev,
      [activityId]: !prev[activityId]
    }));
  };

  // Filtrar atividades
  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    return activity.type === filter;
  });

  // =========================================
  // RENDER DE ITEM DE ATIVIDADE
  // =========================================
  const ActivityItem = ({ activity, index }) => {
    const config = ACTIVITY_TYPES[activity.type];
    const Icon = config.icon;
    const isExpanded = showDetails[activity.id];

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={cn(
          "border rounded-lg p-4 transition-all duration-200",
          activity.success 
            ? "border-gray-200 hover:border-gray-300 bg-white" 
            : "border-red-200 bg-red-50",
          "hover:shadow-sm"
        )}
      >
        <div className="flex items-start space-x-3">
          {/* Ícone */}
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
            config.bgColor,
            config.borderColor,
            "border"
          )}>
            <Icon className={cn("w-5 h-5", config.color)} />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-medium text-gray-900">
                  {config.label}
                </h4>
                {!activity.success && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Falha
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {timeAgo(activity.timestamp)}
                </span>
                <button
                  onClick={() => toggleDetails(activity.id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-600 mt-1">
              {activity.details}
            </p>

            {/* Tags */}
            <div className="flex items-center space-x-2 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {activity.user}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {activity.cabinet}
              </span>
              {activity.equipment && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {activity.equipment}
                </span>
              )}
            </div>

            {/* Detalhes Expandidos */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 pt-3 border-t border-gray-100"
                >
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">Timestamp:</span>
                      <p className="font-medium text-gray-900">
                        {formatDate(activity.timestamp, 'dd/MM/yyyy HH:mm:ss')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">IP Address:</span>
                      <p className="font-medium text-gray-900">{activity.ip}</p>
                    </div>
                    {activity.duration && (
                      <div>
                        <span className="text-gray-500">Duração:</span>
                        <p className="font-medium text-gray-900">
                          {Math.floor(activity.duration / 60)}h {activity.duration % 60}m
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <p className={cn(
                        "font-medium",
                        activity.success ? "text-green-600" : "text-red-600"
                      )}>
                        {activity.success ? 'Sucesso' : 'Falha'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex space-x-2">
                    <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1">
                      <Eye className="w-3 h-3" />
                      <span>Ver detalhes</span>
                    </button>
                    <button className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1">
                      <ExternalLink className="w-3 h-3" />
                      <span>Logs completos</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  };

  // =========================================
  // RENDER PRINCIPAL
  // =========================================
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200", className)}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>Atividade Recente</span>
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Últimas {filteredActivities.length} atividades do sistema
            </p>
          </div>

          {/* Controles */}
          <div className="flex items-center space-x-2">
            {/* Filtro */}
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas</option>
                <option value="LOCKER_OPEN">Aberturas</option>
                <option value="LOCKER_CLOSE">Fechamentos</option>
                <option value="USER_LOGIN">Logins</option>
                <option value="EQUIPMENT_CHECKOUT">Retiradas</option>
                <option value="EQUIPMENT_RETURN">Devoluções</option>
                <option value="SYSTEM_ALERT">Alertas</option>
                <option value="MAINTENANCE">Manutenção</option>
              </select>
              <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200",
                autoRefresh
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <RefreshCw className={cn(
                "w-4 h-4",
                autoRefresh && "animate-spin"
              )} />
              <span className="hidden sm:inline">
                {autoRefresh ? 'Auto' : 'Manual'}
              </span>
            </button>

            {/* Refresh Manual */}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
            >
              <RefreshCw className={cn(
                "w-4 h-4",
                isLoading && "animate-spin"
              )} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Atividades */}
      <div className="p-6">
        {isLoading ? (
          // Loading skeleton
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-pulse flex items-start space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="flex space-x-2">
                    <div className="h-5 bg-gray-200 rounded-full w-16"></div>
                    <div className="h-5 bg-gray-200 rounded-full w-12"></div>
                  </div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : filteredActivities.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredActivities.map((activity, index) => (
                <ActivityItem 
                  key={activity.id} 
                  activity={activity} 
                  index={index} 
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma atividade encontrada
            </h4>
            <p className="text-gray-500">
              {filter === 'all' 
                ? 'Não há atividades recentes para exibir.'
                : 'Nenhuma atividade encontrada para o filtro selecionado.'
              }
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Limpar filtro
              </button>
            )}
          </div>
        )}

        {/* Indicador de Auto Refresh */}
        {autoRefresh && filteredActivities.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 flex items-center justify-center text-xs text-gray-500"
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Atualizando automaticamente a cada 30 segundos</span>
            </div>
          </motion.div>
        )}

        {/* Botão Ver Mais */}
        {filteredActivities.length >= maxItems && (
          <div className="mt-6 text-center">
            <button className="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors duration-200">
              Ver todas as atividades
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;