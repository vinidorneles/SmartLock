import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';

// Componentes
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';

// Estilos
import './index.css';

// Configurações
import { isDevelopment, isProduction } from './utils/constants';

// =========================================
// CONFIGURAÇÃO DO REACT QUERY
// =========================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache por 5 minutos
      staleTime: 5 * 60 * 1000,
      // Manter cache por 10 minutos
      cacheTime: 10 * 60 * 1000,
      // Retry apenas 1 vez em caso de erro
      retry: 1,
      // Refetch on window focus apenas em produção
      refetchOnWindowFocus: isProduction,
      // Refetch on reconnect
      refetchOnReconnect: true,
      // Mostrar erros em background
      notifyOnChangeProps: 'tracked'
    },
    mutations: {
      // Retry mutations apenas 1 vez
      retry: 1,
      // Timeout de 30 segundos para mutations
      timeout: 30000
    }
  }
});

// =========================================
// CONFIGURAÇÃO DE ERRO GLOBAL
// =========================================
const handleGlobalError = (error, errorInfo) => {
  console.error('🚨 Erro Global Capturado:', error);
  console.error('ℹ️ Informações do Erro:', errorInfo);
  
  // Em produção, enviar erro para serviço de monitoramento
  if (isProduction && window.Sentry) {
    window.Sentry.captureException(error, {
      contexts: {
        errorBoundary: {
          componentStack: errorInfo.componentStack
        }
      }
    });
  }
  
  // Analytics de erro (se disponível)
  if (window.gtag) {
    window.gtag('event', 'exception', {
      description: error.toString(),
      fatal: true,
      custom_map: {
        error_boundary: 'root'
      }
    });
  }
};

// =========================================
// CONFIGURAÇÃO DO TOAST
// =========================================
const toastOptions = {
  duration: 4000,
  position: 'top-right',
  
  // Estilos customizados
  style: {
    background: 'white',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    fontSize: '14px',
    maxWidth: '400px'
  },
  
  // Configurações por tipo
  success: {
    iconTheme: {
      primary: '#10b981',
      secondary: 'white'
    },
    style: {
      border: '1px solid #d1fae5'
    }
  },
  
  error: {
    duration: 6000, // Erros ficam mais tempo
    iconTheme: {
      primary: '#ef4444',
      secondary: 'white'
    },
    style: {
      border: '1px solid #fecaca'
    }
  },
  
  loading: {
    iconTheme: {
      primary: '#3b82f6',
      secondary: 'white'
    }
  }
};

// =========================================
// PERFORMANCE MONITORING
// =========================================
if (isDevelopment) {
  // Web Vitals em desenvolvimento
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(console.log);
    getFID(console.log);
    getFCP(console.log);
    getLCP(console.log);
    getTTFB(console.log);
  });
}

// Performance Observer para métricas customizadas
if ('PerformanceObserver' in window) {
  try {
    const perfObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Log de performance apenas em desenvolvimento
        if (isDevelopment) {
          console.log(`⚡ Performance: ${entry.name} - ${entry.duration.toFixed(2)}ms`);
        }
        
        // Analytics de performance
        if (window.gtag && isProduction) {
          window.gtag('event', 'timing_complete', {
            name: entry.name,
            value: Math.round(entry.duration),
            event_category: 'Performance'
          });
        }
      }
    });
    
    perfObserver.observe({ entryTypes: ['measure', 'navigation'] });
  } catch (e) {
    console.warn('Performance Observer não suportado:', e);
  }
}

// =========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// =========================================
const initializeApp = async () => {
  console.log('🔧 Verificando suporte do navegador...');
  
  // Verificar suporte a recursos essenciais
  if (!window.fetch) {
    console.error('❌ Fetch API não suportada');
    throw new Error('Navegador não suportado. Por favor, atualize seu navegador.');
  }
  
  if (!window.WebSocket) {
    console.warn('⚠️ WebSocket não suportado - funcionalidades em tempo real serão limitadas');
  }
  
  // Configurar interceptadores globais apenas em desenvolvimento
  if (isDevelopment) {
    console.log('🛠️ Configurando ferramentas de desenvolvimento...');
    
    // Log de todas as requisições em desenvolvimento
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      console.log('🌐 Request:', args[0]);
      const response = await originalFetch(...args);
      console.log('📥 Response:', response.status);
      return response;
    };
  }
  
  // Registrar Service Worker apenas se habilitado
  if ('serviceWorker' in navigator && process.env.REACT_APP_ENABLE_PWA === 'true') {
    // Fazer isso de forma assíncrona para não bloquear
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('✅ Service Worker registrado:', registration))
      .catch(error => console.warn('⚠️ Falha ao registrar Service Worker:', error));
  }
  
  console.log('🚀 Smart Lock Admin configurado!');
};

// =========================================
// RENDERIZAÇÃO DA APLICAÇÃO
// =========================================
const container = document.getElementById('root');
const root = createRoot(container);

// Verificar se o container existe
if (!container) {
  throw new Error('Container #root não encontrado no DOM');
}

// Componente principal com providers
const AppWithProviders = () => (
  <React.StrictMode>
    <ErrorBoundary onError={handleGlobalError}>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
            <Toaster toastOptions={toastOptions} />
          </BrowserRouter>
          
          {/* React Query DevTools apenas em desenvolvimento */}
          {isDevelopment && (
            <ReactQueryDevtools 
              initialIsOpen={false} 
              position="bottom-right"
            />
          )}
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// =========================================
// INICIALIZAÇÃO E RENDER
// =========================================
const startApp = async () => {
  try {
    // Limpar timeout imediatamente quando começamos a inicializar
    if (window.clearAppTimeout) {
      window.clearAppTimeout();
    }
    
    console.log('⚙️ Inicializando aplicação React...');
    
    // Inicializar configurações
    await initializeApp();
    
    console.log('🎨 Renderizando componentes...');
    
    // Renderizar aplicação
    root.render(<AppWithProviders />);
    
    // Aguardar um pouco para o React terminar o primeiro render
    setTimeout(() => {
      console.log('✅ React renderizado, notificando HTML...');
      
      // Disparar evento personalizado
      const event = new CustomEvent('app-ready', {
        detail: { loadTime: Date.now() - window.__SMART_LOCK_APP__.startTime }
      });
      window.dispatchEvent(event);
      
      // Fallback para navegadores mais antigos
      if (window.hideLoadingScreen) {
        window.hideLoadingScreen();
      }
      
    }, 100); // Reduzido para 100ms - React moderno é rápido
    
  } catch (error) {
    console.error('❌ Erro ao inicializar aplicação:', error);
    
    // Limpar timeout se existir
    if (window.clearAppTimeout) {
      window.clearAppTimeout();
    }
    
    // Mostrar erro na tela após um pequeno delay
    setTimeout(() => {
      if (window.showFallbackContent) {
        window.showFallbackContent();
      }
    }, 100);
  }
};

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

// =========================================
// HOT MODULE REPLACEMENT (Development)
// =========================================
if (isDevelopment && module.hot) {
  module.hot.accept('./App', () => {
    console.log('🔥 Hot reloading App component...');
  });
}

// =========================================
// DEBUGGING GLOBAL (Development)
// =========================================
if (isDevelopment) {
  // Expor utilitários no console para debugging
  window.__SMART_LOCK_DEBUG__ = {
    queryClient,
    clearCache: () => {
      queryClient.clear();
      console.log('🧹 Cache do React Query limpo');
    },
    getCache: () => {
      console.log('💾 Cache atual:', queryClient.getQueryCache());
    },
    version: process.env.REACT_APP_VERSION || '1.0.0'
  };
  
  console.log('🔧 Debug tools disponíveis em window.__SMART_LOCK_DEBUG__');
}