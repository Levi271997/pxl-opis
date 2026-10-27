'use client';

import { useEffect, useState } from 'react';
import { useOffice, type DialogRequest } from '@/lib/store';

export default function DialogBox() {
  const dialog = useOffice(s => s.dialog);
  if (!dialog) return null;
  // key resets the typewriter state for every new dialog
  return <DialogView key={dialog.id} dialog={dialog} />;
}

function DialogView({ dialog }: { dialog: DialogRequest }) {
  const closeDialog = useOffice(s => s.closeDialog);
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(0);
  const [choice, setChoice] = useState(0);

  const text = dialog.pages[page];
  const typing = shown < text.length;
  const lastPage = page === dialog.pages.length - 1;
  const choices = !typing && lastPage ? dialog.choices : undefined;

  useEffect(() => {
    if (!typing) return;
    const timer = setInterval(() => setShown(n => n + 1), 22);
    return () => clearInterval(timer);
  }, [typing, page]);

  const choose = (i: number) => {
    closeDialog();
    dialog.onChoice?.(dialog.choices![i]);
  };

  const advance = () => {
    if (typing) setShown(text.length); // skip the typewriter
    else if (choices) choose(choice);
    else if (!lastPage) { setPage(p => p + 1); setShown(0); }
    else closeDialog();
  };

  // Re-bound every render so the handler always sees current state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      const n = choices?.length ?? 0;
      if (choices && (k === 'arrowup' || k === 'w')) setChoice(c => (c - 1 + n) % n);
      else if (choices && (k === 'arrowdown' || k === 's')) setChoice(c => (c + 1) % n);
      else if (k === 'e' || k === ' ' || k === 'enter' || k === 'z') advance();
      else if (k === 'escape' || k === 'x') closeDialog();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div className="dialog-backdrop" onPointerDown={advance} />
      <div id="dialog-wrap">
        {choices && (
          <ul id="dialog-choices">
            {choices.map((c, i) => (
              <li
                key={c}
                className={i === choice ? 'active' : undefined}
                onPointerEnter={() => setChoice(i)}
                onPointerDown={e => { e.stopPropagation(); choose(i); }}
              >
                {c}
              </li>
            ))}
          </ul>
        )}
        <div id="dialog" role="dialog" aria-live="polite" onPointerDown={advance}>
          {dialog.speaker && <div id="dialog-name">{dialog.speaker}</div>}
          <p id="dialog-text">{text.slice(0, shown)}</p>
          {!typing && !choices && <span id="dialog-arrow">▼</span>}
        </div>
      </div>
    </>
  );
}
