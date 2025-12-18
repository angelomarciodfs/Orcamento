
import React from 'react';
import type { Transaction, ProjectionSettings } from './types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Settings2 } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  totalIncome: number;
  totalExpenses: number;
  projectionSettings: ProjectionSettings;
  onOpenConfig: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#FF6B6B'];

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, 
  totalIncome, 
  totalExpenses,
  projectionSettings,
  onOpenConfig
}) => {
  
  const expenseGroups = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc, curr) => {
      acc[curr.group] = (acc[curr.group] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

  const pieData = Object.entries(expenseGroups).map(([name, value]) => ({ name, value }));
  const barData = [
    { name: 'Total', Receitas: totalIncome, Despesas: totalExpenses }
  ];

  const balance = totalIncome - totalExpenses;
  const balanceColor = balance >= 0 ? 'text-green-600' : 'text-red-600';

  const tithes = transactions
    .filter(t => t.group === 'Dízimos e Ofertas')
    .reduce((acc, t) => acc + t.amount, 0);

  const needs = transactions
    .filter(t => t.type === 'EXPENSE' && projectionSettings.needs_items.includes(t.description))
    .reduce((acc, t) => acc + t.amount, 0);

  const wants = transactions
    .filter(t => 
      t.type === 'EXPENSE' && 
      t.group !== 'Dízimos e Ofertas' && 
      !projectionSettings.needs_items.includes(t.description)
    )
    .reduce((acc, t) => acc + t.amount, 0);

  const savings = balance;

  const calcPercent = (val: number) => {
     if (totalIncome === 0) return 0;
     return (val / totalIncome) * 100;
  };

  const projectionRows = [
    { label: "DÍZIMO - 10%", actual: tithes, percent: calcPercent(tithes), target: 10, color: "bg-yellow-50 text-yellow-800" },
    { label: "NECESSIDADES BÁSICAS - 50%", actual: needs, percent: calcPercent(needs), target: 50, color: "bg-blue-50 text-blue-800" },
    { label: "LAZER / DESEJOS - 30%", actual: wants, percent: calcPercent(wants), target: 30, color: "bg-purple-50 text-purple-800" },
    { label: "POUPANÇA / INVESTIMENTOS - 10%", actual: savings, percent: calcPercent(savings), target: 10, color: "bg-green-50 text-green-800" }
  ];

  const totalPercent = projectionRows.reduce((acc, row) => acc + row.percent, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-sm font-medium text-gray-500 uppercase">Receita Total</span>
          <span className="text-2xl font-bold text-green-600 mt-1">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalIncome)}
          </span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-sm font-medium text-gray-500 uppercase">Despesa Total</span>
          <span className="text-2xl font-bold text-red-600 mt-1">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalExpenses)}
          </span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-sm font-medium text-gray-500 uppercase">Saldo</span>
          <span className={`text-2xl font-bold mt-1 ${balanceColor}`}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance)}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-400 overflow-hidden relative">
         <div className="bg-amber-100 px-4 py-2 border-b border-amber-200 flex justify-between items-center">
            <span className="font-bold text-amber-900 uppercase">Projeção Financeira</span>
            <button onClick={onOpenConfig} className="text-amber-800 hover:text-amber-900 hover:bg-amber-200 p-1.5 rounded transition-colors">
              <Settings2 size={18} />
            </button>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-sm">
               <thead>
                 <tr className="bg-gray-800 text-white">
                    <th className="px-4 py-2 text-left w-1/2">Categoria</th>
                    <th className="px-4 py-2 text-center">Previsto</th>
                    <th className="px-4 py-2 text-center">Realizado (R$)</th>
                    <th className="px-4 py-2 text-center">Realizado (%)</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-200">
                  {projectionRows.map((row) => (
                    <tr key={row.label} className={row.color}>
                      <td className="px-4 py-2 font-medium">{row.label}</td>
                      <td className="px-4 py-2 text-center font-mono">{row.target}%</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.actual)}
                      </td>
                      <td className="px-4 py-2 text-center font-bold">{row.percent.toFixed(2)}%</td>
                    </tr>
                  ))}
                  <tr className="bg-black text-white font-bold">
                    <td className="px-4 py-2">TOTAL</td>
                    <td className="px-4 py-2 text-center">100%</td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-center">{totalPercent.toFixed(2)}%</td>
                  </tr>
               </tbody>
            </table>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-700 font-semibold mb-4 text-center">Despesas por Categoria</h3>
          <div className="h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sem dados de despesas</div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <h3 className="text-gray-700 font-semibold mb-4 text-center">Balanço do Mês</h3>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                  <Legend />
                  <Bar dataKey="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
