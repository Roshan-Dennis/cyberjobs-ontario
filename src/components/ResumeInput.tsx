'use client';

import { useId, useRef, useState } from 'react';
import { readResumeFile, ResumeFileError } from '@/lib/client/resume-file';
import { resumeStore, useResume } from '@/lib/client/resume-store';

/** The privacy promise, worded to be literally true of how the code behaves. */
export function PrivacyNote({ className = '' }: { className?: string }) {
  return (
    <p className={`flex gap-2 rounded-md border border-line bg-surface2 px-3 py-2 text-xs text-muted ${className}`}>
      <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good">
        <path d="M8 1.5l5 2v4c0 3.2-2.1 5.9-5 7-2.9-1.1-5-3.8-5-7v-4l5-2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M5.8 8.2l1.6 1.6 2.9-3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        <strong className="font-semibold text-ink">Nothing is stored or sent.</strong> Your resume is read and scored inside your
        browser — it is never uploaded or saved anywhere. It stays in this tab only while you browse and is gone when you
        close or refresh the page.
      </span>
    </p>
  );
}

/** Shows which resume is loaded, with a way to swap or remove it. */
export function LoadedResumeBar() {
  const resume = useResume();
  if (!resume) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-surface2 px-3 py-2 text-xs">
      <span className="min-w-0 flex-1 truncate">
        <span className="text-muted">Resume: </span>
        <span className="font-medium">{resume.name}</span>
      </span>
      <button type="button" onClick={() => resumeStore.clear()} className="font-medium text-brand hover:underline">
        Remove
      </button>
    </div>
  );
}

/**
 * Upload or paste, the reader's choice. Accepts PDF and Word (.docx); plain
 * text files too. Old binary .doc files are explained rather than half-read.
 */
export function ResumeInput({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = { file: useId(), paste: useId(), tabs: useId() };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const text = await readResumeFile(file);
      resumeStore.set(text, file.name);
    } catch (e) {
      setError(e instanceof ResumeFileError ? e.message : 'Something went wrong reading that file. Try another format, or paste the text.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const usePasted = () => {
    if (pasted.replace(/\s/g, '').length < 50) {
      setError('That looks too short to be a resume. Paste the whole document, including your experience and skills.');
      return;
    }
    setError(null);
    resumeStore.set(pasted, 'Pasted text');
    setPasted('');
  };

  const tab = (value: 'upload' | 'paste', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => {
        setMode(value);
        setError(null);
      }}
      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        mode === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="How to add your resume" id={ids.tabs} className="flex gap-1 rounded-lg bg-surface2 p-1">
        {tab('upload', 'Upload a file')}
        {tab('paste', 'Paste text')}
      </div>

      {mode === 'upload' ? (
        <label
          htmlFor={ids.file}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 text-center transition-colors ${
            compact ? 'py-5' : 'py-7'
          } ${dragging ? 'border-brand bg-brand/10' : 'border-line hover:border-brand/60 hover:bg-surface2'}`}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 text-muted">
            <path d="M12 16V4m0 0l-4 4m4-4l4 4M5 16v3h14v-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-medium">{busy ? 'Reading your resume…' : 'Choose a file or drop it here'}</span>
          <span className="text-xs text-muted">PDF or Word (.docx) · up to 5 MB</span>
          <input
            id={ids.file}
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
            className="sr-only"
            disabled={busy}
            aria-label="Upload your resume (PDF or Word)"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="space-y-2">
          <label htmlFor={ids.paste} className="sr-only">
            Paste your resume text
          </label>
          <textarea
            id={ids.paste}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={compact ? 7 : 9}
            placeholder="Paste the full text of your resume here…"
            className="input min-h-[9rem] resize-y font-mono text-xs leading-relaxed"
          />
          <button type="button" onClick={usePasted} className="btn btn-primary w-full">
            Use this text
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          {error}
        </p>
      ) : null}
      <PrivacyNote />
    </div>
  );
}
