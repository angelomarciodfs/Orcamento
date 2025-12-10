import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO SUPABASE ---
// Usando as chaves diretamente para garantir funcionamento no Netlify sem configuração de variáveis de ambiente.

const SUPABASE_URL = 'https://laqzbyezwjrasjnioddk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcXpieWV6d2pyYXNqbmlvZGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MjQ5NjEsImV4cCI6MjA4MDQwMDk2MX0.nHP3VwKjcKUFKyCz3PWQVRMFH2CNPEir0ItjJhpoRjM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);