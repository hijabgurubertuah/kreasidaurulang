import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import {
  QrCode,
  Download,
  Printer,
  X,
  Check,
  Copy,
  Barcode as BarcodeIcon,
  Sparkles,
} from 'lucide-react';
import { TeacherCode } from '../types';

interface TeacherBarcodeModalProps {
  teacher: TeacherCode | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TeacherBarcodeModal: React.FC<TeacherBarcodeModalProps> = ({
  teacher,
  isOpen,
  onClose,
}) => {
  const [activeBarcodeType, setActiveBarcodeType] = useState<'qr' | '1d'>('qr');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const barcodeSvgRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!teacher || !isOpen) return;

    // Generate high resolution QR code for fast, close-up camera scanning
    QRCode.toDataURL(teacher.code, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a', // Slate 900 for maximum contrast
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR Code:', err);
      });

    // Render 1D Barcode (Code 128) via JsBarcode
    if (barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, teacher.code, {
          format: 'CODE128',
          lineColor: '#0f172a',
          width: 2.2,
          height: 75,
          displayValue: true,
          font: 'monospace',
          fontSize: 14,
          fontOptions: 'bold',
          margin: 10,
          background: '#ffffff',
        });
      } catch (err) {
        console.error('Failed to generate 1D barcode:', err);
      }
    }
  }, [teacher, isOpen, activeBarcodeType]);

  if (!isOpen || !teacher) return null;

  const handleDownload = () => {
    if (activeBarcodeType === 'qr' && qrDataUrl) {
      const a = document.createElement('a');
      a.href = qrDataUrl;
      a.download = `QR_Login_Guru_${teacher.code}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (barcodeSvgRef.current) {
      // Export SVG to PNG for 1D barcode
      const svgData = new XMLSerializer().serializeToString(barcodeSvgRef.current);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width || 350;
        canvas.height = image.height || 140;
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0);
          const png = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = png;
          a.download = `Barcode_Login_Guru_${teacher.code}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      };
      image.src = blobURL;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(teacher.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block">
                Barcode Login Guru
              </span>
              <span className="text-[10px] text-slate-400 block">
                Tersimpan di Firebase
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector: QR Code vs Barcode 1D */}
        <div className="p-2 bg-slate-100 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-2 gap-1 bg-slate-200/80 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveBarcodeType('qr')}
              className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeBarcodeType === 'qr'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-600" />
              <span>QR Code (Kamera)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveBarcodeType('1d')}
              className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeBarcodeType === '1d'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarcodeIcon className="w-3.5 h-3.5 text-slate-700" />
              <span>Barcode Garis</span>
            </button>
          </div>
        </div>

        {/* Printable Card Area */}
        <div
          ref={cardRef}
          className="p-4 sm:p-5 flex flex-col items-center text-center space-y-3 bg-white overflow-y-auto"
        >
          <div className="inline-flex items-center space-x-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>SMP Negeri 1 Bengkalis</span>
          </div>

          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
              {teacher.name}
            </h3>
            <p className="text-[11px] text-slate-500 capitalize mt-0.5">
              {teacher.role === 'admin' ? 'Administrator Portal' : 'Guru Pembina Kokurikuler'}
              {teacher.assignedClass ? ` • ${teacher.assignedClass}` : ''}
            </p>
          </div>

          {/* Barcode Display */}
          <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-inner flex flex-col items-center justify-center min-h-[170px] w-full max-w-[260px]">
            {activeBarcodeType === 'qr' ? (
              qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code Login ${teacher.code}`}
                  className="w-40 h-40 sm:w-44 sm:h-44 object-contain rounded-lg"
                />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">
                  Menyiapkan QR Code...
                </div>
              )
            ) : (
              <div className="w-full flex flex-col items-center py-2">
                <svg
                  ref={barcodeSvgRef}
                  className="w-full max-w-[240px] h-auto"
                />
              </div>
            )}

            <div className="font-mono text-sm font-black text-slate-900 mt-2 tracking-widest bg-slate-100 px-3 py-1 rounded-lg border border-slate-300">
              {teacher.code}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed px-2 text-center">
            Arahkan kamera tombol scan login ke barcode ini untuk login otomatis seketika tanpa ketik kode.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{copied ? 'Tersalin' : 'Salin'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="Cetak Barcode"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
