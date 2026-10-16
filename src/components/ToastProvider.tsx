import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  tampilToast: (teks: string, jenis?: ToastType, durasi?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ teks: string; jenis: ToastType; durasi: number } | null>(null);

  const tampilToast = useCallback((teks: string, jenis: ToastType = 'info', durasi = 800) => {
    setToast({ teks, jenis, durasi });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, toast.durasi);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <ToastContext.Provider value={{ tampilToast }}>
      {children}
      {toast && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] px-4 py-2 bg-slate-900/90 text-white text-xs font-bold rounded-full shadow-2xl animate-fadeIn animate-fadeOut" style={{ animation: `fadeIn 0.15s ease-out, fadeOut 0.15s ease-in ${toast.durasi - 150}ms forwards` }}>
          {toast.teks}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast harus dipakai dalam ToastProvider');
  return context;
};
