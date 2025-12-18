
import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
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
} from './storageService';
import { supabase } from './supabaseClient';
import { MONTHS, NEEDS_ITEMS } from './constants';
import TransactionModal from './TransactionModal';
import BudgetTable from './BudgetTable';
import Dashboard from './Dashboard';
import CategoryManagerModal from './CategoryManagerModal';
import BankImportModal from './BankImportModal';
import CategoryDetailsModal from './CategoryDetailsModal';
import ProjectionConfigModal from './ProjectionConfigModal';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [expenseGroups, setExpenseGroups] = useState<CategoryStructure[]>([]);
  const [projectionSettings, setProjectionSettings] = useState<ProjectionSettings>({ needs_items: NEEDS_ITEMS });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'table'>('table'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isProjectionModalOpen, setIsProjectionModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCategoryDetails, setSelectedCategoryDetails] = useState<{name: string, group: string} | null>(null);
  const [modalInitialType, setModalInitialType] = useState<TransactionType>('EXPENSE');
  const [modalFixedDesc, setModalFixedDesc] = useState<string | undefined>(undefined);
  const [modalFixedGroup, setModalFixedGroup] = useState<string | undefined>(undefined);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) loadUserData();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadUserData();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async () => {
    setDataLoading(true);
    try {
      const [txs, settings] = await Promise.all([
        fetchTransactions(),
        fetchUserSettings()
      ]);
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

  const filteredTransactions = transactions.filter(t => {
    if (!t.date) return false;
    const parts = t.date.split('-');
    const year = parseInt(parts[0]);
    const monthIndex = parseInt(parts[1]) - 1;
    return monthIndex === currentDate.getMonth() && year === currentDate.getFullYear();
  });

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'INCOME')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc, t) => acc + t.amount, 0);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Conta criada! Verifique seu email.");
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
    setDataLoading(true);
    try {
      if (txData.isSplit) {
        if (txData.originalId) await deleteTransaction(txData.originalId);
        for (const split of txData.splits) {
          await addTransaction({
            type: split.type,
            group: split.group,
            description: split.description,
            amount: split.amount,
            date: split.date,
            observation: `Dividido de lançamento anterior`
          });
        }
      } else if (txData.id) {
         await updateTransaction(txData.id, txData);
      } else {
         await addTransaction(txData);
      }
      await loadUserData();
    } catch (error) {
       console.error("Erro ao salvar:", error);
       setDataLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    setDataLoading(true);
    try {
      const success = await deleteTransaction(id);
      if (success) await loadUserData();
      else setDataLoading(false);
    } catch (error) {
      setDataLoading(false);
    }
  };

  const handleImportItems = async (items: ImportItem[]) => {
    setDataLoading(true);
    try {
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
      await loadUserData();
    } catch (error) {
      console.error("Erro ao importar lançamentos:", error);
    } finally {
      setDataLoading(false);
    }
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

  const handleCategoryClick = (category: string, group: string) => {
    setSelectedCategoryDetails({ name: category, group });
    setIsDetailsModalOpen(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border border-gray-200">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800">Orçamento Pessoal</h1>
          </div>
          {authError && <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4">{authError}</div>}
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" required placeholder="Email" className="w-full px-4 py-2 border rounded-lg" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" required placeholder="Senha" className="w-full px-4 py-2 border rounded-lg" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg">{isSignUp ? 'Cadastrar' : 'Entrar'}</button>
            <button type="button" className="w-full text-indigo-600 text-sm" onClick={() => setIsSignUp(!isSignUp)}>{isSignUp ? 'Já tem conta? Entrar' : 'Criar conta'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center sticky top-0 z-30">
        <h1 className="font-bold text-lg">Orçamento Pessoal</h1>
        <button onClick={handleLogout} className="text-gray-400 hover:text-white"><LogOut size={20} /></button>
      </header>
      
      <div className="bg-white border-b p-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-14 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}><ChevronLeft /></button>
          <span className="font-bold uppercase">{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}><ChevronRight /></button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('table')} className={`px-4 py-2 rounded ${activeTab === 'table' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>Planilha</button>
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>Gráficos</button>
          <button onClick={() => openModal('INCOME')} className="bg-green-600 text-white px-4 py-2 rounded">+</button>
          <button onClick={() => openModal('EXPENSE')} className="bg-red-600 text-white px-4 py-2 rounded">-</button>
        </div>
      </div>

      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        {activeTab === 'dashboard' ? (
          <Dashboard transactions={filteredTransactions} totalIncome={totalIncome} totalExpenses={totalExpenses} projectionSettings={projectionSettings} onOpenConfig={() => setIsProjectionModalOpen(true)} />
        ) : (
          <BudgetTable transactions={filteredTransactions} totalIncome={totalIncome} onOpenModalFor={openSpecificModal} incomeCategories={incomeCategories} expenseGroups={expenseGroups} onManageCategories={() => setIsCategoryModalOpen(true)} onOpenImport={() => setIsImportModalOpen(true)} onCategoryClick={handleCategoryClick} />
        )}
      </main>

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveTransaction} initialType={modalInitialType} fixedDescription={modalFixedDesc} fixedGroup={modalFixedGroup} incomeCategories={incomeCategories} expenseGroups={expenseGroups} editingTransaction={editingTransaction} />
      {selectedCategoryDetails && <CategoryDetailsModal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} categoryName={selectedCategoryDetails.name} transactions={filteredTransactions.filter(t => t.description === selectedCategoryDetails.name && (selectedCategoryDetails.group ? t.group === selectedCategoryDetails.group : true))} onDelete={handleDeleteTransaction} onEdit={(tx) => { setIsDetailsModalOpen(false); setEditingTransaction(tx); setIsModalOpen(true); }} />}
      <CategoryManagerModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} incomeCategories={incomeCategories} expenseGroups={expenseGroups} onSave={(inc, exp) => { setIncomeCategories(inc); setExpenseGroups(exp); saveUserSettings(inc, exp, projectionSettings); setIsCategoryModalOpen(false); }} />
      <BankImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={handleImportItems} expenseGroups={expenseGroups} incomeCategories={incomeCategories} existingTransactions={transactions} />
      <ProjectionConfigModal isOpen={isProjectionModalOpen} onClose={() => setIsProjectionModalOpen(false)} expenseGroups={expenseGroups} currentSettings={projectionSettings} onSave={(s) => { setProjectionSettings(s); saveUserSettings(incomeCategories, expenseGroups, s); setIsProjectionModalOpen(false); }} />
    </div>
  );
}

export default App;
