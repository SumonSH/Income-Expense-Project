import { useState, useEffect, useCallback } from 'react';
import { Transaction, UserProfile, FinanceState } from '../types';

const DEFAULT_STATE: FinanceState = {
  transactions: [],
  profile: {
    name: 'ব্যবহারকারী',
    currency: 'BDT',
    theme: 'light'
  },
};

export function useFinance() {
  const [state, setState] = useState<FinanceState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    try {
      const response = await fetch('/api/state');
      if (response.ok) {
        const data = await response.json();
        setState(data);
      }
    } catch (error) {
      console.error('Failed to fetch state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction = {
      ...transaction,
      id: crypto.randomUUID(),
    };
    
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction),
      });
      
      if (response.ok) {
        setState((prev) => ({
          ...prev,
          transactions: [newTransaction, ...prev.transactions],
        }));
      }
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setState((prev) => ({
          ...prev,
          transactions: prev.transactions.filter((t) => t.id !== id),
        }));
      }
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
  };

  const updateTransaction = async (transaction: Transaction) => {
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction),
      });
      
      if (response.ok) {
        setState((prev) => ({
          ...prev,
          transactions: prev.transactions.map((t) => (t.id === transaction.id ? transaction : t)),
        }));
      }
    } catch (error) {
      console.error('Failed to update transaction:', error);
    }
  };

  const updateProfile = async (profile: UserProfile) => {
    // Optimistically update the local state immediately
    setState((prev) => ({ ...prev, profile }));

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      
      if (!response.ok) {
        // If the server update fails, we might want to revert or show an error
        // For now, we'll just log it. In a real app, you'd fetch the latest state from server.
        console.error('Failed to sync profile with server');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const importData = (data: FinanceState) => {
    // Immediate local update for instant feel
    setState(data);

    // Background server sync
    fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(error => {
      console.error('Failed to sync import with server:', error);
    });
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

  const syncWithGoogle = async () => {
    try {
      const response = await fetch('/api/google/sync', {
        method: 'POST',
      });
      
      if (response.status === 401) {
        // Not connected, trigger OAuth flow
        const authWindow = window.open('/auth/google', 'google_auth', 'width=600,height=700');
        if (!authWindow) {
          alert('পপ-আপ ব্লক করা হয়েছে। দয়া করে পপ-আপ এলাউ করুন।');
          return false;
        }
        return new Promise((resolve) => {
          const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
              window.removeEventListener('message', handleMessage);
              // Retry sync after successful auth
              syncWithGoogle().then(resolve);
            }
          };
          window.addEventListener('message', handleMessage);
        });
      }

      if (response.ok) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Google sync failed:', error);
      return false;
    }
  };

  return {
    state,
    loading,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    updateProfile,
    importData,
    exportData,
    syncWithGoogle,
  };
}
