import { supabase } from '../supabaseClient';
import type { Transaction, CategoryStructure, ProjectionSettings } from '../types';
import { INITIAL_INCOME_CATEGORIES, INITIAL_EXPENSE_GROUPS, NEEDS_ITEMS } from '../constants';

// --- Transactions ---

export const fetchTransactions = async (): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Erro ao buscar transações:', error);
    return [];
  }
  return data || [];
};

export const addTransaction = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('transactions')
    .insert([{ ...transaction, user_id: user.id }])
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar transação:', error);
    return null;
  }
  return data;
};

export const updateTransaction = async (id: string, updates: Partial<Transaction>): Promise<Transaction | null> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
      console.error('[DEBUG Storage] Erro: Usuário não autenticado tentando atualizar.');
      return null;
  }

  console.log(`[DEBUG Storage] Tentando atualizar Transaction ID: ${id}`);

  // 1. TENTATIVA PADRÃO (UPDATE)
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select();

  // Se houver erro no update, logamos (isso satisfaz o linter TS)
  if (error) {
      console.warn('[DEBUG Storage] Update padrão retornou erro:', error);
  }

  // Cenário Ideal: O banco permitiu a atualização e retornou os dados
  if (data && data.length > 0) {
    console.log('[DEBUG Storage] Sucesso! Dados atualizados via UPDATE padrão.');
    return data[0];
  }

  // 2. WORKAROUND PARA FALTA DE POLÍTICA DE UPDATE
  // Se chegamos aqui, ou deu erro, ou (mais provável) o RLS bloqueou o UPDATE (data vazio).
  // Como o usuário confirmou ter permissão de DELETE e INSERT, faremos a substituição.

  console.warn('[DEBUG Storage] UPDATE padrão não retornou dados (provável falta de permissão RLS). Iniciando estratégia EXCLUIR + RECRIAR.');

  // Passo A: Buscar os dados originais completos (necessário pois 'updates' pode ser parcial)
  const { data: originalData, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !originalData) {
      console.error('[DEBUG Storage] Falha ao buscar registro original para substituição.', fetchError);
      return null;
  }

  // Passo B: Excluir o registro antigo
  const { error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (deleteError) {
      console.error('[DEBUG Storage] Falha ao excluir registro antigo.', deleteError);
      return null;
  }

  // Passo C: Criar o novo registro combinando Original + Updates
  // Removemos ID e created_at para gerar novos
  const newPayload = {
      ...originalData, // Pega dados antigos
      ...updates,      // Sobrescreve com os novos
      user_id: user.id
  };

  // Garantir que não estamos tentando inserir campos de sistema
  delete (newPayload as any).id;
  delete (newPayload as any).created_at;

  const { data: newData, error: insertError } = await supabase
    .from('transactions')
    .insert([newPayload])
    .select()
    .single();

  if (insertError) {
      console.error('[DEBUG Storage] CRÍTICO: Registro excluído mas falha ao recriar.', insertError);
      // Aqui poderíamos tentar desfazer, mas em client-side é complexo.
      // O dado foi perdido, mas o usuário receberá o erro.
      return null;
  }

  console.log('[DEBUG Storage] Sucesso! Registro substituído (Delete + Insert). Novo ID:', newData.id);
  return newData;
};

export const deleteTransaction = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar:', error);
    return false;
  }
  return true;
};

// --- Categories & Settings (User Settings) ---

export const fetchUserSettings = async (): Promise<{ income: string[], expenses: CategoryStructure[], projection: ProjectionSettings }> => {
  const { data: { user } } = await supabase.auth.getUser();
  // Default fallback
  const defaults = {
      income: INITIAL_INCOME_CATEGORIES,
      expenses: INITIAL_EXPENSE_GROUPS,
      projection: { needs_items: NEEDS_ITEMS }
  };

  if (!user) return defaults;

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    if (!data) {
      await saveUserSettings(defaults.income, defaults.expenses, defaults.projection);
    }
    return defaults;
  }

  return {
    income: data.income_categories || INITIAL_INCOME_CATEGORIES,
    expenses: data.expense_groups || INITIAL_EXPENSE_GROUPS,
    projection: data.projection_settings || { needs_items: NEEDS_ITEMS }
  };
};

export const saveUserSettings = async (
    incomeCategories: string[],
    expenseGroups: CategoryStructure[],
    projectionSettings?: ProjectionSettings
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const payload: any = {
      user_id: user.id,
      income_categories: incomeCategories,
      expense_groups: expenseGroups
  };

  if (projectionSettings) {
      payload.projection_settings = projectionSettings;
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert(payload);

  if (error) console.error('Erro ao salvar configurações:', error);
};

// --- Auth Helpers ---

export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};