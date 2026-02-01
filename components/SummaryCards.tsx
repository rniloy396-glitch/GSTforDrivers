
import React from 'react';
import { GSTSummary } from '../types';
import { TrendingUp, TrendingDown, Calculator, DollarSign } from 'lucide-react';

interface SummaryCardsProps {
  summary: GSTSummary;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
            <TrendingUp size={24} />
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">GST Collected</span>
        </div>
        <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(summary.totalCollected)}</h3>
        <p className="text-slate-500 text-sm mt-1">From fares & deliveries</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
            <TrendingDown size={24} />
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">GST Paid (Credits)</span>
        </div>
        <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(summary.totalPaid)}</h3>
        <p className="text-slate-500 text-sm mt-1">On fuel, fees & maintenance</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 bg-indigo-50/30 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Calculator size={24} />
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net GST Payable</span>
        </div>
        <h3 className={`text-2xl font-bold ${summary.netPayable >= 0 ? 'text-indigo-700' : 'text-emerald-700'}`}>
          {formatCurrency(Math.abs(summary.netPayable))}
          {summary.netPayable < 0 && <span className="text-sm ml-2">(Refund)</span>}
        </h3>
        <p className="text-slate-500 text-sm mt-1">Estimated liability</p>
      </div>
    </div>
  );
};

export default SummaryCards;
