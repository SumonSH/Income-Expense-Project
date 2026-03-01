import { useState, useEffect } from 'react';
import { Transaction, UserProfile, FinanceState } from '../types';

const STORAGE_KEY = 'hishab_khata_data';

const DEFAULT_STATE: FinanceState = {
  transactions: [],
  profile: {
    name: 'ব্যবহারকারী',
    currency: 'BDT',
  },
};

export function useFinance() {
  const [state, setState] = useState<FinanceState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_STATE;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction = {
      ...transaction,
      id: crypto.randomUUID(),
    };
    setState((prev) => ({
      ...prev,
      transactions: [newTransaction, ...prev.transactions],
    }));
  };

  const deleteTransaction = (id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  const updateTransaction = (transaction: Transaction) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === transaction.id ? transaction : t)),
    }));
  };

  const updateProfile = (profile: UserProfile) => {
    setState((prev) => ({ ...prev, profile }));
  };

  const importData = (data: FinanceState) => {
    setState(data);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hishab_khata_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    state,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    updateProfile,
    importData,
    exportData,
  };
}
