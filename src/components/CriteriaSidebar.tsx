import React, { useState } from 'react';
import { X, ChevronRight, PlusCircle, MinusCircle } from 'lucide-react';
import { EvaluationCriteriaConfig } from '../types';

interface CriteriaSidebarProps {
  criteria: EvaluationCriteriaConfig;
}

export const CriteriaSidebar: React.FC<CriteriaSidebarProps> = ({ criteria }) => {
  const [isOpen, setIsOpen] = useState(false);

  const positiveList = criteria?.positiveCriteria || [];
  const negativeList = criteria?.negativeCriteria || [];

  return (
    <>
      {/* Floating Trigger Button on Left Center (30px width x 120px height) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Buka Kriteria Penilaian"
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-40 w-[30px] h-[120px] bg-emerald-800/95 hover:bg-emerald-700 text-white rounded-r-2xl shadow-xl border-y border-r border-emerald-400/40 flex flex-col items-center justify-between py-2.5 transition-all duration-200 cursor-pointer active:scale-95 group select-none ${
          isOpen ? 'opacity-0 pointer-events-none -translate-x-full' : 'opacity-100'
        }`}
        title="Buka Kriteria Penilaian Sikap"
      >
        {/* Logo KDU di dalam tombol */}
        <div className="w-5 h-5 rounded-md flex items-center justify-center overflow-hidden shrink-0">
          <img
            src="https://i.ibb.co.com/nqfqhc29/kdu.png"
            alt="KDU"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Indikator Vertikal Minimalis */}
        <div className="flex flex-col items-center space-y-1 py-1">
          <span className="w-1 h-1 rounded-full bg-emerald-300" />
          <span className="w-1 h-1 rounded-full bg-emerald-400" />
          <span className="w-1 h-1 rounded-full bg-emerald-300" />
        </div>

        {/* Panah Buka */}
        <ChevronRight className="w-4 h-4 text-emerald-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
      </button>

      {/* Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity animate-fadeIn"
        />
      )}

      {/* Sidebar Drawer Panel */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-[340px] sm:max-w-[360px] bg-slate-900 text-white shadow-2xl border-r border-emerald-800/50 flex flex-col transform transition-transform duration-300 ease-out select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Minimalist Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-900/80 border border-emerald-500/40 p-0.5 shrink-0 flex items-center justify-center">
              <img
                src="https://i.ibb.co.com/nqfqhc29/kdu.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-xs sm:text-sm font-black text-white tracking-wide truncate">
              Kriteria Penilaian
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Tutup Sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Criteria Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Section 1: Kriteria Penambah Poin (+) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-emerald-900/60 pb-1.5">
              <span className="flex items-center space-x-1.5 text-[11px] font-black tracking-wider text-emerald-400 uppercase">
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Penambah Poin (+)</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-400/80 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/60">
                {positiveList.length}
              </span>
            </div>

            <div className="space-y-2">
              {positiveList.map((item, idx) => (
                <div
                  key={item.id || `pos-${idx}`}
                  className="flex items-start space-x-2.5 p-2.5 rounded-xl bg-slate-800/70 border border-emerald-900/40 hover:border-emerald-700/60 transition-colors"
                >
                  <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-black">
                    +{item.points ?? 10}
                  </span>
                  <p className="text-xs text-slate-200 leading-snug font-medium">
                    {item.title}
                  </p>
                </div>
              ))}

              {positiveList.length === 0 && (
                <p className="text-xs text-slate-500 italic py-2 text-center">
                  Belum ada kriteria penambah poin.
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Kriteria Pengurang Poin (-) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-rose-900/60 pb-1.5">
              <span className="flex items-center space-x-1.5 text-[11px] font-black tracking-wider text-rose-400 uppercase">
                <MinusCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Pengurang Poin (-)</span>
              </span>
              <span className="text-[10px] font-bold text-rose-400/80 bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800/60">
                {negativeList.length}
              </span>
            </div>

            <div className="space-y-2">
              {negativeList.map((item, idx) => (
                <div
                  key={item.id || `neg-${idx}`}
                  className="flex items-start space-x-2.5 p-2.5 rounded-xl bg-slate-800/70 border border-rose-900/40 hover:border-rose-700/60 transition-colors"
                >
                  <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[10px] font-black">
                    -{item.points ?? 10}
                  </span>
                  <p className="text-xs text-slate-200 leading-snug font-medium">
                    {item.title}
                  </p>
                </div>
              ))}

              {negativeList.length === 0 && (
                <p className="text-xs text-slate-500 italic py-2 text-center">
                  Belum ada kriteria pengurang poin.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/80 text-center">
          <span className="text-[10px] font-bold text-emerald-400/90 uppercase tracking-wider">
            SMP Negeri 1 Bengkalis
          </span>
        </div>
      </aside>
    </>
  );
};
