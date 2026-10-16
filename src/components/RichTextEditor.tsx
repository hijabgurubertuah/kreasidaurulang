import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Palette, Plus, Minus, Image as ImageIcon, Video as VideoIcon,
  Undo2, Redo2
} from 'lucide-react';
import { sanitizeHtml, normalizeHtml } from '../utils/sanitize';
import { uploadImageToDrive } from '../utils/upload';
import { getEmbedUrl } from '../utils/video';

interface RichTextEditorProps {
  initialValue?: string;
  documentId?: string;
  onSave?: (html: string) => void;
  placeholder?: string;
}

interface HistoryState {
  stack: { html: string; range: { start: number; end: number } }[];
  index: number;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialValue = '<p><br></p>',
  documentId,
  onSave,
  placeholder = 'Mulai menulis di sini...',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<string>(initialValue);
  const historyRef = useRef<HistoryState>({ stack: [], index: -1 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [activeFormats, setActiveFormats] = useState({
    bold: false, italic: false, underline: false,
    justifyLeft: false, justifyCenter: false, justifyRight: false, justifyFull: false,
    insertUnorderedList: false, insertOrderedList: false
  });

  const getCaretInfo = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRef.current) return { start: 0, end: 0 };
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const start = preCaretRange.toString().length;
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const end = preCaretRange.toString().length;
    return { start, end };
  }, []);

  const restoreCaret = useCallback((start: number, end: number) => {
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;
    const range = document.createRange();
    let charCount = 0;
    const traverse = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharCount = charCount + (node.textContent?.length || 0);
        if (start >= charCount && start <= nextCharCount) {
          range.setStart(node, start - charCount);
        }
        if (end >= charCount && end <= nextCharCount) {
          range.setEnd(node, end - charCount);
        }
        charCount = nextCharCount;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) traverse(node.childNodes[i]);
      }
    };
    traverse(editorRef.current);
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const saveSnapshot = useCallback(() => {
    if (!editorRef.current) return;
    const html = sanitizeHtml(editorRef.current.innerHTML);
    if (historyRef.current.index >= 0 && historyRef.current.stack[historyRef.current.index].html === html) return;
    
    const newStack = historyRef.current.stack.slice(0, historyRef.current.index + 1);
    newStack.push({ html, range: getCaretInfo() });
    if (newStack.length > 100) newStack.shift();
    historyRef.current = { stack: newStack, index: newStack.length - 1 };
    setCanUndo(historyRef.current.index > 0);
    setCanRedo(false);
    contentRef.current = html;
  }, [getCaretInfo]);

  const undo = () => {
    if (historyRef.current.index > 0) {
      historyRef.current.index--;
      const state = historyRef.current.stack[historyRef.current.index];
      if (editorRef.current) {
        editorRef.current.innerHTML = state.html;
        restoreCaret(state.range.start, state.range.end);
        editorRef.current.focus();
      }
      contentRef.current = state.html;
      setCanUndo(historyRef.current.index > 0);
      setCanRedo(true);
    }
  };

  const redo = () => {
    if (historyRef.current.index < historyRef.current.stack.length - 1) {
      historyRef.current.index++;
      const state = historyRef.current.stack[historyRef.current.index];
      if (editorRef.current) {
        editorRef.current.innerHTML = state.html;
        restoreCaret(state.range.start, state.range.end);
        editorRef.current.focus();
      }
      contentRef.current = state.html;
      setCanUndo(true);
      setCanRedo(historyRef.current.index < historyRef.current.stack.length - 1);
    }
  };

  useEffect(() => {
    if (editorRef.current) {
      const normalized = normalizeHtml(initialValue);
      editorRef.current.innerHTML = normalized;
      contentRef.current = normalized;
      historyRef.current = { stack: [{ html: normalized, range: { start: 0, end: 0 } }], index: 0 };
      setCanUndo(false);
      setCanRedo(false);
    }
  }, [documentId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (onSave) onSave(contentRef.current);
    }, 2000);
    return () => clearTimeout(handler);
  }, [contentRef.current, onSave]);

  const execCmd = (command: string, val: string = '') => {
    saveSnapshot();
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    saveSnapshot();
  };

  const applyFontSize = (size: number) => {
    saveSnapshot();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('fontSize', false, '7');
    const span = window.getSelection()?.anchorNode?.parentElement;
    if (span) span.style.fontSize = `${size}px`;
    saveSnapshot();
  };

  const handleInsertImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        saveSnapshot();
        const url = await uploadImageToDrive(file);
        document.execCommand('insertHTML', false, `<img src="${url}" alt="image" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" />`);
        saveSnapshot();
      }
    };
    input.click();
  };

  const handleInsertVideo = () => {
    const url = prompt('Masukkan Link Video:');
    if (url) {
      const embedUrl = getEmbedUrl(url);
      if (embedUrl) {
        saveSnapshot();
        document.execCommand('insertHTML', false, `<div class="video-wrap" contenteditable="false" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:12px 0;" data-video="${embedUrl}"><iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div><p><br></p>`);
        saveSnapshot();
      } else {
        alert('Link video tidak dikenali.');
      }
    }
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      requestAnimationFrame(() => {
        setActiveFormats({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          justifyLeft: document.queryCommandState('justifyLeft'),
          justifyCenter: document.queryCommandState('justifyCenter'),
          justifyRight: document.queryCommandState('justifyRight'),
          justifyFull: document.queryCommandState('justifyFull'),
          insertUnorderedList: document.queryCommandState('insertUnorderedList'),
          insertOrderedList: document.queryCommandState('insertOrderedList'),
        });
      });
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const btnClass = "p-2 bg-white hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 shadow-xs cursor-pointer";
  const activeBtnClass = "bg-slate-300 border-slate-400";
  const disabledBtnClass = "opacity-50 cursor-not-allowed";
  
  const toolbarBtnProps = (command: string, val: string = '') => ({
    type: 'button' as const,
    onPointerDown: (e: React.PointerEvent) => e.preventDefault(),
    onTouchStart: (e: React.TouchEvent) => e.preventDefault(),
    onClick: () => execCmd(command, val),
    className: `${btnClass} ${activeFormats[command as keyof typeof activeFormats] ? activeBtnClass : ''}`
  });

  return (
    <div className="space-y-2 border border-slate-300 rounded-2xl overflow-hidden">
      <div className="flex items-center space-x-1 p-2 bg-slate-100 border-b border-slate-200 overflow-x-auto sticky top-0 z-10">
        <button onPointerDown={e => e.preventDefault()} onClick={undo} disabled={!canUndo} className={`${btnClass} ${!canUndo ? disabledBtnClass : ''}`} title="Urungkan (Ctrl+Z)"><Undo2 className="w-5 h-5" /></button>
        <button onPointerDown={e => e.preventDefault()} onClick={redo} disabled={!canRedo} className={`${btnClass} ${!canRedo ? disabledBtnClass : ''}`} title="Ulangi (Ctrl+Y)"><Redo2 className="w-5 h-5" /></button>
        <span className="w-px h-8 bg-slate-300 mx-1" />
        <button {...toolbarBtnProps('bold')} title="Bold (Ctrl+B)"><Bold className="w-5 h-5" /></button>
        <button {...toolbarBtnProps('italic')} title="Italic (Ctrl+I)"><Italic className="w-5 h-5" /></button>
        <button {...toolbarBtnProps('underline')} title="Underline (Ctrl+U)"><Underline className="w-5 h-5" /></button>
        <span className="w-px h-8 bg-slate-300 mx-1" />
        <button {...toolbarBtnProps('justifyLeft')} title="Rata Kiri"><AlignLeft className="w-5 h-5" /></button>
        <button {...toolbarBtnProps('justifyCenter')} title="Rata Tengah"><AlignCenter className="w-5 h-5" /></button>
        <button {...toolbarBtnProps('justifyRight')} title="Rata Kanan"><AlignRight className="w-5 h-5" /></button>
        <button {...toolbarBtnProps('justifyFull')} title="Rata Kiri-Kanan"><AlignJustify className="w-5 h-5" /></button>
        <span className="w-px h-8 bg-slate-300 mx-1" />
        <button {...toolbarBtnProps('insertUnorderedList')} title="Bullet"><List className="w-5 h-5" /></button>
        <button {...toolbarBtnProps('insertOrderedList')} title="Numbering"><ListOrdered className="w-5 h-5" /></button>
        <span className="w-px h-8 bg-slate-300 mx-1" />
        <select onChange={(e) => applyFontSize(parseInt(e.target.value))} className={btnClass}>
          {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36].map(size => <option key={size} value={size}>{size}px</option>)}
        </select>
        <input type="color" onChange={(e) => execCmd('foreColor', e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
        <button type="button" onPointerDown={e => e.preventDefault()} onClick={handleInsertImage} className={btnClass} title="Gambar"><ImageIcon className="w-5 h-5" /></button>
        <button type="button" onPointerDown={e => e.preventDefault()} onClick={handleInsertVideo} className={btnClass} title="Video"><VideoIcon className="w-5 h-5" /></button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={(e) => {
          const html = e.currentTarget.innerHTML;
          if (!html || html === '<br>') e.currentTarget.innerHTML = '<p><br></p>';
          contentRef.current = sanitizeHtml(e.currentTarget.innerHTML);
          
          const handler = setTimeout(saveSnapshot, 500);
          return () => clearTimeout(handler);
        }}
        onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
        }}
        className="w-full min-h-[400px] p-4 text-sm bg-white focus:outline-none overflow-y-auto leading-relaxed konten-dokumen
        [white-space:pre-wrap] [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_img]:max-w-full [&_img]:h-auto
        [user-select:text] [-webkit-user-select:text] [caret-color:auto]"
      />
    </div>
  );
};
