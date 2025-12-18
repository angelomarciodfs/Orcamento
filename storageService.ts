
import { supabase } from './supabaseClient';
import type { Transaction, CategoryStructure, ProjectionSettings } from './types';
import { INITIAL_INCOME_CATEGORIES, INITIAL_EXPENSE_GROUPS, NEEDS_ITEMS } from './constants';

export const fetchTransactions = async (): Promise<Transaction[]> => {
  const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: true });
  if (error) {
    console.error("Erro ao buscar transações:", error);
    return [];
  }
  return data || [];
};

export const addTransaction = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('transactions').insert([{ ...transaction, user_id: user.id }]).select().single();
  if (error) {
    console.error("Erro ao adicionar transação:", error);
    return null;
  }
  return data;
};

export const updateTransaction = async (id: string, updates: Partial<Transaction>): Promise<Transaction | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { error: deleteError } = await supabase.from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error("Erro ao remover registro antigo para atualização:", deleteError);
    return null;
  }

  const { id: _, created_at: __, user_id: ___, ...cleanData } = updates as any;
  return await addTransaction(cleanData);
};

export const deleteTransaction = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  return !error;
};

export const fetchUserSettings = async (): Promise<{ 
  income: string[], 
  expenses: CategoryStructure[], 
  projection: ProjectionSettings,
  banks: string[],
  investments: string[]
}> => {
  const { data: { user } } = await supabase.auth.getUser();
  const defaults = { 
      income: INITIAL_INCOME_CATEGORIES, 
      expenses: INITIAL_EXPENSE_GROUPS,
      projection: { needs_items: NEEDS_ITEMS },
      banks: ['Banco CEF', 'Santander', 'Banco do Brasil'],
      investments: ['Tesouro Direto']
  };
  
  if (!user) return defaults;

  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
  
  if (error) {
    console.error("Erro ao carregar configurações:", error);
    return defaults;
  }

  if (!data) return defaults;

  return {
    income: data.income_categories || defaults.income,
    expenses: data.expense_groups || defaults.expenses,
    projection: data.projection_settings || defaults.projection,
    banks: data.bank_list || defaults.banks,
    investments: data.investment_list || defaults.investments
  };
};

export const saveUserSettings = async (
  income: string[], 
  expenses: CategoryStructure[], 
  projection: ProjectionSettings,
  banks: string[],
  investments: string[]
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Usuário não autenticado");
  }

  // Montamos o payload exatamente com os nomes das colunas da tabela
  const payload = { 
    user_id: user.id, 
    income_categories: income, 
    expense_groups: expenses,
    projection_settings: projection,
    bank_list: banks,
    investment_list: investments
  };
  
  console.log("Tentando salvar configurações no Supabase:", payload);

  // O onConflict 'user_id' só funciona se houver uma UNIQUE CONSTRAINT no banco de dados.
  const { error } = await supabase
    .from('user_settings')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    console.error("Erro detalhado ao salvar configurações:", error);
    throw error;
  }
};

export const signOut = async () => { await supabase.auth.signOut(); };
