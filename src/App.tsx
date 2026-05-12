import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Camera, 
  Clock, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Menu,
  ShieldCheck,
  Zap,
  Bell,
  LogOut,
  ChevronRight,
  Loader2,
  Info,
  Check,
  Search,
  ArrowRight,
  Pencil,
  Calendar,
  DollarSign,
  History,
  TrendingUp,
  Wallet,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithGoogle, logout, auth } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  addTrial, 
  subscribeToTrials, 
  updateTrialStatus, 
  updateTrial,
  deleteTrial, 
  parseFirestoreError,
  type Trial 
} from './services/trialService';
import { 
  addExpense, 
  subscribeToExpenses, 
  deleteExpense, 
  updateExpense,
  type Expense 
} from './services/lifeTrackService';
import { processImage } from './services/ocrService';
import { analyzeTrialImage } from './services/smartService';
import { SERVICE_CANCEL_LINKS, TRIAL_DURATIONS } from './constants';

// --- Toast System ---
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[], removeToast: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border min-w-[300px] ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
              toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' :
              'bg-indigo-50 border-indigo-100 text-indigo-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> :
             toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500" /> :
             <Info className="w-5 h-5 text-indigo-500" />}
            <span className="text-sm font-bold">{toast.message}</span>
            <button 
              onClick={() => removeToast(toast.id)}
              className="ml-auto p-1 hover:bg-black/5 rounded-full transition-colors"
            >
              <XCircle className="w-4 h-4 opacity-50" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// --- Life Track Components ---

function ExpenseModal({ expenseToEdit, initialDate, onClose, onSave }: { expenseToEdit?: Expense | null, initialDate?: string, onClose: () => void, onSave: (data: any) => Promise<void> }) {
  const [formData, setFormData] = useState({
    description: expenseToEdit?.description || '',
    amount: expenseToEdit?.amount?.toString() || '',
    currency: expenseToEdit?.currency || 'USD',
    date: expenseToEdit?.date || initialDate || new Date().toISOString().split('T')[0],
    time: expenseToEdit?.time || new Date().toTimeString().slice(0, 5),
    category: expenseToEdit?.category || 'General',
    isUnwanted: expenseToEdit?.isUnwanted || false
  });
  const [isSaving, setIsSaving] = useState(false);

  const CURRENCIES = [
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' },
    { code: 'GBP', symbol: '£' },
    { code: 'INR', symbol: '₹' },
    { code: 'JPY', symbol: '¥' },
    { code: 'CAD', symbol: 'C$' },
    { code: 'AUD', symbol: 'A$' }
  ];

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        amount: parseFloat(formData.amount)
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 space-y-6"
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">{expenseToEdit ? 'Edit Expense' : 'Log Expense'}</h3>
            <p className="text-xs text-gray-500 font-medium">Keep your history accurate.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Description</label>
            <input 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="e.g. Morning Coffee"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Amount</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                  {CURRENCIES.find(c => c.code === formData.currency)?.symbol || '$'}
                </div>
                <input 
                  type="number"
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Currency</label>
              <select 
                value={formData.currency}
                onChange={e => setFormData({...formData, currency: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Date</label>
              <input 
                type="date"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Time</label>
              <input 
                type="time"
                value={formData.time}
                onChange={e => setFormData({...formData, time: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs"
              />
            </div>
          </div>
        </div>

        <button 
          disabled={!formData.description || !formData.amount || isSaving}
          onClick={handleSubmit}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {expenseToEdit ? 'Save Changes' : 'Log Expense'}
        </button>
      </motion.div>
    </div>
  );
}

function LifeTrackView({ 
  expenses, 
  trials,
  onSelectDate,
  onAddExpense 
}: { 
  expenses: Expense[], 
  trials: Trial[],
  onSelectDate: (date: string) => void,
  onAddExpense: (expense: any) => Promise<void>
}) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Group expenses by date
  const groupedExpenses = expenses.reduce((acc, exp) => {
    if (!acc[exp.date]) acc[exp.date] = [];
    acc[exp.date].push(exp);
    return acc;
  }, {} as Record<string, Expense[]>);

  const dates = Object.keys(groupedExpenses).sort((a, b) => b.localeCompare(a));

  const getCurrencySymbol = (code?: string) => {
    const currencies: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'INR': '₹',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$'
    };
    return currencies[code || 'USD'] || '$';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Expense Intelligence</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900">Life Track</h1>
          <p className="text-gray-500 font-medium font-mono text-sm uppercase">Mapping your financial heartbeat day by day.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> 
          Track Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dates.length === 0 ? (
          <div className="col-span-full py-24 flex flex-col items-center justify-center text-center space-y-4 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <div className="p-4 bg-white text-gray-200 rounded-full shadow-sm">
              <History className="w-12 h-12" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Your history starts today</h3>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">Start logging your daily expenses to see spend patterns emerge.</p>
            </div>
          </div>
        ) : (
          dates.map(date => {
            const dayExpenses = groupedExpenses[date];
            const total = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
            const unwanted = dayExpenses.filter(e => e.isUnwanted).length;
            const currency = dayExpenses[0]?.currency || 'USD';

            return (
              <motion.div 
                key={date}
                whileHover={{ y: -4 }}
                onClick={() => onSelectDate(date)}
                className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      {new Date(date).toLocaleDateString(undefined, { weekday: 'long' })}
                    </p>
                    <h3 className="text-lg font-bold text-gray-900">{new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-gray-400 uppercase">Daily Spend</span>
                    <span className="text-xl font-black text-indigo-600">{getCurrencySymbol(currency)}{total.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-2 py-1 bg-gray-50 text-[10px] font-bold text-gray-500 rounded-lg border border-gray-100">
                      {dayExpenses.length} Items
                    </div>
                    {unwanted > 0 && (
                      <div className="px-2 py-1 bg-red-50 text-[10px] font-bold text-red-500 rounded-lg border border-red-100">
                        {unwanted} Unwanted
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <ExpenseModal 
            onClose={() => setIsAddModalOpen(false)}
            onSave={onAddExpense}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DailyDetailView({ 
  date, 
  expenses, 
  trials,
  onBack, 
  onAddExpense, 
  onUpdateExpense,
  onDeleteExpense,
  onToggleUnwanted 
}: { 
  date: string, 
  expenses: Expense[], 
  trials: Trial[],
  onBack: () => void,
  onAddExpense: (e: any) => Promise<void>,
  onUpdateExpense: (id: string, updates: any) => Promise<void>,
  onDeleteExpense: (id: string) => Promise<void>,
  onToggleUnwanted: (id: string, current: boolean) => Promise<void>
}) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const dayExpenses = expenses.filter(e => e.date === date);
  const total = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const unwantedTotal = dayExpenses.filter(e => e.isUnwanted).reduce((sum, e) => sum + e.amount, 0);
  const commonCurrency = dayExpenses[0]?.currency || 'USD';

  const getCurrencySymbol = (code?: string) => {
    const currencies: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'INR': '₹',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$'
    };
    return currencies[code || 'USD'] || '$';
  };

  // Identify upcoming trials for this day (if any start around now)
  const upcomingTrials = trials.filter(t => {
    const start = new Date(t.startDate);
    const expiry = new Date(start.getTime() + t.durationDays * 24 * 60 * 60 * 1000);
    return expiry.toISOString().split('T')[0] === date && t.status === 'active';
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Detail View</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-8 bg-white rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Today's Transactions</h2>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">{dayExpenses.length} entries</span>
            </div>

            <div className="divide-y divide-gray-50">
              {dayExpenses.length === 0 ? (
                <p className="py-8 text-center text-gray-400 text-sm font-medium">No expenses logged for this day.</p>
              ) : (
                dayExpenses.map(exp => (
                  <div key={exp.id} className="py-4 border-b border-gray-50 last:border-0 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl border ${exp.isUnwanted ? 'bg-red-50 border-red-100 text-red-500' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-bold text-sm ${exp.isUnwanted ? 'text-red-900 line-through opacity-50' : 'text-gray-900'}`}>{exp.description}</p>
                          {exp.time ? (
                            <span className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">{exp.time}</span>
                          ) : exp.createdAt && (
                            <span className="text-[10px] text-gray-400 font-mono">
                              {exp.createdAt.toDate ? exp.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          )}
                        </div>
                        <button 
                          onClick={() => onToggleUnwanted(exp.id!, exp.isUnwanted || false)}
                          className={`text-[10px] font-black uppercase tracking-widest transition-colors ${exp.isUnwanted ? 'text-red-400 hover:text-indigo-600' : 'text-gray-300 hover:text-red-400'}`}
                        >
                          {exp.isUnwanted ? 'Oopsies (Unwanted)' : 'Mark as Unwanted'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-black ${exp.isUnwanted ? 'text-red-600' : 'text-gray-900'}`}>{getCurrencySymbol(exp.currency)}{exp.amount.toFixed(2)}</span>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => setEditingExpense(exp)}
                          className="p-1.5 text-gray-300 hover:text-indigo-600"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onDeleteExpense(exp.id!)}
                          className="p-1.5 text-gray-300 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <AnimatePresence>
              {editingExpense && (
                <ExpenseModal 
                  expenseToEdit={editingExpense}
                  onClose={() => setEditingExpense(null)}
                  onSave={async (updates) => {
                    await onUpdateExpense(editingExpense.id!, updates);
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          {upcomingTrials.length > 0 && (
            <div className="p-8 bg-amber-50 rounded-[2rem] border border-amber-100 space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-5 h-5" />
                <h3 className="font-bold">Trials Expiring Today</h3>
              </div>
              <div className="space-y-3">
                {upcomingTrials.map(t => (
                  <div key={t.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                        <Zap className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-gray-900">{t.serviceName}</span>
                    </div>
                    <span className="font-black text-amber-600">{getCurrencySymbol(t.currency)}{t.price?.toFixed(2) || '15.00'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="p-8 bg-indigo-900 text-white rounded-[2rem] shadow-xl shadow-indigo-100 space-y-6">
            <div>
              <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-1">Total Daily Spend</p>
              <h3 className="text-4xl font-black">{getCurrencySymbol(commonCurrency)}{total.toFixed(2)}</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
              <div>
                <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">Unwanted</p>
                <p className="text-lg font-bold">{getCurrencySymbol(commonCurrency)}{unwantedTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">Valuable</p>
                <p className="text-lg font-bold text-emerald-400">{getCurrencySymbol(commonCurrency)}{(total - unwantedTotal).toFixed(2)}</p>
              </div>
            </div>

            <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
              <p className="text-xs font-medium leading-relaxed italic opacity-80">
                {unwantedTotal > 0 
                  ? "You flagged some spending as unwanted today. Reflect on what triggered those impulsive purchases!"
                  : total > 50 
                    ? "A high spending day! Make sure everything logged was an investment in your happiness."
                    : "Excellent fiscal discipline today. Stay focused on your goals!"}
              </p>
            </div>
          </div>

          <div className="p-8 bg-indigo-50 rounded-[2rem] border border-indigo-100 space-y-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <Zap className="w-5 h-5" />
              <h3 className="font-bold">AI Financial Coach</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Based on your {dayExpenses.length} entries today, you are spending heavily on {dayExpenses[0]?.category || 'daily essentials'}. 
              Try to limit non-essential purchases to reach your savings target faster.
            </p>
            <button className="w-full py-2 bg-white border border-indigo-100 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
              Generate Detailed Report
            </button>
          </div>

          <div className="p-8 bg-white rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400">Quick Insight</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">Weekly Pace</p>
                <p className="text-[10px] text-gray-500">Your average spend is down 12% from last week.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Components ---

function Nav({ user, setView, currentView }: { user: User | null, setView: (v: 'dashboard' | 'directory' | 'life-track') => void, currentView: string }) {
  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b sticky top-0 z-50">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
        <div className="p-2 bg-indigo-600 rounded-lg">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight text-gray-900">TrialGuard</span>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-6">
          <button 
            onClick={() => setView('dashboard')}
            className={`text-sm font-bold transition-colors ${currentView === 'dashboard' ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setView('life-track')}
            className={`text-sm font-bold transition-colors ${currentView === 'life-track' ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
          >
            Life Track
          </button>
          <button 
            onClick={() => setView('directory')}
            className={`text-sm font-bold transition-colors ${currentView === 'directory' ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}
          >
            Cancel Directory
          </button>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <img 
                id="user-avatar"
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                className="w-8 h-8 rounded-full border shadow-sm"
                alt="Profile"
              />
              <button 
                id="logout-btn"
                onClick={logout}
                className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              id="login-btn"
              onClick={signInWithGoogle}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function NotificationBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setShow(true);
    }
  }, []);

  const requestPermission = () => {
    Notification.requestPermission().then(() => setShow(false));
  };

  if (!show) return null;

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="bg-indigo-600 text-white py-2 px-6 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bell className="w-4 h-4" />
          Don't forget local alerts: Enable browser notifications for expiry warnings.
        </div>
        <button 
          onClick={requestPermission}
          className="px-3 py-1 bg-white text-indigo-600 rounded text-xs font-bold hover:bg-indigo-50 transition-colors"
        >
          Enable
        </button>
      </div>
    </motion.div>
  );
}

function CancelDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredLinks = Object.entries(SERVICE_CANCEL_LINKS).filter(([name]) => 
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-12 py-12">
      <div className="text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold uppercase tracking-wider mb-2"
        >
          <Trash2 className="w-4 h-4" /> Termination Station
        </motion.div>
        <h1 className="text-4xl font-extrabold tracking-tight">The Termination Terminal</h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">Direct links to cancel the most annoying subscriptions. No friction, just freedom.</p>
      </div>

      <div className="max-w-xl mx-auto relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
        <input 
          type="text"
          placeholder="Search for a service..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-gray-900 font-medium"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[300px]">
        <AnimatePresence mode="popLayout">
          {filteredLinks.length > 0 ? (
            filteredLinks.map(([name, url]) => (
              <motion.div 
                layout
                key={name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-gray-900">{name}</span>
                </div>
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                >
                  Go <ArrowRight className="w-3 h-3" />
                </a>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full flex flex-col items-center justify-center text-center p-12 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200"
            >
              <div className="p-4 bg-gray-100 text-gray-300 rounded-full mb-4">
                <Search className="w-12 h-12" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Service Not Found</h3>
              <p className="text-gray-500 text-sm">We couldn't find a direct link for "{searchTerm}". You can still track it manually.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const TrialCard: React.FC<{ 
  trial: Trial, 
  onStatusUpdate: (id: string, s: 'cancelled' | 'active') => Promise<void>, 
  onEdit: (trial: Trial) => void,
  onDelete: (id: string) => Promise<void> 
}> = ({ trial, onStatusUpdate, onEdit, onDelete }) => {
  const startDate = new Date(trial.startDate);
  const expiryDate = new Date(startDate.getTime() + trial.durationDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const isExpiringSoon = daysLeft <= (trial.reminderDaysBefore || 2) && daysLeft > 0;
  const isExpired = daysLeft <= 0;
  
  const cancelUrl = trial.cancelUrl || SERVICE_CANCEL_LINKS[trial.serviceName];
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group relative p-5 bg-white rounded-2xl border transition-all hover:shadow-xl hover:-translate-y-1 ${
        trial.status === 'cancelled' ? 'opacity-60 bg-gray-50' : 
        isExpired ? 'border-red-100 shadow-sm' : 
        isExpiringSoon ? 'border-amber-200 shadow-md ring-1 ring-amber-100' : 'border-gray-100 shadow-sm'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${
            trial.status === 'cancelled' ? 'bg-gray-100 text-gray-400' :
            isExpired ? 'bg-red-50 text-red-500' :
            isExpiringSoon ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-500'
          }`}>
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-gray-900 leading-tight">{trial.serviceName}</h3>
              {trial.isAiScanned && (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 text-[10px] font-bold text-indigo-500 rounded-full border border-indigo-100">
                  <Zap className="w-2.5 h-2.5" /> AI
                </div>
              )}
              {trial.category && (
                <div className="px-1.5 py-0.5 bg-gray-50 text-[10px] font-bold text-gray-500 rounded-full border border-gray-100">
                  {trial.category}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 font-medium">Starts: {startDate.toLocaleDateString()}</p>
              {trial.price && (
                <p className="text-xs text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                  {trial.currency || '$'}{trial.price}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => onEdit(trial)}
            className="p-2 text-gray-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
            title="Edit Trial"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button 
            id={`delete-${trial.id}`}
            disabled={isDeleting}
            onClick={async () => {
              setIsDeleting(true);
              await onDelete(trial.id!);
              setIsDeleting(false);
            }}
            className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
          {trial.status === 'cancelled' ? (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase">
              <CheckCircle2 className="w-3 h-3" /> Safe
            </span>
          ) : isExpired ? (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-bold uppercase">
              <XCircle className="w-3 h-3" /> Charged?
            </span>
          ) : (
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
              isExpiringSoon ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
            }`}>
              <Zap className="w-3 h-3" /> {daysLeft} Days Left
            </span>
          )}
        </div>

        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, (daysLeft / trial.durationDays) * 100))}%` }}
            className={`h-full ${
              trial.status === 'cancelled' ? 'bg-gray-300' :
              isExpired ? 'bg-red-400' :
              isExpiringSoon ? 'bg-amber-400' : 'bg-indigo-500'
            }`}
          />
        </div>
      </div>

      {trial.notes && (
        <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Notes</p>
          <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">{trial.notes}</p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        {trial.status === 'active' && !isExpired && (
          <button 
            id={`cancel-btn-${trial.id}`}
            disabled={isUpdating}
            onClick={async () => {
              setIsUpdating(true);
              await onStatusUpdate(trial.id!, 'cancelled');
              setIsUpdating(false);
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
          >
            {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            I Cancelled It
          </button>
        )}
        {cancelUrl && (
          <a 
            id={`manage-btn-${trial.id}`}
            href={cancelUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all active:scale-95 text-white ${
              (isExpired || isExpiringSoon) && trial.status === 'active' ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
            } ${trial.status === 'cancelled' || isExpired ? 'col-span-2' : ''}`}
          >
            Manage <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {isExpiringSoon && trial.status === 'active' && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white animate-pulse">
          <AlertCircle className="w-4 h-4" />
        </div>
      )}
    </motion.div>
  );
}

const TrialModal: React.FC<{ 
  trialToEdit?: Trial | null, 
  onClose: () => void, 
  onSave: (data: any) => Promise<void>, 
  addToast: (msg: string, type?: ToastType) => void 
}> = ({ trialToEdit, onClose, onSave, addToast }) => {
  const [formData, setFormData] = useState({
    serviceName: trialToEdit?.serviceName || '',
    startDate: trialToEdit?.startDate || new Date().toISOString().split('T')[0],
    durationDays: trialToEdit?.durationDays || 7,
    cancelUrl: trialToEdit?.cancelUrl || '',
    price: trialToEdit?.price,
    currency: trialToEdit?.currency || 'USD',
    category: trialToEdit?.category || 'Other',
    notes: trialToEdit?.notes || '',
    confidence: null as number | null,
    isAiScanned: trialToEdit?.isAiScanned || false
  });
  const [isCustomMode, setIsCustomMode] = useState(!TRIAL_DURATIONS.some(d => d.value === (trialToEdit?.durationDays || 7)));
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setAnalysisStatus('Reading image...');
    setAnalysisProgress(10);

    try {
      // 1. Get base64 for Gemini
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const base64Image = await base64Promise;

      setAnalysisStatus('AI analysis in progress...');
      setAnalysisProgress(30);

      // 2. Multimodal AI Analysis (Try Gemini first)
      let smartResult;
      try {
        smartResult = await analyzeTrialImage(base64Image);
        setAnalysisProgress(80);
      } catch (aiError) {
        console.warn('AI analysis failed, falling back to local OCR:', aiError);
        setAnalysisStatus('AI failed. Running local OCR...');
        
        // 3. Fallback to Tesseract OCR
        const ocrResult = await processImage(file, {
          onProgress: (p) => setAnalysisProgress(30 + (p * 0.5)) // Spread OCR progress
        });
        
        smartResult = {
          serviceName: ocrResult.serviceName || '',
          durationDays: ocrResult.durationDays || 7,
          category: 'Other',
          confidence: 0.5
        };
      }
      
      setFormData(prev => ({
        ...prev,
        serviceName: smartResult.serviceName || prev.serviceName,
        durationDays: smartResult.durationDays || prev.durationDays,
        price: smartResult.price || prev.price,
        currency: smartResult.currency || prev.currency,
        category: smartResult.category || prev.category,
        isAiScanned: true,
        confidence: smartResult.confidence || 0.8,
        notes: smartResult.notes || `Scanned details for ${smartResult.serviceName}.`
      }));
      
      setAnalysisStatus('Done!');
      setAnalysisProgress(100);
      addToast(`Detected ${smartResult.serviceName}!`, 'success');
    } catch (error: any) {
      console.error(error);
      addToast(error.message || 'Scan failed. Please enter details manually.', 'error');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setAnalysisStatus('');
        setAnalysisProgress(0);
      }, 500);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{trialToEdit ? 'Edit Trial' : 'Add New Trial'}</h2>
            <p className="text-sm text-gray-500">{trialToEdit ? 'Update your subscription details.' : 'Track your subscription safely.'}</p>
          </div>
          <button id="close-modal" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className={`p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-indigo-100 transition-colors ${isProcessing ? 'pointer-events-none opacity-80' : ''}`} onClick={() => fileInputRef.current?.click()}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-indigo-900 text-sm">Scan Confirmation</p>
                {isProcessing ? (
                  <div className="space-y-1 mt-1">
                    <p className="text-[10px] text-indigo-500 font-bold animate-pulse">{analysisStatus}</p>
                    <div className="w-full bg-indigo-100 h-1 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${analysisProgress}%` }}
                        className="h-full bg-indigo-600"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-indigo-600 font-medium">Auto-fill with AI scan</p>
                )}
              </div>
            </div>
            {isProcessing ? null : <ChevronRight className="w-5 h-5 text-indigo-300 group-hover:translate-x-1 transition-transform" />}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleOcr}
            />
          </div>

          {formData.isAiScanned && formData.confidence !== null && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-xl border flex items-center gap-3 ${
                formData.confidence > 0.8 
                  ? 'bg-emerald-50 border-emerald-100' 
                  : formData.confidence > 0.5 
                    ? 'bg-amber-50 border-amber-100' 
                    : 'bg-red-50 border-red-100'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${
                formData.confidence > 0.8 ? 'bg-emerald-100 text-emerald-600' : 
                formData.confidence > 0.5 ? 'bg-amber-100 text-amber-600' : 
                'bg-red-100 text-red-600'
              }`}>
                <Info className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-bold ${
                    formData.confidence > 0.8 ? 'text-emerald-900' : 
                    formData.confidence > 0.5 ? 'text-amber-900' : 
                    'text-red-900'
                  }`}>
                    {formData.confidence > 0.8 ? 'High Confidence' : 
                     formData.confidence > 0.5 ? 'Medium Confidence' : 
                     'Low Confidence Scan'}
                  </p>
                  <span className="text-[10px] font-black opacity-50">{Math.round(formData.confidence * 100)}%</span>
                </div>
                <p className={`text-[10px] font-medium leading-tight mt-0.5 ${
                  formData.confidence > 0.8 ? 'text-emerald-700' : 
                  formData.confidence > 0.5 ? 'text-amber-700' : 
                  'text-red-700'
                }`}>
                  {formData.confidence > 0.8 
                    ? 'AI is very sure about these details. Just a quick check needed!' 
                    : 'AI guessed some details. Please double-check the values.'}
                </p>
              </div>
            </motion.div>
          )}

          <div className="grid gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Service Name</label>
              <input 
                id="service-name"
                value={formData.serviceName}
                onChange={e => setFormData({...formData, serviceName: e.target.value})}
                placeholder="e.g. Netflix, Disney+"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Start Date</label>
                <input 
                  id="start-date"
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData({...formData, startDate: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Duration</label>
                <div className="space-y-2">
                  <select 
                    id="duration"
                    value={isCustomMode ? 'custom' : formData.durationDays}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setIsCustomMode(true);
                      } else {
                        setIsCustomMode(false);
                        setFormData({...formData, durationDays: parseInt(val)});
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium appearance-none text-sm"
                  >
                    {TRIAL_DURATIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                    <option value="custom">Custom Days...</option>
                  </select>
                  {isCustomMode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="relative"
                    >
                      <input 
                        type="number"
                        min="1"
                        autoFocus
                        value={formData.durationDays}
                        onChange={e => setFormData({...formData, durationDays: parseInt(e.target.value) || 0})}
                        placeholder="Enter days..."
                        className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-indigo-900 text-sm"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-indigo-400">Days</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Price After Trial</label>
                <input 
                  id="trial-price"
                  type="number"
                  step="0.01"
                  value={formData.price || ''}
                  onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Currency</label>
                <select 
                  id="currency"
                  value={formData.currency}
                  onChange={e => setFormData({...formData, currency: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium appearance-none text-sm"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Category</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {['Entertainment', 'Productivity', 'Utilities', 'Health', 'Other'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData({...formData, category: cat})}
                    className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition-all ${
                      formData.category === cat 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                        : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Cancel URL (Optional)</label>
              <input 
                id="cancel-url"
                value={formData.cancelUrl}
                onChange={e => setFormData({...formData, cancelUrl: e.target.value})}
                placeholder="https://..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Notes</label>
              <textarea 
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                placeholder="Any special instructions..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-sm h-20 resize-none"
              />
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs font-bold text-gray-900">Telegram Alerts</p>
                  <p className="text-[10px] text-gray-500 font-medium">Coming Soon: Instant alerts on Telegram.</p>
                </div>
              </div>
              <div className="w-10 h-5 bg-gray-300 rounded-full relative opacity-50">
                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50/50 border-t flex gap-3">
          <button 
            id="cancel-modal"
            disabled={isSaving}
            onClick={onClose} 
            className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
            <button 
            id="save-trial"
            onClick={handleSubmit}
            disabled={!formData.serviceName || isSaving}
            className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {trialToEdit ? 'Save Changes' : 'Start Tracking'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTrial, setEditingTrial] = useState<Trial | null>(null);
  const [view, setView] = useState<'dashboard' | 'directory' | 'life-track'>('dashboard');
  const [selectedTrackDate, setSelectedTrackDate] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (user) {
      const unsubTrials = subscribeToTrials((newTrials) => {
        setTrials(newTrials);
      });
      const unsubExpenses = subscribeToExpenses((newExps) => {
        setExpenses(newExps);
      });
      return () => {
        unsubTrials();
        unsubExpenses();
      };
    } else {
      setTrials([]);
      setExpenses([]);
    }
  }, [user]);

  useEffect(() => {
    if (user && trials.length > 0) {
      const expiringSoon = trials.filter(t => {
        const start = new Date(t.startDate);
        const expiry = new Date(start.getTime() + t.durationDays * 24 * 60 * 60 * 1000);
        const diff = expiry.getTime() - new Date().getTime();
        const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return t.status === 'active' && daysLeft > 0 && daysLeft <= (t.reminderDaysBefore || 2);
      });

      if (expiringSoon.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        const notified = sessionStorage.getItem('notified_trials');
        const notifiedList = notified ? JSON.parse(notified) : [];
        
        expiringSoon.forEach(t => {
          if (!notifiedList.includes(t.id)) {
            new Notification('Trial Expiring Soon!', {
              body: `Your ${t.serviceName} trial ends in ${t.reminderDaysBefore || 2} days. Cancel now to avoid being charged!`,
              icon: '/favicon.ico'
            });
            notifiedList.push(t.id);
          }
        });
        sessionStorage.setItem('notified_trials', JSON.stringify(notifiedList));
      }
    }
  }, [user, trials]);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleAddTrial = async (data: any) => {
    try {
      await addTrial({
        ...data,
        reminderDaysBefore: 2,
      });
      setIsAddModalOpen(false);
      addToast(`Tracking ${data.serviceName}!`, 'success');
    } catch (error) {
      addToast(parseFirestoreError(error), 'error');
    }
  };

  const handleAddExpense = async (data: any) => {
    try {
      await addExpense(data);
      addToast('Expense logged!', 'success');
    } catch (error) {
      addToast('Failed to log expense.', 'error');
    }
  };

  const handleUpdateExpense = async (id: string, updates: any) => {
    try {
      await updateExpense(id, updates);
      addToast('Expense updated!', 'success');
    } catch (error) {
      addToast('Failed to update.', 'error');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteExpense(id);
      addToast('Deleted entry', 'info');
    } catch (error) {
      addToast('Failed to delete.', 'error');
    }
  };

  const handleToggleUnwanted = async (id: string, current: boolean) => {
    try {
      await updateExpense(id, { isUnwanted: !current });
    } catch (error) {
      addToast('Update failed.', 'error');
    }
  };

  const handleUpdateTrial = async (data: any) => {
    if (!editingTrial?.id) return;
    try {
      await updateTrial(editingTrial.id, data);
      setEditingTrial(null);
      addToast('Changes saved!', 'success');
    } catch (error) {
      addToast(parseFirestoreError(error), 'error');
    }
  };

  const handleStatusUpdate = async (id: string, status: 'cancelled' | 'active') => {
    try {
      await updateTrialStatus(id, status);
      addToast(status === 'cancelled' ? 'Marked as cancelled!' : 'Trial reactivated', 'success');
    } catch (error) {
      addToast(parseFirestoreError(error), 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTrial(id);
      addToast('Removed from tracking', 'info');
    } catch (error) {
      addToast(parseFirestoreError(error), 'error');
    }
  };

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(trials));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "my_trials_export.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addToast('Data exported successfully!', 'success');
  };

  const handleWipeData = async () => {
    if (confirm('Are you absolutely sure? This will delete ALL your tracked trials from our database forever. This cannot be undone.')) {
      try {
        for (const t of trials) {
          await deleteTrial(t.id!);
        }
        addToast('All data has been wiped.', 'info');
      } catch (error) {
        addToast('Error wiping data.', 'error');
      }
    }
  };

  const [statusFilter, setStatusFilter] = useState<'all' | 'active'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTrials = trials
    .filter(t => {
      const matchesStatus = statusFilter === 'all' || t.status === 'active';
      const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;
      const matchesSearch = t.serviceName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesCategory && matchesSearch;
    })
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const totalPotentialMonthly = trials
    .filter(t => t.status === 'active')
    .reduce((sum, t) => sum + (t.price || 0), 0);

  const totalSavedMonthly = trials
    .filter(t => t.status === 'cancelled')
    .reduce((sum, t) => sum + (t.price || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const activeCount = trials.filter(t => t.status === 'active').length;
  const expiringCount = trials.filter(t => {
    const start = new Date(t.startDate);
    const expiry = new Date(start.getTime() + t.durationDays * 24 * 60 * 60 * 1000);
    const diff = expiry.getTime() - new Date().getTime();
    return t.status === 'active' && (diff / (1000 * 60 * 60 * 24)) <= 2;
  }).length;

  const totalSavings = trials.filter(t => t.status === 'cancelled').reduce((acc, t) => acc + (t.price || 15), 0);
  const monthlyRisk = trials.filter(t => t.status === 'active').reduce((acc, t) => acc + (t.price || 0), 0);
  const efficiency = trials.length > 0 ? Math.round((trials.filter(t => t.status === 'cancelled').length / trials.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-900 font-sans selection:bg-indigo-100">
      <Nav user={user} setView={setView} currentView={view} />
      {user && <NotificationBanner />}
      
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {view === 'directory' ? (
          <CancelDirectory />
        ) : view === 'life-track' ? (
          selectedTrackDate ? (
            <DailyDetailView 
              date={selectedTrackDate} 
              expenses={expenses}
              trials={trials}
              onBack={() => setSelectedTrackDate(null)}
              onAddExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
              onToggleUnwanted={handleToggleUnwanted}
            />
          ) : (
            <LifeTrackView 
              expenses={expenses} 
              trials={trials}
              onSelectDate={setSelectedTrackDate}
              onAddExpense={handleAddExpense}
            />
          )
        ) : !user ? (
          <div className="mt-12 lg:mt-24 max-w-3xl mx-auto text-center space-y-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-sm font-bold tracking-wide uppercase mb-4"
            >
              <Zap className="w-4 h-4" /> All-new in 2026
            </motion.div>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1]">
              Never pay for a <span className="text-indigo-600 italic">forgotten</span> trial again.
            </h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium leading-relaxed">
              The privacy-first trial tracker. No bank links, no data sharing. 
              Snap a photo, set a reminder, and we'll tell you when to cancel.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <button 
                id="cta-get-started"
                onClick={signInWithGoogle}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
              >
                Get Started for Free
              </button>
              <button 
                onClick={() => setView('directory')}
                className="w-full sm:w-auto px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                Cancellation Directory
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24">
              <div className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm text-left">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl w-fit mb-4">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">Privacy First</h3>
                <p className="text-gray-500 text-sm leading-relaxed">OCR happens entirely in your browser. We never see your screenshots.</p>
              </div>
              <div className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm text-left">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl w-fit mb-4">
                  <Bell className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">Smart Alerts</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Get notified 48 hours before you get charged. Stay in control.</p>
              </div>
              <div className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm text-left">
                <div className="p-3 bg-green-50 text-green-600 rounded-2xl w-fit mb-4">
                  <ExternalLink className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">1-Click Cancel</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Direct links to cancel pages for 100+ services. Stop the friction.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 pb-24">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Welcome back, {user.displayName?.split(' ')[0]}!</h1>
                <p className="text-gray-500 font-medium">You have {activeCount} active trials being monitored.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleExportData}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                  title="Export Data"
                >
                  Export
                </button>
                <button 
                  id="add-trial-main"
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  <Plus className="w-5 h-5" /> Track New Trial
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Averted Charges', value: `$${totalSavedMonthly.toFixed(2)}`, sub: 'TOTAL', color: 'text-emerald-600', subColor: 'text-emerald-400' },
                { label: 'Monthly Risk', value: `$${totalPotentialMonthly.toFixed(2)}`, sub: 'RECURRING', color: 'text-red-500', subColor: 'text-red-400' },
                { label: 'Expiring Soon', value: expiringCount, sub: 'NEXT 48H', color: 'text-amber-500', subColor: 'text-amber-400' },
                { label: 'Track Efficiency', value: `${efficiency}%`, sub: 'LEVEL', color: 'text-indigo-500', subColor: 'text-indigo-400' }
              ].map((stat, i) => (
                <motion.div 
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm"
                >
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <div className="flex items-baseline gap-1">
                    <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                    {stat.sub && (
                      <p className={`text-[10px] font-bold ${stat.subColor}`}>{stat.sub}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-sm">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                    <input 
                      type="text"
                      placeholder="Search trials..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-600 transition-all shadow-sm outline-none placeholder:text-gray-300"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <select 
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-transparent border-none text-sm font-bold text-gray-400 focus:ring-0 cursor-pointer outline-none hover:text-indigo-600 transition-colors"
                  >
                    <option value="All">All Categories</option>
                    {['Entertainment', 'Productivity', 'Utilities', 'Health', 'Other'].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active')}
                    className="bg-transparent border-none text-sm font-bold text-gray-400 focus:ring-0 cursor-pointer outline-none hover:text-indigo-600 transition-colors"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active Only</option>
                  </select>
                </div>
              </div>

              {trials.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200"
                >
                  <div className="p-4 bg-indigo-50 text-indigo-200 rounded-full">
                    <Plus className="w-12 h-12" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">No trials tracked yet</h3>
                    <p className="text-gray-500 text-sm max-w-xs mx-auto">Start by adding your first trial. Use the camera to scan confirmation emails!</p>
                  </div>
                  <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md"
                  >
                    Add Now
                  </button>
                </motion.div>
              ) : filteredTrials.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200"
                >
                  <div className="p-4 bg-gray-100 text-gray-300 rounded-full">
                    <Search className="w-12 h-12" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">No matching trials</h3>
                    <p className="text-gray-500 text-sm max-w-xs mx-auto">Try adjusting your filters to find what you're looking for.</p>
                  </div>
                  <button 
                    onClick={() => { setStatusFilter('all'); setCategoryFilter('All'); }}
                    className="mt-2 px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-300 transition-all"
                  >
                    Clear Filters
                  </button>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence mode="popLayout">
                    {filteredTrials.map(trial => (
                      <TrialCard 
                        key={trial.id} 
                        trial={trial} 
                        onStatusUpdate={handleStatusUpdate}
                        onEdit={(t) => setEditingTrial(t)}
                        onDelete={handleDelete}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {isAddModalOpen && (
          <TrialModal 
            onClose={() => setIsAddModalOpen(false)} 
            onSave={handleAddTrial} 
            addToast={addToast}
          />
        )}
        {editingTrial && (
          <TrialModal 
            trialToEdit={editingTrial}
            onClose={() => setEditingTrial(null)} 
            onSave={handleUpdateTrial} 
            addToast={addToast}
          />
        )}
      </AnimatePresence>

      <footer className="mt-auto py-12 px-6 border-t bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-gray-900">TrialGuard</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-gray-400 font-medium">© 2026 TrialGuard. Privacy-First. Zero-Tracker.</p>
            {user && (
              <button 
                onClick={handleWipeData}
                className="text-[10px] uppercase tracking-widest font-black text-red-300 hover:text-red-500 transition-colors"
              >
                Wipe All My Data (GDPR Kill Switch)
              </button>
            )}
          </div>
          <div className="flex gap-6 text-sm font-bold text-gray-400">
            <a href="#" className="hover:text-indigo-600">Privacy</a>
            <a href="#" className="hover:text-indigo-600">Terms</a>
            <a href="#" className="hover:text-indigo-600">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
