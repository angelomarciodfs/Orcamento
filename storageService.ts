
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
  if (error) return null;
  return data;
};

export const updateTransaction = async (id: string, updates: Partial<Transaction>): Promise<Transaction | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  // Remove o ID do objeto de atualização para evitar erro de 'Primary Key update'
  const { id: _, created_at: __, user_id: ___, ...dataToUpdate } = updates as any;
  
  const { data, error } = await supabase.from('transactions')
    .update(dataToUpdate)
    .eq('id', id)
    .eq('user_id', user.id)
    .select();

  if (data && data.length > 0) return data[0];
  if (error) {
    console.error("Erro ao atualizar transação:", error);
    throw error;
  }
  return null;
};

export const deleteTransaction = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  return !error;
};

export const fetchUserSettings = async (): Promise<{ income: string[], expenses: CategoryStructure[], projection: ProjectionSettings }> => {
  const { data: { user } } = await supabase.auth.getUser();
  const defaults = { 
      income: INITIAL_INCOME_CATEGORIES, 
      expenses: INITIAL_EXPENSE_GROUPS,
      projection: { needs_items: NEEDS_ITEMS }
  };
  if (!user) return defaults;
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
  if (error || !data) return defaults;
  return {
    income: data.income_categories || INITIAL_INCOME_CATEGORIES,
    expenses: data.expense_groups || INITIAL_EXPENSE_GROUPS,
    projection: data.projection_settings || { needs_items: NEEDS_ITEMS }
  };
};

export const saveUserSettings = async (income: string[], expenses: CategoryStructure[], projection?: ProjectionSettings) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const payload: any = { user_id: user.id, income_categories: income, expense_groups: expenses };
  if (projection) payload.projection_settings = projection;
  await supabase.from('user_settings').upsert(payload);
};

export const signOut = async () => { await supabase.auth.signOut(); };
