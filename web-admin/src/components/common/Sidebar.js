import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Wrench, 
  BarChart3, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Lock,
  Zap,
  Activity,
  Bell,
  HelpCircle,
  LogOut
} from 'lucide-react';

// Hooks
import { useAuth } from '../../hooks/useAuth';

// Utils
import { cn } from '../../utils/helpers';
import { APP_ROUTES } from '../../utils/constants';

// =========================================
// CONFIGURAÇÃO DOS ITENS DO MENU
// =========================================
const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: APP_ROUTES.DASHBOARD,
    icon: LayoutDashboard,
    badge: null,
    description: 'Visão geral do sistema'
  },
  {
    id: 'cabinets',
    label: 'Armários',
    path: APP_ROUTES.CABINETS,
    icon: Package,
    badge: 'count',
    description: 'Gerenciar armários e lockers'
  },
  {
    id: 'users',
    label: 'Usuários',
    path: APP_ROUTES.USERS,
    icon: Users,
    badge: 'active',
    description: 'Gerenciar usuários do sistema'
  },
  {
    id: 'equipment',
    label: 'Equipamentos',
    path: APP_ROUTES.EQUIPMENT,
    icon: Wrench,
    badge: null,
    description: 'Controlar equipamentos cadastrados'
  },
  {
    id: 'reports',
    label: 'Relatórios',
    path: APP_ROUTES.REPORTS,
    icon: BarChart3,
    badge: null,
    description: 'Visualizar relatórios e estatísticas'
  },
  {
    id: 'settings',
    label: 'Configurações',
    path: APP_ROUTES.SETTINGS,
    icon: Settings,
    badge: null,
    description: 'Configurações do sistema'
  }
];

const bottomMenuItems = [
  {
    id: 'help',
    label: 'Ajuda',
    path: '/help',
    icon: HelpCircle,
    description: 'Central de ajuda e documentação'
  }
];

// =========================================
// COMPONENTE SIDEBAR
// =========================================
const Sidebar = ({ 
  isOpen, 
  isCollapsed, 
  onClose, 
  onToggleCollapse 
}) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({
    totalCabinets: 0,
    activeUsers: 0,
    onlineDevices: 0
  });

  // =========================================
  // EFEITOS
  // =========================================
  useEffect(() => {
    // Simular carregamento de estatísticas
    // Em produção, isso viria de uma API
    const loadStats = () => {
      setStats({
        totalCabinets: 12,
        activeUsers: 145,
        onlineDevices: 11
      });
    };

    loadStats();
    
    // Atualizar stats a cada 30 segundos
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // =========================================
  // HANDLERS
  // =========================================
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const getBadgeValue = (type) => {
    switch (type) {
      case 'count':
        return stats.totalCabinets;
      case 'active':
        return stats.activeUsers;
      default:
        return null;
    }
  };

  // =========================================
  // RENDER
  // =========================================
  return (
    <>
      {/* Sidebar Desktop/Mobile */}
      <motion.aside
        id="sidebar"
        initial={false}
        animate={{
          x: isOpen || window.innerWidth >= 1024 ? 0 : -100,
          width: isCollapsed ? 64 : 256
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn(
          "fixed lg:relative top-0 left-0 z-50 h-full bg-white border-r border-gray-200",
          "flex flex-col shadow-lg lg:shadow-none",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header do Sidebar */}
        <div className={cn(
          "flex items-center justify-between p-4 border-b border-gray-200",
          isCollapsed && "justify-center"
        )}>
          {/* Logo */}
          <motion.div 
            className="flex items-center space-x-3"
            animate={{ opacity: isCollapsed ? 0 : 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-white" />
              </div>
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="text-lg font-bold text-gray-900">Smart Lock</h1>
                <p className="text-xs text-gray-500">Admin Dashboard</p>
              </div>
            )}
          </motion.div>

          {/* Toggle Button - Desktop */}
          <button
            onClick={onToggleCollapse}
            className={cn(
              "hidden lg:flex items-center justify-center w-6 h-6 rounded",
              "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
              "transition-colors duration-200",
              isCollapsed && "ml-0"
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Close Button - Mobile */}
          <button
            onClick={onClose}
            className="lg:hidden text-gray-400 hover:text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Status do Sistema */}
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 py-3 bg-gray-50 border-b border-gray-200"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Status do Sistema</span>
              <div className="flex items-center space-x-1">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  wsConnected ? "bg-green-500" : "bg-red-500"
                )} />
                <span className={cn(
                  "font-medium",
                  wsConnected ? "text-green-600" : "text-red-600"
                )}>
                  {wsConnected ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            
            {wsConnected && (
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center space-x-1 text-gray-500">
                  <Zap className="w-3 h-3" />
                  <span>Dispositivos</span>
                </div>
                <span className="text-gray-900 font-medium">
                  {stats.onlineDevices}/{stats.totalCabinets}
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Navegação Principal */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            const badgeValue = getBadgeValue(item.badge);

            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive: linkActive }) => cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-lg",
                  "transition-all duration-200 relative",
                  linkActive || isActive
                    ? "bg-blue-50 text-blue-700 border-r-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
                onClick={() => window.innerWidth < 1024 && onClose()}
              >
                <Icon className={cn(
                  "flex-shrink-0 w-5 h-5 transition-colors duration-200",
                  isCollapsed ? "mr-0" : "mr-3",
                  isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-500"
                )} />
                
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between flex-1 min-w-0"
                    >
                      <span className="truncate">{item.label}</span>
                      
                      {/* Badge */}
                      {badgeValue && (
                        <span className={cn(
                          "ml-2 px-2 py-0.5 text-xs font-medium rounded-full",
                          isActive 
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        )}>
                          {badgeValue}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tooltip para sidebar colapsada */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {item.label}
                    {badgeValue && (
                      <span className="ml-1 text-gray-300">({badgeValue})</span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Menu Inferior */}
        <div className="px-4 py-4 border-t border-gray-200 space-y-1">
          {/* Itens do menu inferior */}
          {bottomMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-lg",
                  "transition-all duration-200 relative",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                <Icon className={cn(
                  "flex-shrink-0 w-5 h-5",
                  isCollapsed ? "mr-0" : "mr-3",
                  "text-gray-400 group-hover:text-gray-500"
                )} />
                
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}

                {/* Tooltip para sidebar colapsada */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}

          {/* Perfil do Usuário */}
          <div className={cn(
            "mt-4 pt-4 border-t border-gray-200",
            isCollapsed && "text-center"
          )}>
            {!isCollapsed ? (
              // Perfil expandido
              <div className="space-y-3">
                <div className="flex items-center space-x-3 px-3 py-2">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.name || 'Administrador'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email || 'admin@universidade.edu'}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="w-full group flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                >
                  <LogOut className="flex-shrink-0 w-5 h-5 mr-3 text-gray-400 group-hover:text-red-500" />
                  Sair
                </button>
              </div>
            ) : (
              // Perfil colapsado
              <div className="space-y-2">
                <button className="w-full flex justify-center relative group">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {user?.name || 'Administrador'}
                  </div>
                </button>
                
                <button
                  onClick={handleLogout}
                  className="w-full flex justify-center relative group text-gray-400 hover:text-red-500 transition-colors duration-200"
                >
                  <LogOut className="w-5 h-5" />
                  
                  {/* Tooltip */}
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    Sair
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Indicador de versão */}
        {!isCollapsed && (
          <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>v{process.env.REACT_APP_VERSION || '1.0.0'}</span>
              <div className="flex items-center space-x-1">
                <Activity className="w-3 h-3" />
                <span>Sistema Ativo</span>
              </div>
            </div>
          </div>
        )}
      </motion.aside>
    </>
  );
};

export default Sidebar;