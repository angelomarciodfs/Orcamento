
import type { CategoryStructure } from './types';

export const INITIAL_INCOME_CATEGORIES: string[] = [
  'Receita Ângelo',
  'Receita Flávia',
  'Cartão Alimentação',
  'Outras Receitas'
];

export const INITIAL_EXPENSE_GROUPS: CategoryStructure[] = [
  {
    name: 'Dízimos e Ofertas',
    items: ['Dízimos', 'Ofertas']
  },
  {
    name: 'Moradia/Fixos',
    items: ['Financiamento', 'Condomínio', 'IPTU', 'Energia', 'Água', 'Internet', 'Telefone']
  },
  {
    name: 'Transporte',
    items: ['Combustível', 'Uber/99', 'Transporte Público', 'Manutenção Veículo']
  },
  {
    name: 'Alimentação',
    items: ['Mercado', 'Restaurantes/iFood']
  },
  {
    name: 'Saúde',
    items: ['Plano de Saúde', 'Remédios']
  },
  {
    name: 'Lazer',
    items: ['Cinema/Teatro', 'Passeios', 'Viagens']
  },
  {
    name: 'Educação',
    items: ['Cursos', 'Faculdade', 'Livros']
  },
  {
    name: 'Outros',
    items: ['Aniversários', 'Presentes', 'Outros', 'Imprevistos', 'Cartão de Crédito', 'Diversos/Despesas Extras']
  }
];

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const NEEDS_ITEMS = [
  'Financiamento', 'Condomínio', 'Energia', 'Água', 'Internet', 
  'Telefone', 'IPTU', 'Combustível', 'Plano de Saúde', 'Mercado', 'Remédios'
];

export const WANTS_ITEMS = [
  'Cartão de Crédito', 'Restaurantes/iFood', 'Cinema/Teatro', 'Passeios', 
  'Viagens', 'Aniversários', 'Presentes', 'Salão de Beleza', 'Consórcio', 
  'Diversos/Despesas Extras', 'Outros', 'Uber/99'
];
