import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Search,
  Bell,
  Settings,
  User,
  LogOut,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronDown,
  Clock,
  MapPin
} from 'lucide-react';

// Hooks
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useNotifications } from '../../hooks/useNotifications';

// Utils
import { cn, formatDate } from '../../utils/helpers';
import { APP_ROUTES } from '../../utils/constants';

// =========================================
// COMPONENTE HEADER
// =========================================
const Header = ({ 
  onSidebarToggle, 
  sidebarCollapsed, 
  wsConnected, 
  connectionState 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  
  // Estados locais
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Refs
  const userMenuRef = useRef(null);
  const notificationRef = useRef(null);
  const searchRef = useRef(null);

  // =========================================
  // EFEITOS
  // =========================================
  
  // Atualizar relógio
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fechar menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Ctrl/Cmd + K para focus na busca
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      
      // ESC para fechar menus
      if (event.key === 'Escape') {
        setShowUserMenu(false);
        setShowNotifications(false);
        searchRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  // =========================================
  // HANDLERS
  // =========================================
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
    setShowNotifications(false);
  };

  // Obter título da página atual
  const getPageTitle = () => {
    const pathMap = {
      [APP_ROUTES.DASHBOARD]: 'Dashboard',
      [APP_ROUTES.CABINETS]: 'Armários',
      [APP_ROUTES.USERS]: 'Usuários', 
      [APP_ROUTES.EQUIPMENT]: 'Equipamentos',
      [APP_ROUTES.REPORTS]: 'Relatórios',
      [APP_ROUTES.SETTINGS]: 'Configurações'
    };

    for (const [path, title] of Object.entries(pathMap)) {
      if (location.pathname.startsWith(path)) {
        return title;
      }
    }
    
    return 'Smart Lock Admin';
  };

  // =========================================
  // RENDER
  // =========================================
  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between h-12">
        {/* Lado Esquerdo */}
        <div className="flex items-center space-x-4">
          {/* Toggle Sidebar */}
          <button
            onClick={onSidebarToggle}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Título da Página */}
          <div className="hidden sm:block">
            <h2 className="text-xl font-semibold text-gray-900">
              {getPageTitle()}
            </h2>
            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-0.5">
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>{formatDate(currentTime, 'dd/MM/yyyy HH:mm:ss')}</span>
              </div>
              <div className="flex items-center space-x-1">
                <MapPin className="w-3 h-3" />
                <span>Curitiba, PR</span>
              </div>
            </div>
          </div>
        </div>

        {/* Centro - Busca */}
        <div className="hidden md:block flex-1 max-w-md mx-8">
          <form onSubmit={handleSearch} className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Buscar usuários, armários... (Ctrl+K)"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <kbd className="hidden lg:inline-flex items-center px-2 py-1 border border-gray-200 rounded text-xs font-medium text-gray-400 bg-gray-50">
                ⌘K
              </kbd>
            </div>
          </form>
        </div>

        {/* Lado Direito */}
        <div className="flex items-center space-x-2">
          {/* Status de Conexão */}
          <div className="hidden sm:flex items-center space-x-2">
            <div className={cn(
              "flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium",
              wsConnected 
                ? "bg-green-100 text-green-700" 
                : "bg-red-100 text-red-700"
            )}>
              {wsConnected ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              <span className="hidden lg:inline">
                {wsConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>

          {/* Toggle Tema */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200"
            title={`Alternar para tema ${theme === 'light' ? 'escuro' : 'claro'}`}
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>

          {/* Notificações */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown de Notificações */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                >
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900">Notificações</h3>
                      {unreadCount > 0 && (
                        <span className="text-xs text-blue-600 font-medium">
                          {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 5).map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            "p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0",
                            !notification.read && "bg-blue-50"
                          )}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={cn(
                              "flex-shrink-0 w-2 h-2 rounded-full mt-2",
                              notification.type === 'success' && "bg-green-500",
                              notification.type === 'warning' && "bg-yellow-500",
                              notification.type === 'error' && "bg-red-500",
                              notification.type === 'info' && "bg-blue-500"
                            )} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatDate(notification.createdAt, 'dd/MM/yyyy HH:mm')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        Nenhuma notificação
                      </div>
                    )}
                  </div>

                  {notifications.length > 5 && (
                    <div className="p-3 border-t border-gray-200">
                      <button
                        onClick={() => {
                          navigate('/notifications');
                          setShowNotifications(false);
                        }}
                        className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Ver todas as notificações
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Menu do Usuário */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-200"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">
                  {user?.name || 'Administrador'}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.role || 'Administrador'}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {/* Dropdown do Usuário */}
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                >
                  {/* Cabeçalho do menu */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-medium">
                        {user?.name?.charAt(0)?.toUpperCase() || 'A'}
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
                  </div>

                  {/* Itens do menu */}
                  <div className="p-2">
                    <button
                      onClick={() => {
                        navigate('/profile');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                    >
                      <User className="w-4 h-4 text-gray-400" />
                      <span>Meu Perfil</span>
                    </button>

                    <button
                      onClick={() => {
                        navigate(APP_ROUTES.SETTINGS);
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                    >
                      <Settings className="w-4 h-4 text-gray-400" />
                      <span>Configurações</span>
                    </button>

                    <div className="border-t border-gray-200 my-2" />

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    >
                      <LogOut className="w-4 h-4 text-red-500" />
                      <span>Sair</span>
                    </button>
                  </div>

                  {/* Footer do menu */}
                  <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>v{process.env.REACT_APP_VERSION || '1.0.0'}</span>
                      <div className="flex items-center space-x-1">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          wsConnected ? "bg-green-500" : "bg-red-500"
                        )} />
                        <span>{wsConnected ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Busca Mobile */}
      <AnimatePresence>
        <motion.div
          initial={false}
          className="md:hidden mt-3"
        >
          <form onSubmit={handleSearch} className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Buscar..."
            />
          </form>
        </motion.div>
      </AnimatePresence>
    </header>
)}