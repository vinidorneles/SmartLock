import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';

// Hooks customizados
import { useAuth } from './hooks/useAuth';
import { useWebSocket } from './hooks/useWebSocket';

// Componentes principais
import Layout from './components/common/Layout';
import Loading from './components/common/Loading';
import ProtectedRoute from './components/common/ProtectedRoute';

// Lazy loading das páginas
const LoginPage = React.lazy(() => import('./pages/Login'));
const DashboardPage = React.lazy(() => import('./pages/Dashboard'));
const CabinetsPage = React.lazy(() => import('./pages/Cabinets'));
const UsersPage = React.lazy(() => import('./pages/Users'));
const EquipmentPage = React.lazy(() => import('./pages/Equipment'));
const ReportsPage = React.lazy(() => import('./pages/Reports'));
const SettingsPage = React.lazy(() => import('./pages/Settings'));
const NotFoundPage = React.lazy(() => import('./pages/NotFound'));

// Contextos
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';

// Configurações
import { APP_ROUTES } from './utils/constants';

// =========================================
// COMPONENTE PRINCIPAL DA APLICAÇÃO
// =========================================
const App = () => {
  const location = useLocation();
  
  // =========================================
  // EFEITOS DE INICIALIZAÇÃO
  // =========================================
  useEffect(() => {
    // Log da navegação em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.log('📍 Navegando para:', location.pathname);
    }
    
    // Analytics de página (produção)
    if (window.gtag && process.env.NODE_ENV === 'production') {
      window.gtag('config', process.env.REACT_APP_GOOGLE_ANALYTICS_ID, {
        page_path: location.pathname
      });
    }
    
    // Scroll para o topo em mudança de rota
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <>
      {/* Meta tags dinâmicas */}
      <Helmet
        defaultTitle="Smart Lock Admin"
        titleTemplate="%s | Smart Lock Admin"
      >
        <meta name="description" content="Sistema administrativo para gerenciamento de armários inteligentes" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="canonical" href={`${window.location.origin}${location.pathname}`} />
      </Helmet>

      {/* Providers da aplicação */}
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <NotificationProvider>
              <AppContent />
            </NotificationProvider>
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
};

// =========================================
// COMPONENTE DE CONTEÚDO PRINCIPAL
// =========================================
const AppContent = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  
  // Conectar WebSocket apenas se autenticado
  useWebSocket(isAuthenticated);

  // Loading inicial da aplicação
  if (isLoading) {
    return <Loading message="Verificando autenticação..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AnimatePresence mode="wait">
        <Suspense 
          fallback={
            <Loading 
              message="Carregando página..." 
              className="min-h-screen" 
            />
          }
        >
          <Routes location={location} key={location.pathname}>
            {/* Rota de Login */}
            <Route 
              path={APP_ROUTES.LOGIN} 
              element={
                <PublicRoute>
                  <PageTransition>
                    <LoginPage />
                  </PageTransition>
                </PublicRoute>
              } 
            />
            
            {/* Rotas Protegidas */}
            <Route path="/" element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                {/* Dashboard */}
                <Route 
                  index 
                  element={
                    <Navigate to={APP_ROUTES.DASHBOARD} replace />
                  } 
                />
                
                <Route 
                  path={APP_ROUTES.DASHBOARD} 
                  element={
                    <PageTransition>
                      <DashboardPage />
                    </PageTransition>
                  } 
                />
                
                {/* Armários */}
                <Route 
                  path={`${APP_ROUTES.CABINETS}/*`} 
                  element={
                    <PageTransition>
                      <CabinetsPage />
                    </PageTransition>
                  } 
                />
                
                {/* Usuários */}
                <Route 
                  path={`${APP_ROUTES.USERS}/*`} 
                  element={
                    <PageTransition>
                      <UsersPage />
                    </PageTransition>
                  } 
                />
                
                {/* Equipamentos */}
                <Route 
                  path={`${APP_ROUTES.EQUIPMENT}/*`} 
                  element={
                    <PageTransition>
                      <EquipmentPage />
                    </PageTransition>
                  } 
                />
                
                {/* Relatórios */}
                <Route 
                  path={`${APP_ROUTES.REPORTS}/*`} 
                  element={
                    <PageTransition>
                      <ReportsPage />
                    </PageTransition>
                  } 
                />
                
                {/* Configurações */}
                <Route 
                  path={`${APP_ROUTES.SETTINGS}/*`} 
                  element={
                    <PageTransition>
                      <SettingsPage />
                    </PageTransition>
                  } 
                />
              </Route>
            </Route>
            
            {/* Rota 404 */}
            <Route 
              path="*" 
              element={
                <PageTransition>
                  <NotFoundPage />
                </PageTransition>
              } 
            />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </div>
  );
};

// =========================================
// COMPONENTE DE ROTA PÚBLICA
// =========================================
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  // Se já está autenticado, redireciona para dashboard
  if (isAuthenticated) {
    return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
  }
  
  return children;
};

// =========================================
// COMPONENTE DE TRANSIÇÃO DE PÁGINA
// =========================================
const PageTransition = ({ children }) => {
  const location = useLocation();
  
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 0.2,
        ease: 'easeInOut'
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
};

export default App;