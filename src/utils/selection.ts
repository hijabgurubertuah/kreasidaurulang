export const saveSelection = (): Range | null => {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) return sel.getRangeAt(0);
  return null;
};

export const restoreSelection = (range: Range | null) => {
  if (range) {
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
};
