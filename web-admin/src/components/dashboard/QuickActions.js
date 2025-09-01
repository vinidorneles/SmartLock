import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Users, 
  Package, 
  Wrench, 
  Download, 
  Upload,
  RefreshCw,
  AlertTriangle,
  Lock,
  Unlock,
  QrCode,
  Mail,
  Settings,
  FileText,
  Database,
  Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

// Utils
import { cn } from '../../utils/helpers';
import { APP_ROUTES } from '../../utils/constants';

// =========================================
// CONFIGURAÇÃO DAS AÇÕES RÁPIDAS
// =========================================
const quickActions = [
  {
    id: 'add-user',
    title: 'Novo Usuário',
    description: 'Cadastrar novo usuário',
    icon: Users,
    color: 'blue',
    route: `${APP_ROUTES.USERS}/new`,
    permission: 'users:create'
  },
  {
    id: 'add-cabinet',
    title: 'Novo Armário',
    description: 'Adicionar armário ao sistema',
    icon: Package,
    color: 'green',
    route: `${APP_ROUTES.CABINETS}/new`,
    permission: 'cabinets:create'
  },
  {
    id: 'add-equipment',
    title: 'Novo Equipamento',
    description: 'Cadastrar equipamento',
    icon: Wrench,
    color: 'purple',
    route: `${APP_ROUTES.EQUIPMENT}/new`,
    permission: 'equipment:create'
  },
  {
    id: 'generate-qr',
    title: 'Gerar QR Code',
    description: 'Criar novos QR codes',
    icon: QrCode,
    color: 'indigo',
    action: 'generateQR',
    permission: 'qr:generate'
  },
  {
    id: 'export-report',
    title: 'Exportar Relatório',
    description: 'Baixar relatório completo',
    icon: Download,
    color: 'cyan',
    action: 'exportReport',
    permission: 'reports:export'
  },
  {
    id: 'import-data',
    title: 'Importar Dados',
    description: 'Upload de planilha',
    icon: Upload,
    color: 'orange',
    action: 'importData',
    permission: 'data:import'
  },
  {
    id: 'send-notification',
    title: 'Enviar Notificação',
    description: 'Notificar usuários',
    icon: Mail,
    color: 'pink',
    action: 'sendNotification',
    permission: 'notifications:send'
  },
  {
    id: 'system-backup',
    title: 'Backup Sistema',
    description: 'Fazer backup completo',
    icon: Database,
    color: 'gray',
    action: 'systemBackup',
    permission: 'system:backup',
    danger: true
  }
];

// Ações de emergência
const emergencyActions = [
  {
    id: 'unlock-all',
    title: 'Desbloquear Todos',
    description: 'Emergência - abrir todos os lockers',
    icon: Unlock,
    color: 'red',
    action: 'unlockAll',
    permission: 'emergency:unlock',
    requireConfirmation: true
  },
  {
    id: 'lock-all',
    title: 'Bloquear Todos',
    description: 'Segurança - fechar todos os lockers',
    icon: Lock,
    color: 'red',
    action: 'lockAll',
    permission: 'emergency:lock',
    requireConfirmation: true
  },
  {
    id: 'system-maintenance',
    title: 'Modo Manutenção',
    description: 'Ativar modo de manutenção',
    icon: AlertTriangle,
    color: 'yellow',
    action: 'maintenanceMode',
    permission: 'system:maintenance',
    requireConfirmation: true
  }
];

// =========================================
// CONFIGURAÇÃO DE CORES
// =========================================
const colorConfig = {
  blue: {
    bg: 'bg-blue-50 hover:bg-blue-100',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-900'
  },
  green: {
    bg: 'bg-green-50 hover:bg-green-100',
    border: 'border-green-200',
    icon: 'text-green-600',
    title: 'text-green-900'
  },
  purple: {
    bg: 'bg-purple-50 hover:bg-purple-100',
    border: 'border-purple-200',
    icon: 'text-purple-600',
    title: 'text-purple-900'
  },
  indigo: {
    bg: 'bg-indigo-50 hover:bg-indigo-100',
    border: 'border-indigo-200',
    icon: 'text-indigo-600',
    title: 'text-indigo-900'
  },
  cyan: {
    bg: 'bg-cyan-50 hover:bg-cyan-100',
    border: 'border-cyan-200',
    icon: 'text-cyan-600',
    title: 'text-cyan-900'
  },
  orange: {
    bg: 'bg-orange-50 hover:bg-orange-100',
    border: 'border-orange-200',
    icon: 'text-orange-600',
    title: 'text-orange-900'
  },
  pink: {
    bg: 'bg-pink-50 hover:bg-pink-100',
    border: 'border-pink-200',
    icon: 'text-pink-600',
    title: 'text-pink-900'
  },
  red: {
    bg: 'bg-red-50 hover:bg-red-100',
    border: 'border-red-200',
    icon: 'text-red-600',
    title: 'text-red-900'
  },
  yellow: {
    bg: 'bg-yellow-50 hover:bg-yellow-100',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
    title: 'text-yellow-900'
  },
  gray: {
    bg: 'bg-gray-50 hover:bg-gray-100',
    border: 'border-gray-200',
    icon: 'text-gray-600',
    title: 'text-gray-900'
  }
};

// =========================================
// COMPONENTE PRINCIPAL
// =========================================
const QuickActions = ({ className = '' }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState({});
  const [showEmergency, setShowEmergency] = useState(false);

  // =========================================
  // HANDLERS DAS AÇÕES
  // =========================================
  const handleAction = async (action) => {
    if (action.route) {
      navigate(action.route);
      return;
    }

    if (action.requireConfirmation) {
      const confirmed = window.confirm(
        `Tem certeza que deseja executar "${action.title}"?\n\n${action.description}`
      );
      if (!confirmed) return;
    }

    setIsLoading(prev => ({ ...prev, [action.id]: true }));

    try {
      switch (action.action) {
        case 'generateQR':
          await handleGenerateQR();
          break;
        case 'exportReport':
          await handleExportReport();
          break;
        case 'importData':
          await handleImportData();
          break;
        case 'sendNotification':
          await handleSendNotification();
          break;
        case 'systemBackup':
          await handleSystemBackup();
          break;
        case 'unlockAll':
          await handleUnlockAll();
          break;
        case 'lockAll':
          await handleLockAll();
          break;
        case 'maintenanceMode':
          await handleMaintenanceMode();
          break;
        default:
          toast.error('Ação não implementada');
      }
    } catch (error) {
      console.error('Erro na ação:', error);
      toast.error('Erro ao executar ação');
    } finally {
      setIsLoading(prev => ({ ...prev, [action.id]: false }));
    }
  };

  // =========================================
  // IMPLEMENTAÇÃO DAS AÇÕES
  // =========================================
  const handleGenerateQR = async () => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success('QR Codes gerados com sucesso!');
  };

  const handleExportReport = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Simular download
    const blob = new Blob(['Dados do relatório...'], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Relatório exportado com sucesso!');
  };

  const handleImportData = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        setIsLoading(prev => ({ ...prev, 'import-data': true }));
        await new Promise(resolve => setTimeout(resolve, 3000));
        toast.success(`Arquivo ${file.name} importado com sucesso!`);
        setIsLoading(prev => ({ ...prev, 'import-data': false }));
      }
    };
    input.click();
  };

  const handleSendNotification = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success('Notificação enviada para todos os usuários!');
  };

  const handleSystemBackup = async () => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    toast.success('Backup do sistema concluído!');
  };

  const handleUnlockAll = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast.success('Todos os lockers foram desbloqueados!');
  };

  const handleLockAll = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast.success('Todos os lockers foram bloqueados!');
  };

  const handleMaintenanceMode = async () => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success('Modo de manutenção ativado!');
  };

  // =========================================
  // COMPONENTE DE AÇÃO
  // =========================================
  const ActionButton = ({ action, index }) => {
    const colors = colorConfig[action.color] || colorConfig.blue;
    const Icon = action.icon;
    const loading = isLoading[action.id];

    return (
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => handleAction(action)}
        disabled={loading}
        className={cn(
          "group relative w-full p-4 border rounded-xl transition-all duration-200",
          colors.bg,
          colors.border,
          "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          loading && "opacity-75 cursor-not-allowed",
          action.danger && "ring-1 ring-red-200"
        )}
      >
        <div className="flex items-center space-x-3">
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-200",
            colors.bg.replace('hover:', ''),
            "group-hover:scale-110"
          )}>
            {loading ? (
              <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
            ) : (
              <Icon className={cn("w-5 h-5", colors.icon)} />
            )}
          </div>
          
          <div className="flex-1 text-left">
            <h4 className={cn("text-sm font-medium", colors.title)}>
              {action.title}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {action.description}
            </p>
          </div>

          {action.requireConfirmation && (
            <div className="flex-shrink-0">
              <Shield className="w-4 h-4 text-yellow-500" />
            </div>
          )}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/50 rounded-xl flex items-center justify-center">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Executando...</span>
            </div>
          </div>
        )}
      </motion.button>
    );
  };

  // =========================================
  // COMPONENTE DE AÇÃO DE EMERGÊNCIA
  // =========================================
  const EmergencyActionButton = ({ action, index }) => {
    const Icon = action.icon;
    const loading = isLoading[action.id];

    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleAction(action)}
        disabled={loading}
        className={cn(
          "relative p-3 border-2 border-red-200 bg-red-50 hover:bg-red-100 rounded-lg",
          "transition-all duration-200 group",
          "focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
          loading && "opacity-75 cursor-not-allowed"
        )}
      >
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors duration-200">
            {loading ? (
              <RefreshCw className="w-4 h-4 text-red-600 animate-spin" />
            ) : (
              <Icon className="w-4 h-4 text-red-600" />
            )}
          </div>
          <div>
            <h5 className="text-xs font-medium text-red-900">{action.title}</h5>
            <p className="text-xs text-red-600 mt-0.5">{action.description}</p>
          </div>
        </div>
      </motion.button>
    );
  };

  // =========================================
  // RENDER PRINCIPAL
  // =========================================
  return (
    <div className={cn("space-y-6", className)}>
      {/* Ações Principais */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Plus className="w-5 h-5 text-blue-600" />
              <span>Ações Rápidas</span>
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Atalhos para tarefas comuns
            </p>
          </div>
          
          <button
            onClick={() => navigate(APP_ROUTES.SETTINGS)}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <ActionButton 
              key={action.id} 
              action={action} 
              index={index} 
            />
          ))}
        </div>
      </div>

      {/* Ações de Emergência */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-red-900 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Controles de Emergência</span>
            </h3>
            <p className="text-sm text-red-600 mt-1">
              Use apenas em situações de emergência
            </p>
          </div>
          
          <button
            onClick={() => setShowEmergency(!showEmergency)}
            className={cn(
              "flex items-center space-x-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200",
              showEmergency
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <Shield className="w-4 h-4" />
            <span>{showEmergency ? 'Ocultar' : 'Mostrar'}</span>
          </button>
        </div>

        <AnimatePresence>
          {showEmergency && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {emergencyActions.map((action, index) => (
                <EmergencyActionButton 
                  key={action.id} 
                  action={action} 
                  index={index} 
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!showEmergency && (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">
              Controles de emergência ocultos por segurança
            </p>
            <p className="text-xs mt-1">
              Clique em "Mostrar" para acessar os controles de emergência
            </p>
          </div>
        )}
      </div>

      {/* Ações Administrativas Rápidas */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <span>Administração</span>
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Tarefas administrativas e relatórios
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status do Sistema */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/system-status')}
            className="flex flex-col items-center space-y-2 p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-center">
              <h5 className="text-xs font-medium text-gray-900">Status</h5>
              <p className="text-xs text-gray-500">Sistema</p>
            </div>
          </motion.button>

          {/* Logs do Sistema */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/logs')}
            className="flex flex-col items-center space-y-2 p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-gray-600" />
            </div>
            <div className="text-center">
              <h5 className="text-xs font-medium text-gray-900">Logs</h5>
              <p className="text-xs text-gray-500">Sistema</p>
            </div>
          </motion.button>

          {/* Análise de Performance */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/performance')}
            className="flex flex-col items-center space-y-2 p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-center">
              <h5 className="text-xs font-medium text-gray-900">Performance</h5>
              <p className="text-xs text-gray-500">Análise</p>
            </div>
          </motion.button>

          {/* Segurança */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/security')}
            className="flex flex-col items-center space-y-2 p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-center">
              <h5 className="text-xs font-medium text-gray-900">Segurança</h5>
              <p className="text-xs text-gray-500">Auditoria</p>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

// =========================================
// COMPONENTE DE ESTATÍSTICAS RÁPIDAS
// =========================================
export const QuickStats = ({ className = '' }) => {
  const stats = [
    { label: 'Usuários Online', value: 24, change: '+12%', positive: true },
    { label: 'Lockers Ocupados', value: 87, change: '+5%', positive: true },
    { label: 'Equipamentos Ativos', value: 156, change: '-2%', positive: false },
    { label: 'Alertas Pendentes', value: 3, change: '-50%', positive: true }
  ];

  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-300"
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {stat.value}
            </div>
            <div className="text-xs text-gray-500 mb-2">
              {stat.label}
            </div>
            <div className={cn(
              "text-xs font-medium",
              stat.positive ? "text-green-600" : "text-red-600"
            )}>
              {stat.change}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default QuickActions;