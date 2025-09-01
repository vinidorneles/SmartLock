import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Activity,
  Calendar,
  Filter,
  Download
} from 'lucide-react';

// Utils
import { cn, formatNumber } from '../../utils/helpers';

// =========================================
// DADOS MOCK PARA OS GRÁFICOS
// =========================================
const generateUsageData = () => {
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  return {
    // Dados semanais
    weeklyData: days.map((day, index) => ({
      day,
      acessos: Math.floor(Math.random() * 50) + 20,
      equipamentos: Math.floor(Math.random() * 30) + 15,
      usuarios: Math.floor(Math.random() * 25) + 10,
      pico: index === 2 || index === 3 ? Math.floor(Math.random() * 20) + 60 : 0
    })),
    
    // Dados por hora (hoje)
    hourlyData: hours.map(hour => ({
      hora: `${hour.toString().padStart(2, '0')}:00`,
      acessos: hour >= 7 && hour <= 18 
        ? Math.floor(Math.random() * 15) + 5 
        : Math.floor(Math.random() * 3),
      ocupacao: hour >= 8 && hour <= 17 
        ? Math.floor(Math.random() * 30) + 40 
        : Math.floor(Math.random() * 20) + 10
    })),
    
    // Distribuição por categoria
    categoryData: [
      { nome: 'Equipamentos Eletrônicos', valor: 45, cor: '#3b82f6' },
      { nome: 'Material Esportivo', valor: 25, cor: '#10b981' },
      { nome: 'Instrumentos Musicais', valor: 15, cor: '#f59e0b' },
      { nome: 'Material de Laboratório', valor: 10, cor: '#ef4444' },
      { nome: 'Outros', valor: 5, cor: '#8b5cf6' }
    ],
    
    // Comparativo mensal
    monthlyData: [
      { mes: 'Jan', atual: 1200, anterior: 1100 },
      { mes: 'Fev', atual: 1350, anterior: 1250 },
      { mes: 'Mar', atual: 1580, anterior: 1400 },
      { mes: 'Abr', atual: 1720, anterior: 1580 },
      { mes: 'Mai', atual: 1890, anterior: 1650 },
      { mes: 'Jun', atual: 1950, anterior: 1720 },
      { mes: 'Jul', atual: 1680, anterior: 1890 },
      { mes: 'Ago', atual: 1820, anterior: 1750 },
      { mes: 'Set', atual: 1950, anterior: 1680 }
    ]
  };
};

// =========================================
// COMPONENTE DE TOOLTIP CUSTOMIZADO
// =========================================
const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center space-x-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.dataKey}:</span>
            <span className="font-medium text-gray-900">
              {formatter ? formatter(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// =========================================
// COMPONENTE PRINCIPAL DO USAGE CHART
// =========================================
const UsageChart = ({ className = '' }) => {
  const [chartType, setChartType] = useState('weekly');
  const [chartStyle, setChartStyle] = useState('line');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // =========================================
  // EFEITOS
  // =========================================
  useEffect(() => {
    // Simular carregamento de dados
    const loadData = async () => {
      setIsLoading(true);
      
      // Simular delay de API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setData(generateUsageData());
      setIsLoading(false);
    };

    loadData();
  }, []);

  // =========================================
  // HANDLERS
  // =========================================
  const getCurrentData = () => {
    if (!data) return [];
    
    switch (chartType) {
      case 'hourly':
        return data.hourlyData;
      case 'monthly':
        return data.monthlyData;
      case 'category':
        return data.categoryData;
      default:
        return data.weeklyData;
    }
  };

  const exportData = () => {
    const currentData = getCurrentData();
    const csv = [
      Object.keys(currentData[0]).join(','),
      ...currentData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-data-${chartType}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // =========================================
  // RENDERIZAR GRÁFICO
  // =========================================
  const renderChart = () => {
    const currentData = getCurrentData();
    
    if (chartType === 'category') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={currentData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ nome, valor }) => `${nome}: ${valor}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="valor"
            >
              {currentData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.cor} />
              ))}
            </Pie>
            <Tooltip 
              content={<CustomTooltip formatter={(value) => `${value}%`} />}
            />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartStyle === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={currentData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis 
              dataKey={chartType === 'hourly' ? 'hora' : chartType === 'monthly' ? 'mes' : 'day'}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={{ stroke: '#e5e7eb' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {chartType === 'monthly' ? (
              <>
                <Bar dataKey="atual" fill="#3b82f6" name="Mês Atual" radius={[2, 2, 0, 0]} />
                <Bar dataKey="anterior" fill="#93c5fd" name="Mês Anterior" radius={[2, 2, 0, 0]} />
              </>
            ) : chartType === 'hourly' ? (
              <>
                <Bar dataKey="acessos" fill="#3b82f6" name="Acessos" radius={[2, 2, 0, 0]} />
                <Bar dataKey="ocupacao" fill="#10b981" name="Ocupação %" radius={[2, 2, 0, 0]} />
              </>
            ) : (
              <>
                <Bar dataKey="acessos" fill="#3b82f6" name="Acessos" radius={[2, 2, 0, 0]} />
                <Bar dataKey="equipamentos" fill="#10b981" name="Equipamentos" radius={[2, 2, 0, 0]} />
                <Bar dataKey="usuarios" fill="#f59e0b" name="Usuários" radius={[2, 2, 0, 0]} />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartStyle === 'area') {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={currentData}>
            <defs>
              <linearGradient id="colorAcessos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorEquipamentos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey={chartType === 'hourly' ? 'hora' : chartType === 'monthly' ? 'mes' : 'day'}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {chartType === 'monthly' ? (
              <>
                <Area
                  type="monotone"
                  dataKey="atual"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorAcessos)"
                  name="Mês Atual"
                />
                <Area
                  type="monotone"
                  dataKey="anterior"
                  stroke="#93c5fd"
                  fillOpacity={0.6}
                  fill="url(#colorEquipamentos)"
                  name="Mês Anterior"
                />
              </>
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="acessos"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorAcessos)"
                  name="Acessos"
                />
                <Area
                  type="monotone"
                  dataKey={chartType === 'hourly' ? 'ocupacao' : 'equipamentos'}
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorEquipamentos)"
                  name={chartType === 'hourly' ? 'Ocupação %' : 'Equipamentos'}
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // Line Chart (padrão)
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={currentData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            dataKey={chartType === 'hourly' ? 'hora' : chartType === 'monthly' ? 'mes' : 'day'}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={{ stroke: '#e5e7eb' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {chartType === 'monthly' ? (
            <>
              <Line
                type="monotone"
                dataKey="atual"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6, fill: '#1d4ed8' }}
                name="Mês Atual"
              />
              <Line
                type="monotone"
                dataKey="anterior"
                stroke="#93c5fd"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#93c5fd', r: 3 }}
                name="Mês Anterior"
              />
            </>
          ) : chartType === 'hourly' ? (
            <>
              <Line
                type="monotone"
                dataKey="acessos"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 4 }}
                name="Acessos"
              />
              <Line
                type="monotone"
                dataKey="ocupacao"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 4 }}
                name="Ocupação %"
              />
            </>
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="acessos"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6, fill: '#1d4ed8' }}
                name="Acessos"
              />
              <Line
                type="monotone"
                dataKey="equipamentos"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6, fill: '#059669' }}
                name="Equipamentos"
              />
              <Line
                type="monotone"
                dataKey="usuarios"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ fill: '#f59e0b', r: 4 }}
                activeDot={{ r: 6, fill: '#d97706' }}
                name="Usuários"
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  // =========================================
  // CALCULAR ESTATÍSTICAS
  // =========================================
  const getChartStats = () => {
    const currentData = getCurrentData();
    if (!currentData.length) return null;

    let totalValue = 0;
    let previousValue = 0;
    let trend = 'neutral';

    if (chartType === 'category') {
      totalValue = currentData.reduce((sum, item) => sum + item.valor, 0);
    } else {
      totalValue = currentData.reduce((sum, item) => {
        return sum + (item.acessos || item.atual || 0);
      }, 0);
      
      // Calcular tendência (simulado)
      const lastItems = currentData.slice(-2);
      if (lastItems.length === 2) {
        const current = lastItems[1].acessos || lastItems[1].atual || 0;
        const previous = lastItems[0].acessos || lastItems[0].atual || 0;
        trend = current > previous ? 'up' : current < previous ? 'down' : 'neutral';
      }
    }

    return { totalValue, trend };
  };

  const stats = getChartStats();

  // =========================================
  // RENDER
  // =========================================
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200", className)}>
      {/* Header do Gráfico */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span>Análise de Uso</span>
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Estatísticas de utilização do sistema
            </p>
          </div>

          {/* Controles */}
          <div className="flex flex-wrap items-center space-x-2">
            {/* Seletor de Período */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {[
                { key: 'hourly', label: 'Hoje', icon: Calendar },
                { key: 'weekly', label: 'Semana', icon: BarChart3 },
                { key: 'monthly', label: 'Mensal', icon: TrendingUp },
                { key: 'category', label: 'Categoria', icon: PieChartIcon }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setChartType(key)}
                  className={cn(
                    "flex items-center space-x-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                    chartType === key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Seletor de Estilo (apenas para dados não categóricos) */}
            {chartType !== 'category' && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                {[
                  { key: 'line', label: 'Linha' },
                  { key: 'area', label: 'Área' },
                  { key: 'bar', label: 'Barra' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setChartStyle(key)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                      chartStyle === key
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Botão de Export */}
            <button
              onClick={exportData}
              disabled={isLoading}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* Estatísticas Rápidas */}
        {stats && (
          <div className="mt-4 flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Total:</span>
              <span className="text-lg font-bold text-gray-900">
                {formatNumber(stats.totalValue)}
              </span>
            </div>
            
            {stats.trend !== 'neutral' && (
              <div className="flex items-center space-x-1">
                {stats.trend === 'up' ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  stats.trend === 'up' ? 'text-green-600' : 'text-red-600'
                )}>
                  {stats.trend === 'up' ? 'Crescimento' : 'Declínio'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Área do Gráfico */}
      <div className="p-6">
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Carregando dados do gráfico...</p>
            </motion.div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {renderChart()}
          </motion.div>
        )}
      </div>

      {/* Legenda Adicional */}
      {chartType === 'category' && !isLoading && (
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
            {data?.categoryData.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.cor }}
                />
                <span className="text-gray-600 truncate">{item.nome}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsageChart;