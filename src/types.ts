export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  note?: string;
}

export interface UserProfile {
  name: string;
  currency: string;
  avatar?: string;
  email?: string;
  phone?: string;
  bio?: string;
}

export interface FinanceState {
  transactions: Transaction[];
  profile: UserProfile;
  lastBackup?: string;
}
