
import React, { useMemo } from 'react';
import type { Transaction, ProjectionSettings } from './types';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { Settings2, BarChart3, PieChart as PieIcon, TrendingUp } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  totalIncome: number;
  totalExpenses: number;
  projectionSettings: ProjectionSettings;
  onOpenConfig: () => void;
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions = [], 
  totalIncome = 0, 
  totalExpenses = 0,
  projectionSettings,
  onOpenConfig
}) => {
  
  // Agrupamento de despesas para o gráfico de pizza
  const pieData = useMemo(() => {
    if (!transactions.length) return [];
    const groups = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((acc, curr) => {
        const groupName = curr.group || 'Diversos';
        acc[groupName] = (acc[groupName] || 0) + (curr.amount || 0);
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [transactions]);

  // Dados para o gráfico de barras
  const barData = useMemo(() => [
    { name: 'Balanço', Receitas: totalIncome || 0, Despesas: totalExpenses || 0 }
  ], [totalIncome, totalExpenses]);

  const balance = (totalIncome || 0) - (totalExpenses || 0);
  const balanceColor = balance >= 0 ? 'text-green-600' : 'text-red-600';

  // --- Cálculos de Projeção ---
  const needsItems = projectionSettings?.needs_items || [];
  
  const tithes = useMemo(() => transactions
    .filter(t => t.group === 'Dízimos e Ofertas')
    .reduce((acc, t) => acc + (t.amount || 0), 0), [transactions]);

  const needs = useMemo(() => transactions
    .filter(t => t.type === 'EXPENSE' && needsItems.includes(t.description))
    .reduce((acc, t) => acc + (t.amount || 0), 0), [transactions, needsItems]);

  const wants = useMemo(() => transactions
    .filter(t => 
      t.type === 'EXPENSE' && 
      t.group !== 'Dízimos e Ofertas' && 
      !needsItems.includes(t.description)
    )
    .reduce((acc, t) => acc + (t.amount || 0), 0), [transactions, needsItems]);

  const savings = balance;

  const calcPercent = (val: number) => {
     if (!totalIncome || totalIncome <= 0) return 0;
     return (val / totalIncome) * 100;
  };

  const projectionRows = [
    { label: "DÍZIMO - 10%", actual: tithes, percent: calcPercent(tithes), target: 10, color: "bg-yellow-50 text-yellow-800" },
    { label: "NECESSIDADES BÁSICAS - 50%", actual: needs, percent: calcPercent(needs), target: 50, color: "bg-blue-50 text-blue-800" },
    { label: "LAZER / DESEJOS - 30%", actual: wants, percent: calcPercent(wants), target: 30, color: "bg-purple-50 text-purple-800" },
    { label: "POUPANÇA / INVESTIMENTOS - 10%", actual: savings, percent: calcPercent(savings), target: 10, color: "bg-green-50 text-green-800" }
  ];

  const totalPercent = projectionRows.reduce((acc, row) => acc + (row.percent || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Receitas</span>
            <div className="text-xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIncome || 0)}
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center rotate-180">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Despesas</span>
            <div className="text-xl font-bold text-red-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalExpenses || 0)}
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className={`w-12 h-12 ${balance >= 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-red-50 text-red-400'} rounded-full flex items-center justify-center`}>
            <BarChart3 size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo</span>
            <div className={`text-xl font-bold ${balanceColor}`}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Projeção */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden relative">
         <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-2 text-white">
              <Settings2 size={18} className="text-indigo-400" />
              <span className="font-bold uppercase text-sm tracking-wide">Projeção de Gastos Ideal</span>
            </div>
            <button 
              onClick={onOpenConfig} 
              className="text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md text-xs font-bold transition-colors"
            >
              Configurar
            </button>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-sm">
               <thead>
                 <tr className="bg-gray-50 text-gray-600 border-b">
                    <th className="px-4 py-3 text-left">Regra dos 50-30-20</th>
                    <th className="px-4 py-3 text-center">Meta</th>
                    <th className="px-4 py-3 text-right">Realizado (R$)</th>
                    <th className="px-4 py-3 text-center">Realizado (%)</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {projectionRows.map((row) => (
                    <tr key={row.label} className={`${row.color} hover:brightness-95 transition-all`}>
                      <td className="px-4 py-3 font-semibold">{row.label}</td>
                      <td className="px-4 py-3 text-center font-mono opacity-60">{row.target}%</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.actual)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${Math.abs(row.percent - row.target) < 5 ? 'bg-green-500 text-white' : 'bg-white border text-gray-600'}`}>
                          {row.percent.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-900 text-white font-bold">
                    <td className="px-4 py-3">TOTAL DISTRIBUÍDO</td>
                    <td className="px-4 py-3 text-center opacity-50">100%</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-indigo-400">{totalPercent.toFixed(1)}%</span>
                    </td>
                  </tr>
               </tbody>
            </table>
         </div>
      </div>

      {/* Gráficos em Grade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
          <div className="flex items-center gap-2 mb-6">
            <PieIcon size={20} className="text-indigo-500" />
            <h3 className="text-gray-800 font-bold uppercase text-sm">Gastos por Grupo</h3>
          </div>
          <div className="h-72 w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={8}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1000}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                <PieIcon size={48} className="opacity-20" />
                <p className="text-sm italic">Nenhum dado para exibir no momento</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
           <div className="flex items-center gap-2 mb-6">
            <BarChart3 size={20} className="text-indigo-500" />
            <h3 className="text-gray-800 font-bold uppercase text-sm">Balanço Mensal</h3>
          </div>
           <div className="h-72 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip 
                    cursor={{fill: '#f9fafb'}}
                    formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="Receitas" fill="#10B981" radius={[6, 6, 0, 0]} barSize={50} />
                  <Bar dataKey="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} barSize={50} />
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
