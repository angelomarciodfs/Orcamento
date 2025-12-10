import React from 'react';
import type { Transaction, TransactionType, CategoryStructure } from '../types';
import { Settings, FileSpreadsheet } from 'lucide-react';

interface BudgetTableProps {
  transactions: Transaction[];
  totalIncome: number;
  onOpenModalFor: (type: TransactionType, description: string, group: string) => void;
  incomeCategories: string[];
  expenseGroups: CategoryStructure[];
  onManageCategories: () => void;
  onOpenImport: () => void;
  onCategoryClick: (category: string, group: string) => void;
}

const BudgetTable: React.FC<BudgetTableProps> = ({
  transactions,
  totalIncome,
  onOpenModalFor,
  incomeCategories,
  expenseGroups,
  onManageCategories,
  onOpenImport,
  onCategoryClick
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

  // Main Income/Expense Logic
  const expenseTransactions = transactions.filter(t => t.type === 'EXPENSE');
  const totalExpenses = expenseTransactions.reduce((acc, t) => acc + t.amount, 0);
  const resultFinal = totalIncome - totalExpenses;

  // Extra & Banking Logic
  const extraIncome = transactions.filter(t => t.type === 'EXTRA' && t.description === 'Receita Extra').reduce((acc, t) => acc + t.amount, 0);

  const santanderBalance = transactions.filter(t => t.type === 'BALANCE' && t.description === 'Santander').reduce((acc, t) => acc + t.amount, 0);
  const bbBalance = transactions.filter(t => t.type === 'BALANCE' && t.description === 'Banco do Brasil').reduce((acc, t) => acc + t.amount, 0);
  const interBalance = transactions.filter(t => t.type === 'BALANCE' && t.description === 'Banco Inter').reduce((acc, t) => acc + t.amount, 0);

  const totalBancario = santanderBalance + bbBalance + resultFinal + extraIncome;
  const totalFinanceiro = totalBancario + interBalance;

  // Shared Cell Styles
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
    isEditable?: boolean; // For manual adding (edit icon on right)
  }

  const Row: React.FC<RowProps> = ({
    label,
    value,
    isGroupHeader = false,
    groupName,
    onAddClick,
    bgColor = "bg-white",
    textColor = "text-gray-800",
    isEditable = false,
  }) => (
    <div className={`grid grid-cols-[1fr_140px_80px] border-b border-gray-300 hover:brightness-95 transition-all group ${bgColor} ${textColor}`}>
      <div
        className={`${cellBase} ${isGroupHeader ? 'font-bold uppercase tracking-wider' : 'cursor-pointer hover:underline'} relative`}
        onClick={() => {
            if(!isGroupHeader) {
                onCategoryClick(label, groupName || (isGroupHeader ? label : ''));
            }
        }}
        title={!isGroupHeader ? "Clique para ver detalhes" : ""}
      >
        {label}
      </div>
      <div className={`${cellValue} relative`}>
        {value !== undefined ? formatCurrency(value) : ''}
        {isEditable && onAddClick && (
           <button
             onClick={(e) => { e.stopPropagation(); onAddClick(); }}
             className="absolute left-2 text-blue-500 hover:text-blue-700 opacity-50 hover:opacity-100 transition-opacity"
             title="Inserir valor manualmente"
           >
             ✎
           </button>
        )}
      </div>
      <div className={cellPercent}>
        {value !== undefined && !isGroupHeader && !['Receita Extra', 'Santander', 'Banco do Brasil', 'Banco Inter'].includes(label) ? calcPercent(value) : ''}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">

      <div className="flex justify-end gap-2">
         <button
           onClick={onManageCategories}
           className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white rounded shadow text-sm hover:bg-gray-700 transition-colors"
         >
           <Settings size={16} />
           Gerenciar Categorias
         </button>
         <button
           onClick={onOpenImport}
           className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded shadow text-sm hover:bg-indigo-700 transition-colors"
         >
           <FileSpreadsheet size={16} />
           Importar Extrato
         </button>
      </div>

      <div className="bg-white shadow-2xl overflow-hidden border border-gray-400">

        {/* HEADER PRINCIPAL */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-gray-800 text-white font-bold text-sm border-b border-gray-800">
          <div className="px-2 py-2 uppercase text-center border-r border-gray-600">Categoria</div>
          <div className="px-2 py-2 uppercase text-center border-r border-gray-600">Valor (R$)</div>
          <div className="px-2 py-2 uppercase text-center">%</div>
        </div>

        {/* ================= RECEITAS ================= */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-[#d7e4bc] border-b border-gray-400 text-[#006100] font-bold">
          <div className="px-2 py-1 uppercase">RECEITAS</div>
          <div className="px-2 py-1"></div>
          <div className="px-2 py-1"></div>
        </div>

        {incomeCategories.map(cat => {
          const val = getSum(cat);
          return <Row key={cat} label={cat} groupName="Receitas" value={val} bgColor="bg-[#ebf1de]" textColor="text-gray-800" />;
        })}

        <div className="grid grid-cols-[1fr_140px_80px] bg-black text-white font-bold border-y-2 border-gray-800">
          <div className="px-2 py-1.5 uppercase">TOTAL RECEITA</div>
          <div className="px-2 py-1.5 text-right font-mono">{formatCurrency(totalIncome)}</div>
          <div className="px-2 py-1.5 text-center text-xs font-mono">100%</div>
        </div>


        {/* ================= DESPESAS ================= */}
        <div className="h-4 bg-gray-100 border-b border-gray-300"></div> {/* Spacer */}

        <div className="grid grid-cols-[1fr_140px_80px] bg-[#f2dcdb] border-b border-gray-400 text-[#963634] font-bold">
          <div className="px-2 py-1 uppercase">SAÍDAS (DESPESAS)</div>
          <div className="px-2 py-1"></div>
          <div className="px-2 py-1"></div>
        </div>

        {expenseGroups.map((group) => {
          return (
            <React.Fragment key={group.name}>
               <Row label={group.name} isGroupHeader bgColor="bg-[#fde9d9]" textColor="text-[#e26b0a]" />

               {group.items.map(item => {
                  const val = getSum(item, group.name);
                  return <Row key={item} label={item} groupName={group.name} value={val} bgColor="bg-white" />;
               })}
            </React.Fragment>
          );
        })}

        <div className="grid grid-cols-[1fr_140px_80px] bg-[#f2dcdb] text-[#963634] font-bold border-y border-gray-400 mt-2">
          <div className="px-2 py-1.5 uppercase">TOTAL DESPESAS</div>
          <div className="px-2 py-1.5 text-right font-mono">{formatCurrency(totalExpenses)}</div>
          <div className="px-2 py-1.5 text-center text-xs font-mono">{calcPercent(totalExpenses)}</div>
        </div>

        {/* ================= RESULTADO ================= */}
        <div className="h-4 bg-gray-100 border-b border-gray-300"></div>

        <div className="grid grid-cols-[1fr_140px_80px] bg-black text-white font-bold border-t-2 border-gray-800">
          <div className="px-2 py-2 uppercase flex items-center">RESULTADO (Receita - Despesa)</div>
          <div className={`px-2 py-2 text-right font-mono text-lg ${resultFinal >= 0 ? 'text-[#a9d08e]' : 'text-[#ff7c80]'}`}>
            {formatCurrency(resultFinal)}
          </div>
          <div className={`px-2 py-2 text-center flex items-center justify-center font-mono ${resultFinal >= 0 ? 'text-[#a9d08e]' : 'text-[#ff7c80]'}`}>
             {calcPercent(resultFinal)}
          </div>
        </div>

        {/* ================= FINANCEIRO EXTRA ================= */}
        <div className="h-4 bg-gray-100 border-b border-gray-300"></div>

        {/* RECEITA EXTRA */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-[#b7dee8] border-b border-gray-400 font-bold">
          <div className="px-2 py-1 uppercase text-gray-800">RECEITA EXTRA</div>
          <div className="px-2 py-1"></div>
          <div className="px-2 py-1"></div>
        </div>
        <Row
          label="Receita Extra"
          value={extraIncome}
          bgColor="bg-white"
          isEditable
          groupName="Extra"
          onAddClick={() => {
             onOpenModalFor('EXTRA', 'Receita Extra', 'Extra');
          }}
        />

        {/* EXTRATOS BANCÁRIOS */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-black text-white font-bold border-t-2 border-gray-800 mt-2">
           <div className="px-2 py-1 uppercase">EXTRATOS BANCÁRIOS</div>
           <div className="px-2 py-1"></div>
           <div className="px-2 py-1"></div>
        </div>
        <Row
          label="Santander"
          value={santanderBalance}
          bgColor="bg-[#d7e4bc]"
          isEditable
          groupName="Bancos"
          onAddClick={() => onOpenModalFor('BALANCE', 'Santander', 'Bancos')}
        />
        <Row
          label="Banco do Brasil"
          value={bbBalance}
          bgColor="bg-[#d7e4bc]"
          isEditable
          groupName="Bancos"
          onAddClick={() => onOpenModalFor('BALANCE', 'Banco do Brasil', 'Bancos')}
        />

        <div className="grid grid-cols-[1fr_140px_80px] bg-[#92d050] text-black font-bold border-y border-gray-600">
           <div className="px-2 py-1 uppercase">TOTAL BANCÁRIO</div>
           <div className="px-2 py-1 text-right font-mono">{formatCurrency(totalBancario)}</div>
           <div className="px-2 py-1"></div>
        </div>

        {/* INVESTIMENTOS */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-[#31869b] text-white font-bold border-t-2 border-gray-800 mt-2">
           <div className="px-2 py-1 uppercase">INVESTIMENTOS</div>
           <div className="px-2 py-1"></div>
           <div className="px-2 py-1"></div>
        </div>
        <Row
          label="Banco Inter"
          value={interBalance}
          bgColor="bg-white"
          isEditable
          groupName="Investimentos"
          onAddClick={() => onOpenModalFor('BALANCE', 'Banco Inter', 'Investimentos')}
        />

        {/* TOTAL FINANCEIRO */}
        <div className="grid grid-cols-[1fr_140px_80px] bg-black text-white font-bold border-t-2 border-gray-800 mt-2 text-lg">
           <div className="px-2 py-2 uppercase">TOTAL FINANCEIRO</div>
           <div className="px-2 py-2 text-right font-mono">{formatCurrency(totalFinanceiro)}</div>
           <div className="px-2 py-2"></div>
        </div>

      </div>
    </div>
  );
};

export default BudgetTable;