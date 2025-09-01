import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Lock, Zap, Package, Users } from 'lucide-react';

// Utils
import { cn } from '../../utils/helpers';

// =========================================
// VARIANTES DE ANIMAÇÃO
// =========================================
const spinVariants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

const pulseVariants = {
  animate: {
    scale: [1, 1.1, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

const dotsVariants = {
  animate: {
    transition: {
      staggerChildren: 0.2,
      repeat: Infinity,
      repeatType: "loop"
    }
  }
};

const dotVariants = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 0.6,
      ease: "easeInOut"
    }
  }
};

// =========================================
// COMPONENTE DE LOADING PRINCIPAL
// =========================================
const Loading = ({ 
  message = 'Carregando...', 
  submessage = null,
  variant = 'spinner', 
  size = 'md',
  className = '',
  showLogo = true,
  overlay = false,
  progress = null,
  timeout = null
}) => {
  const [timeoutReached, setTimeoutReached] = React.useState(false);

  // =========================================
  // EFEITO DE TIMEOUT
  // =========================================
  React.useEffect(() => {
    if (timeout) {
      const timer = setTimeout(() => {
        setTimeoutReached(true);
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [timeout]);

  // =========================================
  // CONFIGURAÇÕES DE TAMANHO
  // =========================================
  const sizeConfig = {
    sm: {
      spinner: 'w-5 h-5',
      text: 'text-sm',
      container: 'p-4'
    },
    md: {
      spinner: 'w-8 h-8',
      text: 'text-base',
      container: 'p-6'
    },
    lg: {
      spinner: 'w-12 h-12',
      text: 'text-lg',
      container: 'p-8'
    },
    xl: {
      spinner: 'w-16 h-16',
      text: 'text-xl',
      container: 'p-12'
    }
  };

  const config = sizeConfig[size] || sizeConfig.md;

  // =========================================
  // RENDERIZAR LOADING SPINNER
  // =========================================
  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return (
          <motion.div
            variants={dotsVariants}
            animate="animate"
            className="flex space-x-1"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                variants={dotVariants}
                className={cn(
                  "rounded-full bg-blue-600",
                  size === 'sm' ? 'w-2 h-2' : 
                  size === 'lg' ? 'w-4 h-4' : 
                  size === 'xl' ? 'w-5 h-5' : 'w-3 h-3'
                )}
              />
            ))}
          </motion.div>
        );

      case 'pulse':
        return (
          <motion.div
            variants={pulseVariants}
            animate="animate"
            className={cn(
              "rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center",
              config.spinner
            )}
          >
            <Lock className="w-1/2 h-1/2 text-white" />
          </motion.div>
        );

      case 'smart':
        return (
          <div className="relative">
            <motion.div
              variants={spinVariants}
              animate="animate"
              className={cn(
                "border-2 border-blue-200 border-t-blue-600 rounded-full",
                config.spinner
              )}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock className={cn(
                "text-blue-600",
                size === 'sm' ? 'w-3 h-3' :
                size === 'lg' ? 'w-6 h-6' :
                size === 'xl' ? 'w-8 h-8' : 'w-4 h-4'
              )} />
            </div>
          </div>
        );

      case 'system':
        return (
          <div className="flex items-center space-x-2">
            {[Lock, Zap, Package, Users].map((Icon, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0.3 }}
                animate={{ 
                  opacity: [0.3, 1, 0.3],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.2
                }}
                className={cn(
                  "rounded-lg bg-blue-50 flex items-center justify-center",
                  size === 'sm' ? 'w-6 h-6' :
                  size === 'lg' ? 'w-10 h-10' :
                  size === 'xl' ? 'w-12 h-12' : 'w-8 h-8'
                )}
              >
                <Icon className={cn(
                  "text-blue-600",
                  size === 'sm' ? 'w-3 h-3' :
                  size === 'lg' ? 'w-5 h-5' :
                  size === 'xl' ? 'w-6 h-6' : 'w-4 h-4'
                )} />
              </motion.div>
            ))}
          </div>
        );

      default:
        return (
          <motion.div
            variants={spinVariants}
            animate="animate"
          >
            <Loader2 className={cn("text-blue-600", config.spinner)} />
          </motion.div>
        );
    }
  };

  // =========================================
  // RENDERIZAR PROGRESS BAR
  // =========================================
  const renderProgressBar = () => {
    if (progress === null) return null;

    return (
      <div className="w-full max-w-xs mx-auto mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progresso</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className="bg-blue-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>
    );
  };

  // =========================================
  // COMPONENTE PRINCIPAL
  // =========================================
  const LoadingContent = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        config.container,
        className
      )}
    >
      {/* Logo (opcional) */}
      {showLogo && size !== 'sm' && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center">
            <Lock className="w-6 h-6 text-white" />
          </div>
        </motion.div>
      )}

      {/* Spinner */}
      <div className="mb-4">
        {renderSpinner()}
      </div>

      {/* Mensagem Principal */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        <h3 className={cn(
          "font-medium text-gray-900",
          config.text
        )}>
          {message}
        </h3>
        
        {submessage && (
          <p className="text-sm text-gray-500 max-w-sm">
            {submessage}
          </p>
        )}
      </motion.div>

      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Timeout Warning */}
      {timeoutReached && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-sm"
        >
          <div className="flex items-center space-x-2 text-yellow-800">
            <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Carregamento demorado</span>
          </div>
          <p className="text-xs text-yellow-600 mt-1">
            Se o problema persistir, tente recarregar a página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-yellow-700 hover:text-yellow-800 underline"
          >
            Recarregar página
          </button>
        </motion.div>
      )}
    </motion.div>
  );

  // =========================================
  // RENDER CONDICIONAL
  // =========================================
  if (overlay) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <LoadingContent />
        </div>
      </div>
    );
  }

  return <LoadingContent />;
};

// =========================================
// COMPONENTES ESPECIALIZADOS
// =========================================

// Loading para página inteira
export const PageLoading = ({ message = 'Carregando página...' }) => (
  <div className="min-h-screen flex items-center justify-center">
    <Loading 
      message={message}
      variant="smart"
      size="lg"
      showLogo={true}
    />
  </div>
);

// Loading para componentes
export const ComponentLoading = ({ message = 'Carregando...' }) => (
  <div className="flex items-center justify-center py-8">
    <Loading 
      message={message}
      variant="spinner"
      size="md"
      showLogo={false}
    />
  </div>
);

// Loading para tabelas
export const TableLoading = ({ rows = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="animate-pulse">
        <div className="h-12 bg-gray-200 rounded-lg"></div>
      </div>
    ))}
  </div>
);

// Loading para cards
export const CardLoading = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="animate-pulse">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Loading inline para botões
export const ButtonLoading = ({ size = 'sm' }) => (
  <motion.div
    variants={spinVariants}
    animate="animate"
    className="inline-block"
  >
    <Loader2 className={cn(
      "text-current",
      size === 'sm' ? 'w-4 h-4' : 
      size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
    )} />
  </motion.div>
);

// Loading para overlay de ações
export const ActionLoading = ({ 
  message = 'Processando...', 
  action = null 
}) => (
  <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white rounded-xl shadow-xl border border-gray-200 p-8 max-w-sm mx-4"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <Loading 
          variant="smart" 
          size="lg" 
          showLogo={false}
          className="p-0"
        />
        
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {message}
          </h3>
          {action && (
            <p className="text-sm text-gray-500">
              {action}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  </div>
);

// Loading skeleton para listas
export const ListLoading = ({ items = 10 }) => (
  <div className="space-y-4">
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="animate-pulse flex items-center space-x-4 p-4">
        <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="w-20 h-8 bg-gray-200 rounded"></div>
      </div>
    ))}
  </div>
);

// Loading para gráficos
export const ChartLoading = ({ height = 300 }) => (
  <div className="animate-pulse" style={{ height }}>
    <div className="h-full bg-gray-200 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 bg-gray-300 rounded-full mx-auto mb-2"></div>
        <div className="h-4 bg-gray-300 rounded w-32 mx-auto"></div>
      </div>
    </div>
  </div>
);

// Loading para formulários
export const FormLoading = ({ fields = 5 }) => (
  <div className="space-y-6">
    {Array.from({ length: fields }).map((_, index) => (
      <div key={index} className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
        <div className="h-10 bg-gray-200 rounded-lg"></div>
      </div>
    ))}
  </div>
);

// Loading para modal
export const ModalLoading = ({ message = 'Carregando...' }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <Loading 
      message={message}
      variant="spinner"
      size="lg"
      showLogo={false}
    />
  </div>
);

// Loading com erro de fallback
export const LoadingWithError = ({ 
  isLoading, 
  error, 
  onRetry, 
  children,
  loadingMessage = 'Carregando...',
  errorMessage = 'Erro ao carregar dados'
}) => {
  if (isLoading) {
    return <ComponentLoading message={loadingMessage} />;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {errorMessage}
        </h3>
        <p className="text-gray-500 mb-4">
          {error.message || 'Ocorreu um erro inesperado.'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn btn-primary"
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  return children;
};

export default Loading;