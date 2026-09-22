import React from 'react';
import { ShieldAlert, Activity, History, QrCode, FileText, Database } from 'lucide-react';
import { supabase } from '../supabase';

export default function Header({ activeTab, setActiveTab, activeWorker }) {
  const isSupabaseConnected = Boolean(supabase);

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md bg-slate-900/90 shadow-xl">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Product Identity */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/30">
            <ShieldAlert className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-extrabold tracking-wider text-white">
                SULFIDE<span className="text-amber-400">SENTINELS</span>
              </h1>
              {isSupabaseConnected ? (
                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <Database className="w-3 h-3" /> Supabase DB
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  Local Cache
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
              H₂S Passive Dosimeter Optical Reader
            </p>
          </div>
        </div>

        {/* Worker Badge pill if active */}
        {activeWorker?.workerId && (
          <div className="hidden sm:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-slate-400">Worker:</span>
            <span className="font-semibold text-white">{activeWorker.workerId}</span>
            <span className="text-slate-500">|</span>
            <span className="text-amber-400 font-medium">{activeWorker.scanStage === 'PRE_SHIFT' ? 'Pre-Shift' : 'Post-Shift'}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <nav className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'setup'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. Setup</span>
          </button>

          <button
            onClick={() => setActiveTab('scan')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'scan'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>2. Scan</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>3. Logs</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
