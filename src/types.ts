export type TransactionType = 'INCOME' | 'EXPENSE' | 'BALANCE' | 'EXTRA';

export interface Transaction {
  id: string;
  user_id?: string;
  type: TransactionType;
  group: string;
  description: string;
  amount: number;
  date: string;
  observation?: string;
  created_at?: string;
}

export interface CategoryStructure {
  name: string;
  items: string[];
}

export interface ProjectionSettings {
  needs_items: string[]; // Items classified as Needs (50%)
  // Items NOT in this list are considered Wants (30%) or others based on logic
}

export interface UserSettings {
  income_categories: string[];
  expense_groups: CategoryStructure[];
  projection_settings?: ProjectionSettings;
}

export interface ImportItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  selectedCategory: string;
  selectedGroup: string;
  isChecked: boolean;
  isPossibleDuplicate?: boolean;
}