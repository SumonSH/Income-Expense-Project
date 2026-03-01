import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ListOrdered, 
  User, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Settings,
  Download,
  Upload,
  Cloud,
  Trash2,
  Pencil,
  X,
  Check,
  ChevronRight,
  ChevronUp,
  Menu,
  Camera,
  Mail,
  Phone,
  FileText,
  Search,
  Filter
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths } from 'date-fns';
import { bn } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useFinance } from './hooks/useFinance';
import { CATEGORIES, CURRENCIES } from './constants';
import { Transaction, TransactionType } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const { 
    state, 
    addTransaction, 
    deleteTransaction, 
    updateTransaction,
    updateProfile, 
    importData, 
    exportData 
  } = useFinance();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'profile'>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Handle scroll for "Go to Top" button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll to top on tab change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsAddModalOpen(true);
  };

  // Filter transactions based on search query
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return state.transactions;
    const query = searchQuery.toLowerCase();
    return state.transactions.filter(t => {
      const category = CATEGORIES[t.type].find(c => c.id === t.category);
      return (
        category?.label.toLowerCase().includes(query) ||
        t.note?.toLowerCase().includes(query) ||
        t.amount.toString().includes(query)
      );
    });
  }, [state.transactions, searchQuery]);

  // Filter transactions for the current month
  const currentMonthTransactions = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return state.transactions.filter(t => 
      isWithinInterval(parseISO(t.date), { start, end })
    );
  }, [state.transactions]);

  const totalIncome = useMemo(() => 
    state.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0),
    [state.transactions]
  );

  const totalExpense = useMemo(() => 
    state.transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0),
    [state.transactions]
  );

  const balance = totalIncome - totalExpense;

  const currentMonthIncome = useMemo(() => 
    currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0),
    [currentMonthTransactions]
  );

  const currentMonthExpense = useMemo(() => 
    currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0),
    [currentMonthTransactions]
  );

  // Trend Calculations (This Month vs Last Month)
  const lastMonthTransactions = useMemo(() => {
    const start = startOfMonth(subMonths(new Date(), 1));
    const end = endOfMonth(subMonths(new Date(), 1));
    return state.transactions.filter(t => 
      isWithinInterval(parseISO(t.date), { start, end })
    );
  }, [state.transactions]);

  const lastMonthIncome = useMemo(() => 
    lastMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0),
    [lastMonthTransactions]
  );

  const lastMonthExpense = useMemo(() => 
    lastMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0),
    [lastMonthTransactions]
  );

  const calculateTrend = (current: number, last: number) => {
    if (last === 0) return current > 0 ? '+১০০%' : '০%';
    const diff = ((current - last) / last) * 100;
    const formatted = Math.abs(diff);
    return `${diff >= 0 ? '+' : '-'}${formatted.toLocaleString('bn-BD', { maximumFractionDigits: 0 })}%`;
  };

  const incomeTrend = useMemo(() => calculateTrend(currentMonthIncome, lastMonthIncome), [currentMonthIncome, lastMonthIncome]);
  const expenseTrend = useMemo(() => calculateTrend(currentMonthExpense, lastMonthExpense), [currentMonthExpense, lastMonthExpense]);
  
  // Balance trend: comparing this month's net savings vs last month's
  const balanceTrend = useMemo(() => {
    const currentNet = currentMonthIncome - currentMonthExpense;
    const lastNet = lastMonthIncome - lastMonthExpense;
    return calculateTrend(currentNet, lastNet);
  }, [currentMonthIncome, currentMonthExpense, lastMonthIncome, lastMonthExpense]);

  // Chart Data: Last 6 months
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const monthTransactions = state.transactions.filter(t => 
        isWithinInterval(parseISO(t.date), { start, end })
      );
      
      data.push({
        name: format(date, 'MMM', { locale: bn }),
        income: monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
        expense: monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
      });
    }
    return data;
  }, [state.transactions]);

  // Category Data for Pie Chart
  const categoryData = useMemo(() => {
    const expenses = state.transactions.filter(t => t.type === 'expense');
    const categories: Record<string, number> = {};
    expenses.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    return Object.entries(categories).map(([name, value]) => ({
      name: CATEGORIES.expense.find(c => c.id === name)?.label || name,
      value
    }));
  }, [state.transactions]);

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

  const currencySymbol = CURRENCIES.find(c => c.code === state.profile.currency)?.symbol || '৳';

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar / Navigation */}
      <nav className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                <Wallet size={22} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">হিসাব খাতা</h1>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-50 rounded-lg text-gray-400"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-2 flex-1">
            <NavItem 
              icon={<LayoutDashboard size={20} />} 
              label="ড্যাশবোর্ড" 
              active={activeTab === 'dashboard'} 
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} 
            />
            <NavItem 
              icon={<ListOrdered size={20} />} 
              label="লেনদেন" 
              active={activeTab === 'transactions'} 
              onClick={() => { setActiveTab('transactions'); setIsSidebarOpen(false); }} 
            />
            <NavItem 
              icon={<User size={20} />} 
              label="প্রোফাইল" 
              active={activeTab === 'profile'} 
              onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }} 
            />
          </div>

          <div className="pt-6 border-t border-gray-100">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              {state.profile.avatar ? (
                <img src={state.profile.avatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-emerald-100" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                  {state.profile.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{state.profile.name}</p>
                <p className="text-xs text-gray-500 truncate">প্রফেশনাল ইউজার</p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pb-24 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-50 rounded-xl text-gray-600 border border-gray-100"
          >
            <Menu size={20} />
          </button>
          <h2 className="text-lg font-bold text-gray-900">
            {activeTab === 'dashboard' ? 'ড্যাশবোর্ড' : activeTab === 'transactions' ? 'লেনদেন সমূহ' : 'প্রোফাইল সেটিংস'}
          </h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-md shadow-emerald-100 active:scale-95"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">নতুন যোগ করুন</span>
            </button>
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard 
                    title="মোট ব্যালেন্স" 
                    amount={balance} 
                    symbol={currencySymbol}
                    icon={<Wallet className="text-emerald-600" />}
                    trend={balanceTrend}
                    color="emerald"
                  />
                  <StatCard 
                    title="মোট আয়" 
                    amount={totalIncome} 
                    symbol={currencySymbol}
                    icon={<ArrowUpCircle className="text-blue-600" />}
                    trend={incomeTrend}
                    color="blue"
                  />
                  <StatCard 
                    title="মোট ব্যয়" 
                    amount={totalExpense} 
                    symbol={currencySymbol}
                    icon={<ArrowDownCircle className="text-rose-600" />}
                    trend={expenseTrend}
                    color="rose"
                  />
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <TrendingUp size={20} className="text-emerald-600" />
                      আয় বনাম ব্যয় (গত ৬ মাস)
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} style={{ outline: 'none' }} accessibilityLayer={false}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#f9fafb' }}
                          />
                          <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="আয়" />
                          <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="ব্যয়" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <TrendingDown size={20} className="text-rose-600" />
                      ব্যয়ের খাতসমূহ
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                      {categoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart style={{ outline: 'none' }} accessibilityLayer={false}>
                            <Pie
                              data={categoryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {categoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center text-gray-400">
                          <p>কোন ব্যয়ের তথ্য নেই</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="text-lg font-bold">সাম্প্রতিক লেনদেন</h3>
                    <button 
                      onClick={() => setActiveTab('transactions')}
                      className="text-emerald-600 text-sm font-medium hover:underline"
                    >
                      সব দেখুন
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {state.transactions.slice(0, 5).map((t: Transaction) => (
                      <TransactionItem 
                        key={t.id} 
                        transaction={t} 
                        symbol={currencySymbol}
                        onDelete={setDeletingTransactionId} 
                        onEdit={handleEditTransaction}
                      />
                    ))}
                    {state.transactions.length === 0 && (
                      <div className="p-10 text-center text-gray-400">
                        কোন লেনদেন পাওয়া যায়নি
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'transactions' && (
              <motion.div 
                key="transactions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="text" 
                    placeholder="লেনদেন খুঁজুন (ক্যাটাগরি বা নোট)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="divide-y divide-gray-50">
                    {filteredTransactions.map((t: Transaction) => (
                      <TransactionItem 
                        key={t.id} 
                        transaction={t} 
                        symbol={currencySymbol}
                        onDelete={setDeletingTransactionId} 
                        onEdit={handleEditTransaction}
                      />
                    ))}
                    {filteredTransactions.length === 0 && (
                      <div className="p-20 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                          <Search size={40} />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900">কোন ফলাফল পাওয়া যায়নি</h4>
                        <p className="text-gray-500">অন্য কোনো শব্দ দিয়ে চেষ্টা করুন</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                {/* Profile Card */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="flex flex-col items-center text-center mb-10">
                    <div className="relative group">
                      <div className="w-28 h-28 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-4xl font-bold mb-4 border-4 border-white shadow-xl overflow-hidden">
                        {state.profile.avatar ? (
                          <img src={state.profile.avatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          state.profile.name.charAt(0)
                        )}
                      </div>
                      <label className="absolute bottom-4 right-0 p-2 bg-emerald-600 text-white rounded-full shadow-lg border-2 border-white cursor-pointer hover:bg-emerald-700 transition-all hover:scale-110">
                        <Camera size={18} />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                updateProfile({ ...state.profile, avatar: event.target?.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{state.profile.name}</h3>
                    <p className="text-gray-400 text-sm mt-1">সদস্য হয়েছেন: {format(new Date(), 'MMMM yyyy', { locale: bn })}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <User size={14} /> আপনার নাম
                      </label>
                      <input 
                        type="text" 
                        value={state.profile.name}
                        onChange={(e) => updateProfile({ ...state.profile, name: e.target.value })}
                        placeholder="আপনার নাম লিখুন"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <Wallet size={14} /> কারেন্সি
                      </label>
                      <select 
                        value={state.profile.currency}
                        onChange={(e) => updateProfile({ ...state.profile, currency: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                      >
                        {CURRENCIES.map(c => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <Mail size={14} /> ইমেইল
                      </label>
                      <input 
                        type="email" 
                        value={state.profile.email || ''}
                        onChange={(e) => updateProfile({ ...state.profile, email: e.target.value })}
                        placeholder="example@mail.com"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <Phone size={14} /> ফোন নম্বর
                      </label>
                      <input 
                        type="tel" 
                        value={state.profile.phone || ''}
                        onChange={(e) => updateProfile({ ...state.profile, phone: e.target.value })}
                        placeholder="017XXXXXXXX"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        <FileText size={14} /> বায়ো (Bio)
                      </label>
                      <textarea 
                        value={state.profile.bio || ''}
                        onChange={(e) => updateProfile({ ...state.profile, bio: e.target.value })}
                        placeholder="আপনার সম্পর্কে কিছু লিখুন..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Data Management */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Settings size={20} className="text-gray-600" />
                    ডাটা ম্যানেজমেন্ট
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                      onClick={exportData}
                      className="flex items-center justify-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-all group"
                    >
                      <Download size={20} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                      <div className="text-left">
                        <p className="font-semibold text-sm">এক্সপোর্ট করুন</p>
                        <p className="text-xs text-gray-500">JSON ফরম্যাটে ডাউনলোড</p>
                      </div>
                    </button>

                    <label className="flex items-center justify-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer group">
                      <Upload size={20} className="text-blue-600 group-hover:scale-110 transition-transform" />
                      <div className="text-left">
                        <p className="font-semibold text-sm">ইম্পোর্ট করুন</p>
                        <p className="text-xs text-gray-500">ব্যাকআপ ফাইল আপলোড</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              try {
                                const data = JSON.parse(event.target?.result as string);
                                importData(data);
                                alert('ডাটা সফলভাবে ইম্পোর্ট করা হয়েছে!');
                              } catch (err) {
                                alert('ভুল ফাইল ফরম্যাট!');
                              }
                            };
                            reader.readAsText(file);
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div className="mt-8 p-6 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-emerald-600 rounded-xl text-white">
                        <Cloud size={24} />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-bold text-emerald-900">গুগল অটোমেটিক ব্যাকআপ</h5>
                        <p className="text-sm text-emerald-700 mt-1">আপনার সকল ডাটা সুরক্ষিত রাখতে গুগল ড্রাইভের সাথে সিঙ্ক করুন।</p>
                        <button 
                          className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-200 active:scale-95"
                          onClick={() => alert('গুগল ড্রাইভ ইন্টিগ্রেশন শীঘ্রই আসছে!')}
                        >
                          এখনই সিঙ্ক করুন
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-around z-40">
        <MobileNavItem 
          icon={<LayoutDashboard size={24} />} 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
        />
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-200 -mt-10 border-4 border-white active:scale-90 transition-transform"
        >
          <Plus size={32} />
        </button>
        <MobileNavItem 
          icon={<User size={24} />} 
          active={activeTab === 'profile'} 
          onClick={() => setActiveTab('profile')} 
        />
      </div>

      {/* Go to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.3, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.3, y: 40 }}
            whileHover={{ scale: 1.1, y: -5 }}
            whileTap={{ scale: 0.9 }}
            transition={{ 
              type: "spring", 
              stiffness: 260, 
              damping: 20 
            }}
            onClick={scrollToTop}
            className="fixed bottom-24 lg:bottom-8 right-6 z-40 p-2.5 bg-emerald-600 text-white rounded-full shadow-2xl shadow-emerald-500/30 hover:bg-emerald-700 transition-colors"
            aria-label="Go to top"
          >
            <ChevronUp size={20} strokeWidth={3} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingTransactionId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingTransactionId(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">আপনি কি নিশ্চিত?</h3>
              <p className="text-gray-500 mb-8">এই লেনদেনটি চিরতরে মুছে ফেলা হবে। আপনি কি এটি ডিলিট করতে চান?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingTransactionId(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-all"
                >
                  না, থাক
                </button>
                <button 
                  onClick={() => {
                    deleteTransaction(deletingTransactionId);
                    setDeletingTransactionId(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  হ্যাঁ, ডিলিট করুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingTransaction(null);
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] my-8 custom-scrollbar"
            >
              <div className="sticky top-0 z-10 bg-white p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold">{editingTransaction ? 'লেনদেন এডিট করুন' : 'নতুন লেনদেন'}</h3>
                <button 
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingTransaction(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              
              <AddTransactionForm 
                initialData={editingTransaction}
                onAdd={(t) => {
                  addTransaction(t);
                  setIsAddModalOpen(false);
                }} 
                onUpdate={(t) => {
                  updateTransaction(t);
                  setIsAddModalOpen(false);
                  setEditingTransaction(null);
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components

const NavItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
        active 
          ? "bg-emerald-50 text-emerald-700 shadow-sm" 
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      {icon}
      <span>{label}</span>
      {active && <ChevronRight size={16} className="ml-auto" />}
    </button>
  );
}

const MobileNavItem: React.FC<{ icon: React.ReactNode, active: boolean, onClick: () => void }> = ({ icon, active, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 transition-all",
        active ? "text-emerald-600" : "text-gray-400"
      )}
    >
      {icon}
    </button>
  );
}

const StatCard: React.FC<{ title: string, amount: number, symbol: string, icon: React.ReactNode, trend: string, color: 'emerald' | 'blue' | 'rose' }> = ({ title, amount, symbol, icon, trend, color }) => {
  const colorClasses = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    rose: "bg-rose-50 text-rose-600"
  };

  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg hover:shadow-gray-200/40 transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-xl transition-transform group-hover:scale-110 duration-300", colorClasses[color])}>
          {icon}
        </div>
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider", colorClasses[color])}>
          {trend}
        </span>
      </div>
      <p className="text-xs text-gray-400 font-semibold mb-1">{title}</p>
      <h4 className="text-2xl font-black tracking-tight text-gray-900">
        {symbol}{amount.toLocaleString('bn-BD')}
      </h4>
    </div>
  );
}

const TransactionItem: React.FC<{ 
  transaction: Transaction, 
  symbol: string, 
  onDelete: (id: string) => void,
  onEdit: (transaction: Transaction) => void
}> = ({ transaction, symbol, onDelete, onEdit }) => {
  const isIncome = transaction.type === 'income';
  const category = CATEGORIES[transaction.type].find(c => c.id === transaction.category);

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-gray-50/80 transition-all group">
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
        isIncome ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      )}>
        {isIncome ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-base truncate">{category?.label || transaction.category || 'অন্যান্য'}</p>
        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
          <Calendar size={12} />
          {format(parseISO(transaction.date), 'dd MMMM, yyyy', { locale: bn })}
          {transaction.note && <span className="text-gray-300">|</span>}
          {transaction.note && <span className="truncate">{transaction.note}</span>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn(
          "font-black text-lg tracking-tight",
          isIncome ? "text-emerald-600" : "text-rose-600"
        )}>
          {isIncome ? '+' : '-'}{symbol}{transaction.amount.toLocaleString('bn-BD')}
        </p>
        <div className="flex justify-end mt-0.5 gap-1">
          <button 
            onClick={() => onEdit(transaction)}
            className="text-gray-300 hover:text-emerald-600 transition-all opacity-0 group-hover:opacity-100 p-1 hover:bg-emerald-50 rounded-lg"
          >
            <Pencil size={16} />
          </button>
          <button 
            onClick={() => onDelete(transaction.id)}
            className="text-gray-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-50 rounded-lg"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

const AddTransactionForm: React.FC<{ 
  onAdd: (t: Omit<Transaction, 'id'>) => void,
  onUpdate?: (t: Transaction) => void,
  initialData?: Transaction | null
}> = ({ onAdd, onUpdate, initialData }) => {
  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense');
  const [amount, setAmount] = useState(initialData?.amount.toString() || '');
  const [category, setCategory] = useState(() => {
    if (!initialData) return '';
    const found = CATEGORIES[initialData.type].find(c => c.id === initialData.category);
    if (found) return initialData.category;
    return initialData.type === 'income' ? 'other_income' : 'other_expense';
  });
  const [customCategory, setCustomCategory] = useState(() => {
    if (!initialData) return '';
    const found = CATEGORIES[initialData.type].find(c => c.id === initialData.category);
    return found ? '' : initialData.category;
  });
  const [date, setDate] = useState(initialData?.date || format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState(initialData?.note || '');

  const isOtherSelected = category === 'other_income' || category === 'other_expense';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) return;
    
    const finalCategory = isOtherSelected ? (customCategory.trim() || 'অন্যান্য') : category;

    if (initialData && onUpdate) {
      onUpdate({
        ...initialData,
        type,
        amount: parseFloat(amount),
        category: finalCategory,
        date,
        note
      });
    } else {
      onAdd({
        type,
        amount: parseFloat(amount),
        category: finalCategory,
        date,
        note
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-5 pb-20">
      {/* Type Toggle */}
      <div className="flex p-1 bg-gray-100 rounded-xl">
        <button
          type="button"
          onClick={() => { setType('expense'); setCategory(''); }}
          className={cn(
            "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all",
            type === 'expense' ? "bg-white text-rose-600 shadow-sm" : "text-gray-500"
          )}
        >
          ব্যয় (Expense)
        </button>
        <button
          type="button"
          onClick={() => { setType('income'); setCategory(''); }}
          className={cn(
            "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all",
            type === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500"
          )}
        >
          আয় (Income)
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">টাকার পরিমাণ</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">৳</span>
            <input 
              type="number" 
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">ক্যাটাগরি</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES[type].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "p-2.5 rounded-xl border-2 text-center transition-all",
                  category === cat.id 
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                    : "border-gray-100 hover:border-gray-200 text-gray-600"
                )}
              >
                <p className="text-[10px] font-bold">{cat.label}</p>
              </button>
            ))}
          </div>
        </div>

        {isOtherSelected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1.5"
          >
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">ক্যাটাগরির নাম লিখুন</label>
            <input 
              type="text" 
              placeholder="যেমন: উপহার, বোনাস ইত্যাদি"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              required
            />
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">তারিখ</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border-none rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">নোট (ঐচ্ছিক)</label>
            <input 
              type="text" 
              placeholder="কি বাবদ খরচ?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border-none rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>
      </div>

      <button 
        type="submit"
        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-base shadow-lg shadow-emerald-100 transition-all active:scale-[0.98]"
      >
        সেভ করুন
      </button>
    </form>
  );
}
