import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';

// Componentes
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

// Hooks
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';

// Utils
import { cn } from '../../utils/helpers';

// =========================================
// COMPONENTE PRINCIPAL DO LAYOUT
// =========================================
const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuth();
  const { isConnected: wsConnected, connectionState } = useWebSocket();

  // =========================================
  // EFEITOS
  // =========================================
  useEffect(() => {
    // Colapsar sidebar automaticamente em telas pequenas
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
        setSidebarOpen(false);
      } else {
        setSidebarCollapsed(false);
      }
    };

    // Listener inicial
    handleResize();
    
    // Listener de resize
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fechar sidebar mobile ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarOpen && window.innerWidth < 1024) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.contains(event.target)) {
          setSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Ctrl/Cmd + B para toggle sidebar
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        if (window.innerWidth >= 1024) {
          setSidebarCollapsed(!sidebarCollapsed);
        } else {
          setSidebarOpen(!sidebarOpen);
        }
      }
      
      // ESC para fechar sidebar mobile
      if (event.key === 'Escape' && sidebarOpen && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [sidebarCollapsed, sidebarOpen]);

  // =========================================
  // HANDLERS
  // =========================================
  const handleSidebarToggle = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  // =========================================
  // RENDER
  // =========================================
  return (
    <>
      <Helmet>
        <body className={cn(
          sidebarOpen && 'overflow-hidden lg:overflow-visible'
        )} />
      </Helmet>

      <div className="min-h-screen bg-gray-50 flex">
        {/* Overlay para mobile */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={handleSidebarClose}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onClose={handleSidebarClose}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Conteúdo Principal */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}>
          {/* Header */}
          <Header
            onSidebarToggle={handleSidebarToggle}
            sidebarCollapsed={sidebarCollapsed}
            wsConnected={wsConnected}
            connectionState={connectionState}
          />

          {/* Área de Conteúdo */}
          <main className="flex-1 relative overflow-hidden">
            <div className="h-full overflow-auto">
              {/* Indicador de conexão WebSocket */}
              {!wsConnected && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-yellow-50 border-b border-yellow-200 px-4 py-2"
                >
                  <div className="flex items-center justify-center text-sm text-yellow-800">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                      <span>
                        Reconectando ao servidor... 
                        <span className="ml-1 text-xs">
                          ({connectionState})
                        </span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Container do conteúdo */}
              <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                >
                  <Outlet />
                </motion.div>
              </div>
            </div>
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </div>

      {/* Portal para modais */}
      <div id="modal-portal" />
      
      {/* Portal para tooltips */}
      <div id="tooltip-portal" />

      {/* Debug info em desenvolvimento */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 z-50 opacity-50 hover:opacity-100 transition-opacity">
          <div className="bg-black text-white text-xs px-2 py-1 rounded font-mono">
            <div>User: {user?.name || 'N/A'}</div>
            <div>WS: {wsConnected ? '🟢' : '🔴'}</div>
            <div>Sidebar: {sidebarCollapsed ? 'Collapsed' : 'Extended'}</div>
            <div>Screen: {window.innerWidth}x{window.innerHeight}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default Layout;