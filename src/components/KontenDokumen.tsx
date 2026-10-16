import React from 'react';
import { sanitizeHtml } from '../utils/sanitize';

interface KontenDokumenProps {
  html: string;
  className?: string;
}

export const KontenDokumen: React.FC<KontenDokumenProps> = ({ html, className = '' }) => {
  return (
    <div
      className={`konten-dokumen ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html, true) }}
    />
  );
};
