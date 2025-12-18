
import React from 'react';
import type { Transaction, TransactionType, CategoryStructure } from './types';
import { Settings, FileSpreadsheet, Search } from 'lucide-react';

interface BudgetTableProps {
  transactions: Transaction[];
  totalIncome: number;
  onOpenModalFor: (type: TransactionType, description: string, group: string) => void;
  incomeCategories: string[];
  expenseGroups: CategoryStructure[];
  bankList: string[];
  investmentList: string[];
  onManageCategories: () => void;
  onOpenImport: () => void;
  onCategoryClick: (category: string, group: string) => void;
  onOpenSearch: () => void;
}

const BudgetTable: React.FC<BudgetTableProps> = ({ 
  transactions, 
  totalIncome, 
  onOpenModalFor,
  incomeCategories,
  expenseGroups,
  bankList = [],
  investmentList = [],
  onManageCategories,
  onOpenImport,
  onCategoryClick,
  onOpenSearch
}) => {
  
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const calcPercent = (val: number) => {
    if (totalIncome === 0) return '0.0%';
    return ((val / totalIncome) * 100).toFixed(1) + '%';
  };

  const getSum = (desc: string, group?: string) => {
    return transactions
      .filter(t => t.description === desc && (group ? t.group === group : true))
      .reduce((acc, curr) => acc + curr.amount, 0);
  };

  // Cálculos de Despesas e Resultado
  const expenseTransactions = transactions.filter(t => t.type === 'EXPENSE');
  const totalExpenses = expenseTransactions.reduce((acc, t) => acc + t.amount, 0);
  const extraIncome = transactions.filter(t => t.type === 'EXTRA' && t.description === 'Receita Extra').reduce((acc, t) => acc + t.amount, 0);
  const resultFinal = totalIncome - totalExpenses; 

  // Dinâmico: Soma de todos os bancos na lista do usuário
  const totalBancario = bankList.reduce((acc, bank) => acc + getSum(bank, 'Bancos'), 0) + resultFinal + extraIncome;

  // Dinâmico: Soma de todos os investimentos na lista do usuário
  const totalInvestimentos = investmentList.reduce((acc, inv) => acc + getSum(inv, 'Investimentos'), 0);

  // Total Financeiro Global
  const totalFinanceiro = totalBancario + totalInvestimentos;

  const cellBase = "px-2 py-1 border-r border-gray-300 text-sm flex items-center";
  const cellValue = "px-2 py-1 border-r border-gray-300 text-sm text-right font-mono flex items-center justify-end";
  const cellPercent = "px-2 py-1 text-xs text-center font-mono flex items-center justify-center bg-gray-50 text-gray-600";
  
  interface RowProps {
    label: string;
    value?: number;
    isGroupHeader?: boolean;
    groupName?: string; 
    onAddClick?: () => void;
    bgColor?: string;
    textColor?: string;
    isEditable?: boolean; 
  }

  const Row: React.FC<RowProps> = ({ label, value, isGroupHeader = false, groupName, onAddClick, bgColor = "bg-white", textColor = "text-gray-800", isEditable = false }) => (
    <div className={`grid grid-cols-[1fr_140px_80px] border-b border-gray-300 hover:brightness-95 transition-all group ${bgColor} ${textColor}`}>
      <div className={`${cellBase} ${isGroupHeader ? 'font-bold uppercase tracking-wider' : 'cursor-pointer hover:underline'} relative`} onClick={() => !isGroupHeader && onCategoryClick(label, groupName || '')}>
        {label}
      </div>
      <div className={`${cellValue} relative`}>
        {value !== undefined ? formatCurrency(value) : ''}
        {isEditable && onAddClick && (
           <button onClick={(e) => { e.stopPropagation(); onAddClick(); }} className="absolute left-2 text-indigo-500 hover:text-indigo-700 opacity-50 hover:opacity-100 transition-opacity">
             ✎
           </button>
        )}
      </div>
      <div className={cellPercent}>
        {value !== undefined && !isGroupHeader && !['Receita Extra', ...bankList, ...investmentList, 'Saldo Total'].includes(label) ? calcPercent(value) : ''}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-12">
      {/* Ferramentas de Gestão */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-4 rounded-xl shadow-md border border-gray-200">
         <div className="flex flex-col">
            <h3 className="text-gray-700 font-bold text-sm">Ferramentas de Gestão</h3>
            <p className="text-[10px] text-gray-400 uppercase tracking-tighter">Categorias, Busca e Importação</p>
         </div>
         <div className="flex flex-wrap gap-2 justify-center sm:justify-end w-full sm:w-auto">
           <button onClick={onOpenSearch} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all shadow-sm">
             <Search size={14} /> Pesquisar
           </button>
           <button onClick={onManageCategories} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-900 transition-all shadow-sm">
             <Settings size={14} /> Gerenciar
           </button>
           <button onClick={onOpenImport} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm">
             <FileSpreadsheet size={14} /> Importar Extrato
           </button>
         </div>
      </div>

      <div className="bg-white shadow-2xl overflow-hidden border border-gray-400 rounded-sm">
        {/* Header Principal */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-gray-800 text-white font-bold text-xs border-b border-gray-800">
          <div className="px-2 py-2 uppercase text-center border-r border-gray-600">Categoria / Item</div>
          <div className="px-2 py-2 uppercase text-center border-r border-gray-600">Valor Atual</div>
          <div className="px-2 py-2 uppercase text-center">% s/ Rec.</div>
        </div>

        {/* Seção Receitas */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-[#d7e4bc] border-b border-gray-400 text-[#006100] font-bold">
          <div className="px-2 py-1 uppercase">RECEITAS</div>
          <div className="px-2 py-1"></div>
          <div className="px-2 py-1"></div>
        </div>
        {incomeCategories.map(cat => <Row key={cat} label={cat} groupName="Receitas" value={getSum(cat)} bgColor="bg-[#ebf1de]" />)}
        <div className="grid grid-cols-[1fr_140px_80px] bg-black text-white font-bold border-y-2 border-gray-800">
          <div className="px-2 py-1.5 uppercase">TOTAL RECEITA</div>
          <div className="px-2 py-1.5 text-right font-mono">{formatCurrency(totalIncome)}</div>
          <div className="px-2 py-1.5 text-center text-xs font-mono">100%</div>
        </div>

        <div className="h-4 bg-gray-100 border-b border-gray-300"></div>

        {/* Seção Despesas */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-[#f2dcdb] border-b border-gray-400 text-[#963634] font-bold">
          <div className="px-2 py-1 uppercase">SAÍDAS (DESPESAS)</div>
          <div className="px-2 py-1"></div>
          <div className="px-2 py-1"></div>
        </div>
        {expenseGroups.map((group) => (
          <React.Fragment key={group.name}>
             <Row label={group.name} isGroupHeader bgColor="bg-[#fde9d9]" textColor="text-[#e26b0a]" />
             {group.items.map(item => <Row key={item} label={item} groupName={group.name} value={getSum(item, group.name)} />)}
          </React.Fragment>
        ))}
        <div className="grid grid-cols-[1fr_140px_80px] bg-[#f2dcdb] text-[#963634] font-bold border-y border-gray-400 mt-2">
          <div className="px-2 py-1.5 uppercase text-xs">SUBTOTAL DESPESAS</div>
          <div className="px-2 py-1.5 text-right font-mono">{formatCurrency(totalExpenses)}</div>
          <div className="px-2 py-1.5 text-center text-xs font-mono">{calcPercent(totalExpenses)}</div>
        </div>

        <div className="h-4 bg-gray-100 border-b border-gray-300"></div>

        {/* Resultado do Mês */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-black text-white font-bold border-t-2 border-gray-800">
          <div className="px-2 py-2 uppercase flex items-center">RESULTADO DO MÊS</div>
          <div className={`px-2 py-2 text-right font-mono text-lg ${resultFinal >= 0 ? 'text-[#a9d08e]' : 'text-[#ff7c80]'}`}>{formatCurrency(resultFinal)}</div>
          <div className="px-2 py-2"></div>
        </div>

        <div className="h-4 bg-gray-100 border-b border-gray-300"></div>

        {/* Receita Extra */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-[#b7dee8] border-b border-gray-400 font-bold">
          <div className="px-2 py-1 uppercase text-gray-800 text-xs tracking-widest">OUTROS GANHOS</div>
          <div className="px-2 py-1"></div>
          <div className="px-2 py-1"></div>
        </div>
        <Row label="Receita Extra" value={extraIncome} isEditable groupName="Extra" onAddClick={() => onOpenModalFor('EXTRA', 'Receita Extra', 'Extra')} />

        <div className="h-4 bg-gray-100 border-b border-gray-300"></div>

        {/* Extratos Bancários Dinâmicos */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-black text-white font-bold border-t-2 border-gray-800">
           <div className="px-2 py-1 uppercase">EXTRATOS BANCÁRIOS</div>
           <div className="px-2 py-1"></div>
           <div className="px-2 py-1"></div>
        </div>
        {bankList.map(bank => (
          <Row 
            key={bank} 
            label={bank} 
            value={getSum(bank, 'Bancos')} 
            bgColor="bg-[#b7dee8]" 
            isEditable 
            groupName="Bancos" 
            onAddClick={() => onOpenModalFor('BALANCE', bank, 'Bancos')} 
          />
        ))}
        {bankList.length === 0 && <div className="p-2 text-xs text-gray-400 bg-gray-50 italic text-center">Nenhum banco cadastrado no gerenciador.</div>}
        
        <div className="grid grid-cols-[1fr_140px_80px] bg-[#d7e4bc] text-[#006100] font-bold border-y border-gray-600">
           <div className="px-2 py-1 uppercase">TOTAL DISPONÍVEL BANCÁRIO</div>
           <div className="px-2 py-1 text-right font-mono">{formatCurrency(totalBancario)}</div>
           <div className="px-2 py-1"></div>
        </div>

        <div className="h-4 bg-gray-100 border-b border-gray-300"></div>

        {/* Seção Investimentos Dinâmicos */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-black text-white font-bold border-t-2 border-gray-800">
           <div className="px-2 py-1 uppercase">INVESTIMENTOS</div>
           <div className="px-2 py-1"></div>
           <div className="px-2 py-1"></div>
        </div>
        {investmentList.map(inv => (
          <Row 
            key={inv} 
            label={inv} 
            value={getSum(inv, 'Investimentos')} 
            bgColor="bg-[#b7dee8]" 
            isEditable 
            groupName="Investimentos" 
            onAddClick={() => onOpenModalFor('BALANCE', inv, 'Investimentos')} 
          />
        ))}
        {investmentList.length === 0 && <div className="p-2 text-xs text-gray-400 bg-gray-50 italic text-center">Nenhum investimento cadastrado no gerenciador.</div>}
        
        <div className="grid grid-cols-[1fr_140px_80px] bg-[#d7e4bc] text-[#006100] font-bold border-y border-gray-600">
           <div className="px-2 py-1 uppercase">TOTAL INVESTIMENTOS</div>
           <div className="px-2 py-1 text-right font-mono">{formatCurrency(totalInvestimentos)}</div>
           <div className="px-2 py-1"></div>
        </div>

        <div className="h-4 bg-gray-100 border-b border-gray-300"></div>

        {/* Total Financeiro / Saldo Total */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-gray-900 text-white font-bold border-t-2 border-gray-800">
           <div className="px-2 py-2 uppercase flex items-center">TOTAL FINANCEIRO (GERAL)</div>
           <div className="px-2 py-2"></div>
           <div className="px-2 py-2"></div>
        </div>
        <div className="grid grid-cols-[1fr_140px_80px] bg-white border-b border-gray-300 font-bold text-gray-900">
          <div className="px-2 py-3 flex items-center border-r border-gray-300">SALDO TOTAL CONSOLIDADO</div>
          <div className="px-2 py-3 text-right font-mono text-xl border-r border-gray-300 flex items-center justify-end text-indigo-700 bg-indigo-50/30">
            {formatCurrency(totalFinanceiro)}
          </div>
          <div className="bg-gray-50"></div>
        </div>
      </div>
    </div>
  );
};

export default BudgetTable;
