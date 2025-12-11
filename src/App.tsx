import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Calendar,
  Loader2
} from 'lucide-react';
import type { Transaction, TransactionType, CategoryStructure, ImportItem, ProjectionSettings } from './types';
import {
  fetchTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  fetchUserSettings,
  saveUserSettings,
  signOut
} from './services/storageService';
import { supabase } from './supabaseClient';
import { MONTHS, NEEDS_ITEMS } from './constants';
import TransactionModal from './components/TransactionModal';
import BudgetTable from './components/BudgetTable';
import Dashboard from './components/Dashboard';
import CategoryManagerModal from './components/CategoryManagerModal';
import BankImportModal from './components/BankImportModal';
import CategoryDetailsModal from './components/CategoryDetailsModal';
import ProjectionConfigModal from './components/ProjectionConfigModal';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Categories & Settings State
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [expenseGroups, setExpenseGroups] = useState<CategoryStructure[]>([]);
  const [projectionSettings, setProjectionSettings] = useState<ProjectionSettings>({ needs_items: NEEDS_ITEMS });

  // UI State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'table'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isProjectionModalOpen, setIsProjectionModalOpen] = useState(false);

  // Details Modal State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCategoryDetails, setSelectedCategoryDetails] = useState<{name: string, group: string} | null>(null);

  const [modalInitialType, setModalInitialType] = useState<TransactionType>('EXPENSE');
  const [modalFixedDesc, setModalFixedDesc] = useState<string | undefined>(undefined);
  const [modalFixedGroup, setModalFixedGroup] = useState<string | undefined>(undefined);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 1. Check Auth Session on Mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) loadUserData();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadUserData();
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Load User Data (Transactions & Categories)
  const loadUserData = async () => {
    setDataLoading(true);
    console.log('[DEBUG App] Recarregando todos os dados do servidor...');
    try {
      const [txs, settings] = await Promise.all([
        fetchTransactions(),
        fetchUserSettings()
      ]);
      console.log(`[DEBUG App] Dados carregados. Total Transações: ${txs.length}`);
      setTransactions(txs);
      setIncomeCategories(settings.income);
      setExpenseGroups(settings.expenses);
      setProjectionSettings(settings.projection);
    } catch (error) {
      console.error("Erro ao carregar dados", error);
    } finally {
      setDataLoading(false);
    }
  };

  // Filter transactions for current month/year
  // Usamos parsing manual da string "YYYY-MM-DD" para evitar problemas de fuso horário
  const filteredTransactions = transactions.filter(t => {
    if (!t.date) return false;
    // t.date é esperado como YYYY-MM-DD
    const parts = t.date.split('-');
    if (parts.length < 3) return false;

    const year = parseInt(parts[0]);
    const monthIndex = parseInt(parts[1]) - 1; // Mês 0-11

    return (
      monthIndex === currentDate.getMonth() &&
      year === currentDate.getFullYear()
    );
  });

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'INCOME')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc, t) => acc + t.amount, 0);

  // Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Conta criada! Verifique seu email para confirmar (se necessário) ou faça login.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setSession(null);
    setTransactions([]);
  };

  const handleSaveTransaction = async (txData: any) => {
    console.log('[DEBUG App] handleSaveTransaction chamado com:', txData);

    // Mostra o loading imediatamente para feedback visual
    setDataLoading(true);

    try {
      if (txData.id) {
         // Update
         console.log('[DEBUG App] Iniciando atualização...');
         await updateTransaction(txData.id, {
            amount: txData.amount,
            date: txData.date,
            description: txData.description,
            group: txData.group,
            observation: txData.observation,
            type: txData.type
         });
      } else {
         // Create
         console.log('[DEBUG App] Criando nova transação...');
         await addTransaction(txData);
      }

      // IMPORTANTE: Força o recarregamento dos dados do servidor
      // Isso garante que a UI mostre exatamente o que está no banco,
      // resolvendo problemas de cache local ou IDs alterados.
      await loadUserData();

    } catch (error) {
       console.error("Erro ao salvar transação:", error);
       setDataLoading(false); // Remove loading em caso de erro (se loadUserData não rodar)
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    setDataLoading(true);
    try {
      const success = await deleteTransaction(id);
      if (success) {
        // Se deletou com sucesso, recarrega tudo para atualizar totais e listas
        await loadUserData();

        // Se estávamos vendo detalhes, e a transação sumiu, talvez fechar o modal ou atualizar a lista filtrada?
        // O loadUserData atualiza 'transactions', que atualiza 'filteredTransactions'.
        // O modal de detalhes usa 'filteredTransactions', então ele se atualiza sozinho.
      } else {
        setDataLoading(false);
      }
    } catch (error) {
      console.error("Erro ao deletar:", error);
      setDataLoading(false);
    }
  };

  const handleSaveSettings = async (newIncome: string[], newExpenses: CategoryStructure[]) => {
    // Update local state first for immediate UI response
    setIncomeCategories(newIncome);
    setExpenseGroups(newExpenses);
    // Persist to DB, passing current projection settings to keep them
    await saveUserSettings(newIncome, newExpenses, projectionSettings);
  };

  const handleSaveProjection = async (newProj: ProjectionSettings) => {
    setProjectionSettings(newProj);
    await saveUserSettings(incomeCategories, expenseGroups, newProj);
  };

  const handleImportItems = async (items: ImportItem[]) => {
    setDataLoading(true);
    // Process one by one (or could use bulk insert if backend supports)
    for (const item of items) {
       await addTransaction({
        date: item.date,
        amount: item.amount,
        description: item.selectedCategory,
        group: item.selectedGroup,
        type: item.type,
        observation: `Importado: ${item.description}`
       });
    }
    await loadUserData(); // Refresh all
    setDataLoading(false);
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const openModal = (type: TransactionType) => {
    setModalInitialType(type);
    setModalFixedDesc(undefined);
    setModalFixedGroup(undefined);
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const openSpecificModal = (type: TransactionType, desc: string, group: string) => {
    setModalInitialType(type);
    setModalFixedDesc(desc);
    setModalFixedGroup(group);
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  // --- Category Details Logic ---
  const handleCategoryClick = (category: string, group: string) => {
     setSelectedCategoryDetails({ name: category, group });
     setIsDetailsModalOpen(true);
  };

  const handleEditFromDetails = (tx: Transaction) => {
     setIsDetailsModalOpen(false); // Close details
     setEditingTransaction(tx);
     setModalFixedDesc(undefined);
     setModalFixedGroup(undefined);
     setModalInitialType(tx.type);
     setIsModalOpen(true);
  };

  // --- Auth Screen ---
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border border-gray-200">
          <div className="text-center mb-8">
            <div className="bg-indigo-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
              <UserIcon size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Orçamento Pessoal</h1>
            <p className="text-gray-500 mt-2">Sincronizado em todos os dispositivos</p>
          </div>

          {authError && (
             <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4 border border-red-200">
               {authError}
             </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg transition-colors shadow-md"
            >
              {isSignUp ? 'Criar Conta' : 'Entrar'}
            </button>
            <div className="text-center mt-4">
               <button
                type="button"
                className="text-indigo-600 text-sm hover:underline"
                onClick={() => setIsSignUp(!isSignUp)}
               >
                 {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastre-se'}
               </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Main App ---
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col font-sans">

      {/* Header Compacto */}
      <header className="bg-gray-800 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <LayoutDashboard size={20} className="text-indigo-400" />
             <span className="font-bold text-lg tracking-wide hidden sm:inline">Orçamento<span className="text-indigo-400">Pessoal</span></span>
             <span className="font-bold text-lg tracking-wide sm:hidden">OP</span>
          </div>

          <div className="flex items-center gap-4 text-sm">
             <span className="text-gray-300 hidden sm:block text-xs">{session.user.email}</span>
             <button onClick={handleLogout} className="text-gray-400 hover:text-white transition-colors" title="Sair">
               <LogOut size={18} />
             </button>
          </div>
        </div>
      </header>

      {/* Toolbar / Controle de Mês */}
      <div className="bg-white border-b border-gray-300 shadow-sm z-20 py-3">
         <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">

             {/* Navegação de Mês */}
             <div className="flex items-center bg-gray-100 rounded border border-gray-300">
                <button onClick={() => changeMonth('prev')} className="px-3 py-1.5 hover:bg-gray-200 text-gray-600 border-r border-gray-300 transition-colors">
                  <ChevronLeft size={20} />
                </button>
                <div className="w-48 text-center font-bold text-gray-800 uppercase tracking-wide flex items-center justify-center gap-2">
                  <Calendar size={16} className="text-gray-500" />
                  {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                </div>
                <button onClick={() => changeMonth('next')} className="px-3 py-1.5 hover:bg-gray-200 text-gray-600 border-l border-gray-300 transition-colors">
                  <ChevronRight size={20} />
                </button>
             </div>

             {/* Controles */}
             <div className="flex gap-4 w-full md:w-auto">
               <div className="flex bg-gray-100 rounded p-1 border border-gray-300">
                  <button
                    onClick={() => setActiveTab('table')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all ${activeTab === 'table' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Planilha
                  </button>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Gráficos
                  </button>
               </div>

               <div className="flex gap-2 flex-1 md:flex-none">
                 <button
                   onClick={() => openModal('INCOME')}
                   className="flex-1 flex items-center justify-center gap-1 bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded text-sm font-medium shadow-sm transition-colors"
                 >
                   <PlusCircle size={16} />
                   <span className="hidden sm:inline">Receita</span>
                 </button>
                 <button
                   onClick={() => openModal('EXPENSE')}
                   className="flex-1 flex items-center justify-center gap-1 bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded text-sm font-medium shadow-sm transition-colors"
                 >
                   <PlusCircle size={16} />
                   <span className="hidden sm:inline">Despesa</span>
                 </button>
               </div>
             </div>
         </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-grow p-4 sm:p-6 mx-auto w-full max-w-7xl relative">
         {dataLoading && (
            <div className="absolute inset-0 bg-gray-100 bg-opacity-50 z-10 flex items-start justify-center pt-20">
               <Loader2 className="animate-spin text-gray-600" size={32} />
            </div>
         )}

         {activeTab === 'dashboard' ? (
           <Dashboard
             transactions={filteredTransactions}
             totalIncome={totalIncome}
             totalExpenses={totalExpenses}
             projectionSettings={projectionSettings}
             onOpenConfig={() => setIsProjectionModalOpen(true)}
           />
         ) : (
           <BudgetTable
             transactions={filteredTransactions}
             totalIncome={totalIncome}
             onOpenModalFor={openSpecificModal}
             incomeCategories={incomeCategories}
             expenseGroups={expenseGroups}
             onManageCategories={() => setIsCategoryModalOpen(true)}
             onOpenImport={() => setIsImportModalOpen(true)}
             onCategoryClick={handleCategoryClick}
           />
         )}

      </main>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTransaction}
        initialType={modalInitialType}
        fixedDescription={modalFixedDesc}
        fixedGroup={modalFixedGroup}
        incomeCategories={incomeCategories}
        expenseGroups={expenseGroups}
        editingTransaction={editingTransaction}
      />

      {selectedCategoryDetails && (
        <CategoryDetailsModal
           isOpen={isDetailsModalOpen}
           onClose={() => setIsDetailsModalOpen(false)}
           categoryName={selectedCategoryDetails.name}
           transactions={filteredTransactions.filter(t =>
              t.description === selectedCategoryDetails.name &&
              (selectedCategoryDetails.group ? t.group === selectedCategoryDetails.group : true)
           )}
           onDelete={handleDeleteTransaction}
           onEdit={handleEditFromDetails}
        />
      )}

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        incomeCategories={incomeCategories}
        expenseGroups={expenseGroups}
        onSave={handleSaveSettings}
      />

      <BankImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportItems}
        expenseGroups={expenseGroups}
        incomeCategories={incomeCategories}
        existingTransactions={transactions}
      />

      <ProjectionConfigModal
        isOpen={isProjectionModalOpen}
        onClose={() => setIsProjectionModalOpen(false)}
        expenseGroups={expenseGroups}
        currentSettings={projectionSettings}
        onSave={handleSaveProjection}
      />

    </div>
  );
}

export default App;