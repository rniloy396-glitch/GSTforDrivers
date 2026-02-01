
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  FileUp, Receipt, Shield, Download, PieChart, Info, Plus, 
  Loader2, X, ChevronRight, Calendar, Smartphone, Car, 
  Globe, Music, Settings2, LogOut, User as UserIcon, LogIn,
  Mail, ShieldCheck, Zap, Lock, ArrowRight, UserPlus, Eye, EyeOff, Search,
  Check, ExternalLink, ShieldAlert, Key, AlertTriangle, Cake, Save, Edit3,
  CloudCheck
} from 'lucide-react';
import { 
  Transaction, TransactionType, GSTSummary, EarningCategory, 
  ExpenseCategory, Platform, BusinessPercentages, User 
} from './types';
import { parseDocument } from './services/geminiService';
import SummaryCards from './components/SummaryCards';
import TransactionTable from './components/TransactionTable';

const QUARTERS = [
  { label: 'Q1 (July - Sept)', months: [7, 8, 9] },
  { label: 'Q2 (Oct - Dec)', months: [10, 11, 12] },
  { label: 'Q3 (Jan - Mar)', months: [1, 2, 3] },
  { label: 'Q4 (Apr - Jun)', months: [4, 5, 6] },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const UBER_EARNING_CATEGORIES: EarningCategory[] = [
  'Gross Transportation Fares', 'Split Fare Fee', 'Toll Reimbursement',
  'City/Government Fees', 'Airport Fees', 'Booking Fees',
  'Delivery Fee', 'Delivery Incentives', 'Delivery Tolls Reimbursement',
  'Miscellaneous/Referrals/Incentives', 'Tips', 'Miscellaneous'
];

const DIDI_EARNING_CATEGORIES: EarningCategory[] = [
  'Gross Rider Fares', 'Booking Fee', 'Handling Fee', 'Tolls',
  'Airport Fee', 'Government Levy', 'Cancellation Fee', 'CTP Fee',
  'Split Fare Fee', 'Other Fare Breakdown Amounts', 'Rewards', 'Other'
];

const OTHER_EARNING_CATEGORIES: EarningCategory[] = [
  'Gross Transportation Fares', 'Tips', 'Rewards', 'Miscellaneous/Referrals/Incentives', 'Other'
];

const GENERAL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Car Expenses - Fuel', 'Car Expenses - EV Home Charging', 'Car Expenses - EV Public Charging',
  'Car Expenses - Registration', 'Car Expenses - Insurance & CTP', 'Car Expenses - Servicing, Repairs & Tyres',
  'Car Expenses - Cleaning', 'Car Expenses - Accessories & Other', 'Car Expenses - Rent, Hire & Lease Payments',
  'Accountancy', 'Bank Fees', 'Computer Expenses', 'Courses & Training', 'Equipment (dashcams, tools etc)',
  'Internet', 'Mobile Phone - For Both Business & Personal', 'Mobile Phone - 100% for Business', 'Music Subscriptions',
  'Parking', 'Tolls (Expenses)', 'Other Expenses (GST)', 'Other Expenses (non-GST)'
];

type AppView = 'LANDING' | 'AUTH' | 'DASHBOARD' | 'PROFILE';
type AuthMode = 'LOGIN' | 'SIGNUP';

const GOOGLE_CLIENT_ID = "871708885013-5ffidp2rnugg7nkahjstblr3p6aetipk.apps.googleusercontent.com";

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>('LANDING');
  const [authMode, setAuthMode] = useState<AuthMode>('LOGIN');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Data Store - transactions starts as null to distinguish "loading" from "empty"
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [percentages, setPercentages] = useState<BusinessPercentages>({
    motorVehicle: 60, mobilePhone: 30, internet: 0, musicSubscriptions: 0
  });

  // UI States
  const [isProcessing, setIsProcessing] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<number | 'ALL'>(Math.floor((new Date().getMonth() + 3) / 3) % 4 || 4);
  const [isSaving, setIsSaving] = useState(false);

  // Auth Inputs
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [dobInput, setDobInput] = useState('');

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDob, setEditDob] = useState('');

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    type: TransactionType.EXPENSE, 
    platform: 'Uber' as Platform,
    date: new Date().toISOString().split('T')[0], 
    description: '',
    category: GENERAL_EXPENSE_CATEGORIES[0] as any, 
    grossAmount: '', 
    gstAmount: '',
  });

  // 1. Initial Session Restoration
  useEffect(() => {
    const session = localStorage.getItem('rideshare_active_user');
    if (session) {
      try {
        const user = JSON.parse(session);
        setCurrentUser(user);
        setView('DASHBOARD');
      } catch (e) {
        console.error("Session restoration failed");
      }
    }
  }, []);

  // 2. Google Identity Services Setup
  const handleCredentialResponse = useCallback((response: any) => {
    try {
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      const payload = JSON.parse(jsonPayload);
      
      const registryStr = localStorage.getItem('rideshare_users_registry') || '[]';
      const registry: User[] = JSON.parse(registryStr);
      const existing = registry.find(u => u.email.toLowerCase() === payload.email.toLowerCase());

      if (existing) {
        loginUser(existing);
      } else {
        const googleUser: User = {
          id: `g-${payload.sub}`,
          email: payload.email,
          name: payload.name,
          avatar: payload.picture,
          createdAt: new Date().toISOString()
        };
        registry.push(googleUser);
        localStorage.setItem('rideshare_users_registry', JSON.stringify(registry));
        loginUser(googleUser);
      }
    } catch (err) {
      console.error("Google Auth Error:", err);
    }
  }, []);

  useEffect(() => {
    let checkInterval: any;
    const initGoogle = () => {
      const g = (window as any).google;
      if (g && g.accounts && g.accounts.id) {
        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const renderBtns = () => {
          const lBtn = document.getElementById("google-signin-landing");
          const aBtn = document.getElementById("google-signin-auth");
          if (lBtn) g.accounts.id.renderButton(lBtn, { theme: "outline", size: "large", width: 320, shape: "pill", text: "continue_with" });
          if (aBtn) g.accounts.id.renderButton(aBtn, { theme: "outline", size: "large", width: 320, shape: "pill", text: "signin_with" });
        };
        renderBtns();
        // Occasionally re-render if elements appear late
        if (checkInterval) clearInterval(checkInterval);
        checkInterval = setInterval(renderBtns, 1000);
      }
    };
    initGoogle();
    return () => clearInterval(checkInterval);
  }, [view, handleCredentialResponse]);

  // 3. Data Loader (Atomic Load)
  useEffect(() => {
    if (currentUser) {
      setTransactions(null); // Mark as loading
      const storageKey = `rideshare_data_${currentUser.id}`;
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        try {
          const { txs, percs } = JSON.parse(savedData);
          setTransactions(txs || []);
          setPercentages(percs || { motorVehicle: 60, mobilePhone: 30, internet: 0, musicSubscriptions: 0 });
        } catch (e) {
          console.error("Data load failed", e);
          setTransactions([]);
        }
      } else {
        setTransactions([]); // New user, empty array
        setPercentages({ motorVehicle: 60, mobilePhone: 30, internet: 0, musicSubscriptions: 0 });
      }
      
      setEditName(currentUser.name);
      setEditDob(currentUser.dob || '');
    }
  }, [currentUser?.id]); // Only re-run if the actual ID changes

  // 4. Data Saver (Only runs IF transactions is NOT null - meaning we successfully loaded)
  useEffect(() => {
    if (currentUser && transactions !== null) {
      setIsSaving(true);
      const storageKey = `rideshare_data_${currentUser.id}`;
      localStorage.setItem(storageKey, JSON.stringify({ transactions, percentages }));
      const timer = setTimeout(() => setIsSaving(false), 800);
      return () => clearTimeout(timer);
    }
  }, [transactions, percentages, currentUser]);

  // 5. Category Selection Logic
  const dynamicCategories = useMemo(() => {
    if (manualForm.type === TransactionType.EXPENSE) return GENERAL_EXPENSE_CATEGORIES;
    if (manualForm.platform === 'Uber') return UBER_EARNING_CATEGORIES;
    if (manualForm.platform === 'DiDi') return DIDI_EARNING_CATEGORIES;
    return OTHER_EARNING_CATEGORIES;
  }, [manualForm.type, manualForm.platform]);

  useEffect(() => {
    setManualForm(prev => ({ ...prev, category: dynamicCategories[0] }));
  }, [dynamicCategories]);

  // --- Auth Actions ---

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setTimeout(() => {
      const registryStr = localStorage.getItem('rideshare_users_registry') || '[]';
      const registry: User[] = JSON.parse(registryStr);
      if (authMode === 'SIGNUP') {
        const newUser: User = {
          id: `u-${Math.random().toString(36).substr(2, 9)}`,
          email: emailInput.toLowerCase(),
          name: nameInput || emailInput.split('@')[0],
          dob: dobInput,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${emailInput}`,
          createdAt: new Date().toISOString()
        };
        registry.push(newUser);
        localStorage.setItem('rideshare_users_registry', JSON.stringify(registry));
        loginUser(newUser);
      } else {
        const existing = registry.find(u => u.email.toLowerCase() === emailInput.toLowerCase());
        if (existing) loginUser(existing);
        else alert("No account found. Please sign up!");
      }
      setIsAuthenticating(false);
    }, 1000);
  };

  const loginUser = (user: User) => {
    setTransactions(null); // Reset before login
    setCurrentUser(user);
    localStorage.setItem('rideshare_active_user', JSON.stringify(user));
    setView('DASHBOARD');
    setEmailInput(''); setPasswordInput(''); setNameInput(''); setDobInput('');
  };

  const logout = () => {
    localStorage.removeItem('rideshare_active_user');
    setCurrentUser(null);
    setTransactions(null);
    setView('LANDING');
  };

  const saveProfileUpdates = () => {
    if (!currentUser) return;
    const updatedUser: User = { ...currentUser, name: editName, dob: editDob };
    setCurrentUser(updatedUser);
    localStorage.setItem('rideshare_active_user', JSON.stringify(updatedUser));
    const registryStr = localStorage.getItem('rideshare_users_registry') || '[]';
    const registry: User[] = JSON.parse(registryStr);
    localStorage.setItem('rideshare_users_registry', JSON.stringify(registry.map(u => u.id === currentUser.id ? updatedUser : u)));
    setIsEditingProfile(false);
  };

  // --- Transaction Logic ---

  const getPercentageForCategory = useCallback((category: string): number => {
    if (category.startsWith('Car Expenses')) return percentages.motorVehicle;
    if (category === 'Mobile Phone - For Both Business & Personal') return percentages.mobilePhone;
    if (category === 'Internet' || category === 'Computer Expenses') return percentages.internet;
    if (category === 'Music Subscriptions') return percentages.musicSubscriptions;
    return 100;
  }, [percentages]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => {
      const d = new Date(tx.date);
      const m = d.getMonth() + 1;
      if (selectedQuarter !== 'ALL') {
        const quarter = QUARTERS[Number(selectedQuarter) - 1];
        if (!quarter.months.includes(m)) return false;
      }
      return true;
    });
  }, [transactions, selectedQuarter]);

  const summary: GSTSummary = useMemo(() => {
    const collected = filteredTransactions.filter(tx => tx.type === TransactionType.EARNING).reduce((sum, tx) => sum + tx.gstAmount, 0);
    const paid = filteredTransactions.filter(tx => tx.type === TransactionType.EXPENSE).reduce((sum, tx) => sum + (tx.gstAmount * (getPercentageForCategory(tx.category) / 100)), 0);
    let label = selectedQuarter === 'ALL' ? "All Time" : QUARTERS[Number(selectedQuarter) - 1].label;
    return { totalCollected: collected, totalPaid: paid, netPayable: collected - paid, periodLabel: label };
  }, [filteredTransactions, selectedQuarter, getPercentageForCategory]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        try {
          const result = await parseDocument(base64, file.type);
          const newTxs = result.transactions.map(item => ({ ...item, id: crypto.randomUUID(), sourceFile: file.name } as Transaction));
          setTransactions(prev => [...newTxs, ...(prev || [])]);
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
      };
      reader.readAsDataURL(file);
    } catch (err) { setIsProcessing(false); }
    event.target.value = '';
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const gross = parseFloat(manualForm.grossAmount); const gst = parseFloat(manualForm.gstAmount);
    if (isNaN(gross)) return;
    const newTx: Transaction = { id: crypto.randomUUID(), ...manualForm, grossAmount: gross, gstAmount: gst, netAmount: gross - gst, confidence: 1.0 } as Transaction;
    setTransactions(prev => [newTx, ...(prev || [])]); 
    setIsManualModalOpen(false);
  };

  if (view === 'LANDING') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-6 py-6 max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><Receipt size={24} /></div>
            <span className="text-xl font-bold tracking-tight text-slate-900">GSTforDrivers</span>
          </div>
          <div className="flex gap-4">
            <button onClick={() => { setView('AUTH'); setAuthMode('LOGIN'); }} className="text-slate-600 font-bold text-sm hover:text-indigo-600">Sign In</button>
            <button onClick={() => { setView('AUTH'); setAuthMode('SIGNUP'); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100">Join Free</button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-5xl mx-auto relative overflow-hidden">
          <div className="z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold mb-8"><Zap size={14} /> Advanced AI Tax Agent</div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-8">Rideshare taxes,<br /><span className="text-indigo-600">automated.</span></h1>
            <p className="text-lg md:text-xl text-slate-500 max-w-2xl mb-12">Extract GST credits from statements and receipts in seconds with our AI engine.</p>
            <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
              <div id="google-signin-landing" className="min-h-[50px]"></div>
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[10px] font-bold text-slate-300 uppercase">or join with email</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <button onClick={() => { setView('AUTH'); setAuthMode('SIGNUP'); }} className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-bold text-sm flex items-center justify-center gap-2">Create Account <ArrowRight size={18} /></button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (view === 'AUTH') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden p-10 space-y-8 animate-in zoom-in-95">
          <div className="text-center space-y-2">
            <div onClick={() => setView('LANDING')} className="mx-auto w-14 h-14 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center text-white cursor-pointer shadow-xl mb-6"><Receipt size={28} /></div>
            <h2 className="text-3xl font-extrabold text-slate-900">{authMode === 'LOGIN' ? 'Welcome Back' : 'Sign Up'}</h2>
          </div>
          <div id="google-signin-auth" className="flex justify-center"></div>
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'SIGNUP' && (
              <div className="space-y-4">
                <div className="relative"><UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" required value={nameInput} onChange={e => setNameInput(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-2xl" placeholder="Full Name" /></div>
                <div className="relative"><Cake className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="date" required value={dobInput} onChange={e => setDobInput(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-2xl" /></div>
              </div>
            )}
            <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="email" required value={emailInput} onChange={e => setEmailInput(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-2xl" placeholder="Email" /></div>
            <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="password" required value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-2xl" placeholder="Password" /></div>
            <button type="submit" disabled={isAuthenticating} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold shadow-xl shadow-indigo-100 flex items-center justify-center gap-2">
              {isAuthenticating ? <Loader2 className="animate-spin" /> : (authMode === 'LOGIN' ? 'Sign In' : 'Sign Up')}
            </button>
          </form>
          <button onClick={() => setAuthMode(authMode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} className="w-full text-center text-sm font-bold text-indigo-600">{authMode === 'LOGIN' ? "No account? Sign Up" : "Have an account? Log In"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('DASHBOARD')}>
              <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-md"><Receipt size={18} /></div>
              <h1 className="text-base font-bold text-slate-900 hidden sm:block">GSTforDrivers</h1>
            </div>
            {currentUser && (
              <nav className="flex items-center gap-1">
                <button onClick={() => setView('DASHBOARD')} className={`px-4 py-1.5 rounded-lg text-sm font-bold ${view === 'DASHBOARD' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>Dashboard</button>
                <button onClick={() => setView('PROFILE')} className={`px-4 py-1.5 rounded-lg text-sm font-bold ${view === 'PROFILE' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>Profile</button>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isSaving && <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-emerald-600"><CloudCheck size={14} /> Synced</div>}
            <button onClick={() => setView('PROFILE')} className="w-10 h-10 rounded-full border-2 border-indigo-100 overflow-hidden bg-white"><img src={currentUser?.avatar} className="w-full h-full object-cover" alt="Profile" /></button>
          </div>
        </div>
      </header>

      {view === 'PROFILE' ? (
        <main className="max-w-4xl mx-auto px-4 mt-12 w-full animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden p-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-extrabold text-slate-900">Driver Profile</h2>
              <div className="flex gap-3">
                <button onClick={logout} className="px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-2xl hover:bg-rose-100">Log Out</button>
                {isEditingProfile ? (
                  <button onClick={saveProfileUpdates} className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100">Save Changes</button>
                ) : (
                  <button onClick={() => setIsEditingProfile(true)} className="px-6 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-100">Edit Info</button>
                )}
              </div>
            </div>
            <div className="space-y-6 max-w-md">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Full Name</label>
                {isEditingProfile ? (
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                ) : (
                  <p className="text-slate-700 font-bold text-lg">{currentUser?.name}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Date of Birth</label>
                {isEditingProfile ? (
                  <input type="date" value={editDob} onChange={e => setEditDob(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                ) : (
                  <p className="text-slate-700 font-bold text-lg">{currentUser?.dob || 'Not provided'}</p>
                )}
              </div>
              <div className="space-y-1.5 pt-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Registered Email</label>
                <p className="text-slate-500 font-medium">{currentUser?.email}</p>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-4 mt-8 w-full">
          {!transactions ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse"><Loader2 className="animate-spin text-indigo-600 mb-4" size={40} /><p className="font-bold text-slate-400">Loading your BAS records...</p></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
              <div className="lg:col-span-3 space-y-8">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Calendar size={20} /></div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">BAS Reporting</p>
                        <h4 className="text-sm font-bold text-slate-700 mt-1">{summary.periodLabel}</h4>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setIsManualModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-white font-bold text-sm bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-lg shadow-indigo-100"><Plus size={18} /> Add Record</button>
                      <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all">
                        <FileUp size={18} /> AI Extract
                        <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} disabled={isProcessing} />
                      </label>
                    </div>
                  </div>

                  <div className="flex p-1 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden w-full">
                    {QUARTERS.map((q, idx) => (
                      <button 
                        key={q.label} 
                        onClick={() => setSelectedQuarter(idx + 1)} 
                        className={`flex-1 px-2 sm:px-4 py-2.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all ${selectedQuarter === idx + 1 ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Q{idx + 1}
                      </button>
                    ))}
                    <button 
                      onClick={() => setSelectedQuarter('ALL')} 
                      className={`flex-1 px-2 sm:px-4 py-2.5 text-[10px] sm:text-xs font-bold rounded-xl transition-all ${selectedQuarter === 'ALL' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Full Year
                    </button>
                  </div>
                </div>
                
                {isProcessing && (
                  <div className="bg-white border-2 border-indigo-100 p-8 rounded-3xl flex flex-col items-center justify-center animate-pulse">
                    <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} /><p className="font-bold text-slate-800">Gemini-3-Pro extracting data...</p>
                  </div>
                )}
                <SummaryCards summary={summary} />
                <TransactionTable transactions={filteredTransactions} onDelete={id => setTransactions(prev => (prev || []).filter(t => t.id !== id))} />
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm sticky top-24">
                  <div className="flex items-center gap-2 mb-6 text-indigo-600"><Settings2 size={20} /><h3 className="font-bold text-slate-900">Tax Claims %</h3></div>
                  <div className="space-y-6">
                    {[
                      { icon: <Car size={16} />, label: "Logbook Use", key: 'motorVehicle' as const },
                      { icon: <Smartphone size={16} />, label: "Mobile Share", key: 'mobilePhone' as const }
                    ].map(item => (
                      <div key={item.key} className="space-y-3">
                        <div className="flex items-center justify-between text-sm font-bold text-slate-600">
                          <span className="flex items-center gap-2">{item.icon} {item.label}</span>
                          <span className="text-indigo-600">{percentages[item.key]}%</span>
                        </div>
                        <input type="range" value={percentages[item.key]} onChange={e => setPercentages(prev => ({ ...prev, [item.key]: parseInt(e.target.value) }))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Add Transaction</h3>
              <button onClick={() => setIsManualModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-8 space-y-5">
              <div className="flex p-1 bg-slate-100 rounded-2xl">
                <button type="button" onClick={() => setManualForm(prev => ({ ...prev, type: TransactionType.EARNING }))} className={`flex-1 py-2 text-sm font-bold rounded-xl ${manualForm.type === TransactionType.EARNING ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>Earning</button>
                <button type="button" onClick={() => setManualForm(prev => ({ ...prev, type: TransactionType.EXPENSE }))} className={`flex-1 py-2 text-sm font-bold rounded-xl ${manualForm.type === TransactionType.EXPENSE ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>Expense</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Platform</label>
                  <select value={manualForm.platform} onChange={e => setManualForm(prev => ({ ...prev, platform: e.target.value as Platform }))} className="w-full px-4 py-2 bg-slate-50 border rounded-xl outline-none"><option value="Uber">Uber</option><option value="DiDi">DiDi</option><option value="Ola">Ola</option><option value="Other">Other</option></select>
                </div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Category</label>
                  <select value={manualForm.category} onChange={e => setManualForm(prev => ({ ...prev, category: e.target.value as any }))} className="w-full px-4 py-2 bg-slate-50 border rounded-xl outline-none text-xs h-10">{dynamicCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Date</label><input type="date" required value={manualForm.date} onChange={e => setManualForm(prev => ({ ...prev, date: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border rounded-xl outline-none" /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Description</label><input type="text" required value={manualForm.description} onChange={e => setManualForm(prev => ({ ...prev, description: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border rounded-xl outline-none" placeholder="e.g. Fuel Shell" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Gross ($)</label><input type="number" step="0.01" required value={manualForm.grossAmount} onChange={e => {
                  const val = parseFloat(e.target.value);
                  setManualForm(prev => ({ ...prev, grossAmount: e.target.value, gstAmount: isNaN(val) ? '' : (val / 11).toFixed(2) }));
                }} className="w-full px-4 py-2 bg-slate-50 border rounded-xl font-bold" /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">GST ($)</label><input type="number" step="0.01" required value={manualForm.gstAmount} onChange={e => setManualForm(prev => ({ ...prev, gstAmount: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border rounded-xl font-bold text-indigo-600" /></div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsManualModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-2xl font-bold text-slate-600">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"><Save size={18} /> Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;