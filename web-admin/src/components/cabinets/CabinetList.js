import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  MapPin,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';

// Componentes
import { TableLoading } from '../common/Loading';

// Utils
import { cn, formatDate } from '../../utils/helpers';

// =========================================
// DADOS MOCK DOS ARMÁRIOS
// =========================================
const generateMockCabinets = () => {
  const locations = ['Biblioteca Central', 'Lab. Informática', 'Centro Esportivo', 'Auditório Principal'];
  const statuses = ['online', 'offline', 'maintenance', 'error'];
  
  return Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    code: `ARM-${String(i + 1).padStart(3, '0')}`,
    name: `Armário ${String.fromCharCode(65 + Math.floor(i / 5))}-${String(i % 5 + 1).padStart(2, '0')}`,
    location: locations[Math.floor(Math.random() * locations.length)],
    totalLockers: 12,
    occupiedLockers: Math.floor(Math.random() * 12),
    status: statuses[Math.floor(Math.random() * statuses.length)],
    lastSync: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
    hardwareVersion: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}`,
    ipAddress: `192.168.1.${Math.floor(Math.random() * 100) + 10}`,
    temperature: Math.floor(Math.random() * 10) + 20,
    humidity: Math.floor(Math.random() * 20) + 40,
    batteryLevel: Math.floor(Math.random() * 100),
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
  }));
};

// =========================================
// COMPONENTE PRINCIPAL
// =========================================
const CabinetList = ({ className = '' }) => {
  const navigate = useNavigate();
  const [cabinets, setCabinets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedCabinets, setSelectedCabinets] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // =========================================
  // EFEITOS
  // =========================================
  useEffect(() => {
    loadCabinets();
  }, []);

  // =========================================
  // HANDLERS
  // =========================================
  const loadCabinets = async () => {
    setIsLoading(true);
    try {
      // Simular chamada de API
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockData = generateMockCabinets();
      setCabinets(mockData);
    } catch (error) {
      console.error('Erro ao carregar armários:', error);
      toast.error('Erro ao carregar armários');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (cabinetId) => {
    if (!window.confirm('Tem certeza que deseja excluir este armário?')) {
      return;
    }

    try {
      // Simular API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setCabinets(prev => prev.filter(cabinet => cabinet.id !== cabinetId));
      toast.success('Armário excluído com sucesso!');
    } catch (error) {
      toast.error('Erro ao excluir armário');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedCabinets.length === 0) {
      toast.error('Selecione pelo menos um armário');
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      switch (action) {
        case 'delete':
          setCabinets(prev => prev.filter(cabinet => !selectedCabinets.includes(cabinet.id)));
          toast.success(`${selectedCabinets.length} armários excluídos`);
          break;
        case 'sync':
          toast.success(`${selectedCabinets.length} armários sincronizados`);
          break;
        case 'maintenance':
          toast.success(`${selectedCabinets.length} armários em manutenção`);
          break;
      }
      
      setSelectedCabinets([]);
    } catch (error) {
      toast.error('Erro na ação em lote');
    }
  };

  // Filtrar e ordenar armários
  const filteredCabinets = cabinets
    .filter(cabinet => {
      const matchesSearch = cabinet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cabinet.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cabinet.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || cabinet.status === statusFilter;
      const matchesLocation = locationFilter === 'all' || cabinet.location === locationFilter;
      
      return matchesSearch && matchesStatus && matchesLocation;
    })
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      const modifier = sortOrder === 'asc' ? 1 : -1;
      
      if (typeof aValue === 'string') {
        return aValue.localeCompare(bValue) * modifier;
      }
      return (aValue - bValue) * modifier;
    });

  // Obter localizações únicas
  const uniqueLocations = [...new Set(cabinets.map(cabinet => cabinet.location))];

  // =========================================
  // COMPONENTE DE STATUS
  // =========================================
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      online: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2 },
      offline: { bg: 'bg-gray-100', text: 'text-gray-800', icon: WifiOff },
      maintenance: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Settings },
      error: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertTriangle }
    };

    const config = statusConfig[status] || statusConfig.offline;
    const Icon = config.icon;

    return (
      <span className={cn(
        "inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium",
        config.bg,
        config.text
      )}>
        <Icon className="w-3 h-3" />
        <span className="capitalize">{status}</span>
      </span>
    );
  };

  // =========================================
  // COMPONENTE DE ITEM DA LISTA
  // =========================================
  const CabinetItem = ({ cabinet, index }) => {
    const [showMenu, setShowMenu] = useState(false);
    const occupancyRate = Math.round((cabinet.occupiedLockers / cabinet.totalLockers) * 100);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-300"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-3">
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={selectedCabinets.includes(cabinet.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedCabinets(prev => [...prev, cabinet.id]);
                } else {
                  setSelectedCabinets(prev => prev.filter(id => id !== cabinet.id));
                }
              }}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />

            {/* Ícone e Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <Package className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {cabinet.name}
                </h3>
                <StatusBadge status={cabinet.status} />
              </div>
              
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <span className="font-medium">Código:</span>
                  <span className="font-mono">{cabinet.code}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <MapPin className="w-3 h-3" />
                  <span>{cabinet.location}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Última sync: {formatDate(cabinet.lastSync, 'dd/MM HH:mm')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu de Ações */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20"
                >
                  <div className="p-2">
                    <button
                      onClick={() => {
                        navigate(`/cabinets/${cabinet.id}`);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Ver Detalhes</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        navigate(`/cabinets/${cabinet.id}/edit`);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Editar</span>
                    </button>
                    
                    <div className="border-t border-gray-200 my-2" />
                    
                    <button
                      onClick={() => {
                        handleDelete(cabinet.id);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {cabinet.totalLockers}
            </div>
            <div className="text-xs text-gray-500">Total Lockers</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {cabinet.occupiedLockers}
            </div>
            <div className="text-xs text-gray-500">Ocupados</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {occupancyRate}%
            </div>
            <div className="text-xs text-gray-500">Ocupação</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {cabinet.batteryLevel}%
            </div>
            <div className="text-xs text-gray-500">Bateria</div>
          </div>
        </div>

        {/* Barra de Ocupação */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Ocupação dos Lockers</span>
            <span>{cabinet.occupiedLockers}/{cabinet.totalLockers}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${occupancyRate}%` }}
              transition={{ duration: 1, delay: index * 0.1 }}
              className={cn(
                "h-2 rounded-full transition-colors duration-300",
                occupancyRate > 80 ? 'bg-red-500' :
                occupancyRate > 60 ? 'bg-yellow-500' : 'bg-green-500'
              )}
            />
          </div>
        </div>

        {/* Informações Técnicas */}
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
          <div>
            <span className="font-medium">IP:</span> {cabinet.ipAddress}
          </div>
          <div>
            <span className="font-medium">Hardware:</span> {cabinet.hardwareVersion}
          </div>
          <div>
            <span className="font-medium">Temperatura:</span> {cabinet.temperature}°C
          </div>
          <div>
            <span className="font-medium">Umidade:</span> {cabinet.humidity}%
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex space-x-2">
          <button
            onClick={() => navigate(`/cabinets/${cabinet.id}`)}
            className="flex-1 btn btn-outline btn-sm"
          >
            <Eye className="w-4 h-4 mr-1" />
            Ver Detalhes
          </button>
          
          <button
            onClick={() => navigate(`/cabinets/${cabinet.id}/lockers`)}
            className="flex-1 btn btn-primary btn-sm"
          >
            <Package className="w-4 h-4 mr-1" />
            Gerenciar Lockers
          </button>
        </div>
      </motion.div>
    );
  };

  // =========================================
  // RENDER PRINCIPAL
  // =========================================
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header e Controles */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Armários</h2>
            <p className="text-gray-600 mt-1">
              Gerencie os armários do sistema ({filteredCabinets.length} encontrados)
            </p>
          </div>

          <div className="flex flex-wrap items-center space-x-2">
            <button
              onClick={() => navigate('/cabinets/new')}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Armário
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "btn",
                showFilters ? "btn-primary" : "btn-outline"
              )}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Buscar por nome, código ou localização..."
          />
        </div>

        {/* Filtros Expandidos */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
            >
              {/* Filtro de Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-select w-full"
                >
                  <option value="all">Todos os Status</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="maintenance">Manutenção</option>
                  <option value="error">Erro</option>
                </select>
              </div>

              {/* Filtro de Localização */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Localização
                </label>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="form-select w-full"
                >
                  <option value="all">Todas as Localizações</option>
                  {uniqueLocations.map(location => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ordenação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ordenar por
                </label>
                <div className="flex space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="form-select flex-1"
                  >
                    <option value="name">Nome</option>
                    <option value="code">Código</option>
                    <option value="location">Localização</option>
                    <option value="occupiedLockers">Ocupação</option>
                    <option value="lastSync">Última Sync</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="btn btn-outline px-3"
                    title={`Ordenar ${sortOrder === 'asc' ? 'decrescente' : 'crescente'}`}
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ações em Lote */}
        {selectedCabinets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6"
          >
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-blue-900">
                {selectedCabinets.length} armário(s) selecionado(s)
              </span>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => handleBulkAction('sync')}
                className="btn btn-primary btn-sm"
              >
                Sincronizar
              </button>
              <button
                onClick={() => handleBulkAction('maintenance')}
                className="btn btn-warning btn-sm"
              >
                Manutenção
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="btn btn-danger btn-sm"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Lista de Armários */}
      <div>
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <TableLoading rows={6} />
          </div>
        ) : filteredCabinets.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCabinets.map((cabinet, index) => (
              <CabinetItem 
                key={cabinet.id} 
                cabinet={cabinet} 
                index={index} 
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum armário encontrado
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || statusFilter !== 'all' || locationFilter !== 'all'
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece criando seu primeiro armário.'}
            </p>
            {(!searchTerm && statusFilter === 'all' && locationFilter === 'all') && (
              <button
                onClick={() => navigate('/cabinets/new')}
                className="btn btn-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Armário
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CabinetList;