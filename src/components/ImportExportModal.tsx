import React, { useState, useEffect, useRef } from 'react';
import { SubtitleProject, SubtitleLine, Character } from '../types/subtitle';
import {
  exportToSRT,
  exportToVTT,
  exportToASS,
  exportToJSON,
  exportToCSV,
  parseAnySubtitle,
} from '../utils/subtitleParser';
import {
  saveSubtitleSession,
  getSubtitleSession,
  loadLastSubtitleFile,
  pickSubtitleFile,
  SavedSubtitleSession,
} from '../utils/fileResumeStorage';
import { Download, Upload, Copy, Check, X, FileText, Sparkles, AlertCircle } from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: SubtitleProject;
  onImportLines: (newLines: SubtitleLine[], mode: 'replace' | 'append', fileName?: string) => void;
  onImportFullProject: (fullProject: SubtitleProject) => void;
  onAddCharacters?: (characters: Character[]) => void;
  defaultTab?: 'export' | 'import';
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  project,
  onImportLines,
  onImportFullProject,
  onAddCharacters,
  defaultTab = 'export',
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(defaultTab);
  const [exportFormat, setExportFormat] = useState<'srt' | 'vtt' | 'ass' | 'json' | 'csv'>('srt');
  const [copied, setCopied] = useState(false);

  const [importText, setImportText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [detectedFormatInfo, setDetectedFormatInfo] = useState<string | null>(null);

  // Resume subtitle session state
  const [pendingResume, setPendingResume] = useState<SavedSubtitleSession | null>(null);
  const [missingFileNotice, setMissingFileNotice] = useState<{ fileName: string; reason: string } | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync tab & check saved subtitle session when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setImportError(null);
      setImportSuccess(null);
      setDetectedFormatInfo(null);
      setMissingFileNotice(null);
      getSubtitleSession().then((session) => {
        if (session && session.linesCount > 0) {
          setPendingResume(session);
        }
      });
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const getExportContent = () => {
    switch (exportFormat) {
      case 'srt':
        return exportToSRT(project.lines);
      case 'vtt':
        return exportToVTT(project.lines);
      case 'ass':
        return exportToASS(project.lines, project.characters, project.title);
      case 'json':
        return exportToJSON(project);
      case 'csv':
        return exportToCSV(project.lines);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getExportContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const text = getExportContent();
    const cleanTitle = (project.title || 'subtitles').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const mimeMap: Record<string, string> = {
      srt: 'text/plain',
      vtt: 'text/vtt',
      ass: 'text/x-ssa',
      json: 'application/json',
      csv: 'text/csv',
    };
    const blob = new Blob([text], { type: mimeMap[exportFormat] || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanTitle}.${exportFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenSubtitlePicker = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
    }
    // Direct synchronous click triggers native file picker with zero latency
    // and eliminates recursive event bubbling or iframe permission freezes
    fileInputRef.current?.click();
  };

  const handleResumeSubtitles = async () => {
    if (!pendingResume) return;
    setIsResuming(true);
    setMissingFileNotice(null);
    try {
      // 1. Attempt to already load the last file from its last location
      const result = await loadLastSubtitleFile();
      if (result.success) {
        setImportFileName(result.fileName);
        setImportText(result.content);
        executeUniversalImport(result.content, result.fileName, result.file, result.session?.fileHandle);
        setPendingResume(null);
        setResumeNotice(`Resumed "${result.fileName}" (${result.linesCount} lines) directly from last location`);
        setTimeout(() => setResumeNotice(null), 3500);
      } else {
        // 2. If it is not there for whatever reason, inform them and let them locate/select it via the button
        setMissingFileNotice({
          fileName: pendingResume.fileName,
          reason: result.reason,
        });
      }
    } catch (err: any) {
      setMissingFileNotice({
        fileName: pendingResume.fileName,
        reason: 'Could not access subtitle file: ' + (err?.message || 'Access error'),
      });
    } finally {
      setIsResuming(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    try {
      const content = await file.text();
      setImportText(content);
      executeUniversalImport(content, file.name, file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(`Failed to read file: ${msg}`);
    } finally {
      // Reset file input so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    try {
      const content = await file.text();
      setImportText(content);
      executeUniversalImport(content, file.name, file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(`Failed to read dropped file: ${msg}`);
    }
  };

  const executeUniversalImport = (
    text: string,
    filename?: string,
    file?: File,
    fileHandle?: FileSystemFileHandle
  ) => {
    setImportError(null);
    setImportSuccess(null);
    setDetectedFormatInfo(null);

    const trimmed = text.trim();
    if (!trimmed) {
      setImportError('Import content is empty.');
      return;
    }

    try {
      const result = parseAnySubtitle(trimmed, filename || importFileName);

      // Save subtitle session for resume
      saveSubtitleSession({
        file,
        fileHandle,
        fileName: filename || importFileName || 'subtitles.srt',
        format: result.detectedFormat,
        content: text,
        linesCount: result.lines?.length || result.fullProject?.lines?.length || 0,
      });

      // If full project was in JSON
      if (result.fullProject) {
        onImportFullProject(result.fullProject);
        setImportSuccess(`Imported full project with ${result.fullProject.lines?.length || 0} lines & ${result.fullProject.characters?.length || 0} characters.`);
        setDetectedFormatInfo(result.detectedFormat);
        setTimeout(onClose, 1100);
        return;
      }

      // If new characters were detected (e.g. from ASS styles/names or VTT voice tags)
      if (result.newCharacters && result.newCharacters.length > 0 && onAddCharacters) {
        onAddCharacters(result.newCharacters);
      }

      if (result.lines.length === 0) {
        setImportError('No valid subtitle dialogue lines found in file.');
        return;
      }

      onImportLines(result.lines, importMode, filename || importFileName);
      setDetectedFormatInfo(result.detectedFormat);
      const charNote = result.newCharacters && result.newCharacters.length > 0 ? ` + ${result.newCharacters.length} character styles adapted` : '';
      setImportSuccess(`Successfully imported ${result.lines.length} lines (${result.detectedFormat})${charNote}!`);
      setTimeout(onClose, 1100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(`Parse error: ${msg}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md">
      <div
        className="w-full max-w-xl max-h-[90vh] crystal-glass rounded-2xl shadow-2xl overflow-hidden font-sans text-xs flex flex-col transition-colors duration-200"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 25px var(--accent-glow)',
          borderColor: 'var(--border-glass)',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Bar */}
        <div className="h-10 px-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-xs text-[var(--text-main)] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Subtitles Transfer Hub</span>
            </span>

            {/* Joined Tab Switcher */}
            <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--bg-app)] text-[10px] font-mono">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('import');
                  setImportError(null);
                  setImportSuccess(null);
                }}
                className={`px-2.5 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'import'
                    ? 'bg-[var(--accent)] text-white font-bold shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Upload className="w-2.5 h-2.5" />
                <span>Import</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('export');
                  setImportError(null);
                  setImportSuccess(null);
                }}
                className={`px-2.5 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'export'
                    ? 'bg-[var(--accent)] text-white font-bold shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Download className="w-2.5 h-2.5" />
                <span>Export</span>
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 space-y-3.5 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* ===================== TAB: IMPORT ===================== */}
          {activeTab === 'import' ? (
            <div className="space-y-3">
              {/* Missing Subtitle File Notice */}
              {missingFileNotice && (
                <div className="p-2.5 rounded-xl bg-amber-950/90 border border-amber-500/50 text-[11px] text-amber-200 flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">
                      <span className="font-semibold text-white">File not found at previous location: </span>
                      {missingFileNotice.reason}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    <button
                      type="button"
                      onClick={handleOpenSubtitlePicker}
                      className="h-5 px-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      title="Locate the subtitle file on your computer"
                    >
                      <Upload className="w-2.5 h-2.5" />
                      <span>Locate File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMissingFileNotice(null)}
                      className="h-5 w-5 rounded flex items-center justify-center text-amber-300 hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Resume Last Subtitle File Banner */}
              {pendingResume && !missingFileNotice && (
                <div className="p-2.5 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-[11px] text-indigo-200 flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">
                      Resume <span className="font-semibold text-white">"{pendingResume.fileName}"</span> ({pendingResume.linesCount} lines) from last location?
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleResumeSubtitles}
                      disabled={isResuming}
                      className="h-5 px-2.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span>{isResuming ? 'Loading...' : 'Resume'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingResume(null)}
                      className="h-5 px-1.5 rounded text-neutral-400 hover:text-white text-[10px] cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Resume Notice Feedback */}
              {resumeNotice && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center gap-1.5 font-medium animate-in fade-in">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{resumeNotice}</span>
                </div>
              )}

              {/* Universal Format Support Banner */}
              <div className="p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-light)] text-[11px] space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Universal Subtitle Import Engine</span>
                </div>
                <p className="text-[10.5px] text-[var(--text-muted)] leading-relaxed">
                  Imports and adapts any subtitle file. Automatically extracts timestamps, character styles, font tags, and dialogue:
                </p>
                {/* Supported Badges */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {['.SRT', '.ASS', '.SSA', '.VTT', '.SBV', '.JSON', '.CSV', '.LRC', '.TXT'].map((ext) => (
                    <span
                      key={ext}
                      className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/30"
                    >
                      {ext}
                    </span>
                  ))}
                </div>
              </div>

              {/* Drag & Drop File Upload Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={handleDrop}
                onClick={handleOpenSubtitlePicker}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenSubtitlePicker();
                  }
                }}
                className="border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-xl p-4 text-center cursor-pointer hover:bg-[var(--bg-hover)] transition-all group focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
              >
                <Upload className="w-6 h-6 mx-auto mb-1.5 text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:scale-110 transition-all" />
                <p className="font-semibold text-xs text-[var(--text-main)]">
                  Click to browse or drag & drop any subtitle file here
                </p>
                <p className="text-[10px] text-[var(--text-faint)] mt-0.5">
                  SRT, ASS, SSA, WebVTT, YouTube SBV, CSV, JSON, Lyrics LRC
                </p>
                {importFileName && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-[10px] font-mono">
                    <FileText className="w-3 h-3" />
                    <span>Selected: {importFileName}</span>
                  </div>
                )}
              </div>

              {/* Hidden file input placed outside the clickable container to eliminate event loop */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt,.ass,.ssa,.vtt,.sbv,.json,.csv,.tsv,.lrc,.txt,text/*"
                onChange={handleFileUpload}
                onClick={(e) => e.stopPropagation()}
                className="hidden"
                aria-hidden="true"
              />

              {/* Mode Options: Replace vs Append */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-subtle)]/60 border border-[var(--border-light)] text-[11px]">
                <span className="font-medium text-[var(--text-muted)]">Import Destination:</span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="accent-[var(--accent)]"
                    />
                    <span className={importMode === 'replace' ? 'font-semibold text-[var(--text-main)]' : 'text-[var(--text-muted)]'}>
                      Replace existing ({project.lines.length} lines)
                    </span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer ml-2">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="accent-[var(--accent)]"
                    />
                    <span className={importMode === 'append' ? 'font-semibold text-[var(--text-main)]' : 'text-[var(--text-muted)]'}>
                      Append to end
                    </span>
                  </label>
                </div>
              </div>

              {/* Or Paste Raw Subtitle Text */}
              <div>
                <label className="block text-[10.5px] font-medium text-[var(--text-muted)] mb-1">
                  Or paste subtitle text directly:
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste any SRT, ASS, SSA, WebVTT, SBV, JSON, or CSV raw text here..."
                  rows={4}
                  className="w-full p-2 text-[10.5px] font-mono bg-[var(--bg-app)] border border-[var(--border)] rounded-lg outline-hidden text-[var(--text-main)] focus:border-[var(--accent)] resize-y"
                />
              </div>

              {/* Status & Feedback */}
              {importError && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/40 text-red-600 dark:text-red-400 text-[11px] flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center gap-1.5 font-medium">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{importSuccess}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => executeUniversalImport(importText)}
                  disabled={!importText.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Process & Import</span>
                </button>
              </div>
            </div>
          ) : (
            /* ===================== TAB: EXPORT ===================== */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase text-[var(--text-muted)]">Format:</span>
                {(['srt', 'vtt', 'ass', 'json', 'csv'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setExportFormat(fmt)}
                    className={`px-2 py-0.5 font-mono text-[11px] uppercase rounded border transition-colors cursor-pointer ${
                      exportFormat === fmt
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)] font-bold'
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-light)]'
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>

              <div>
                <textarea
                  readOnly
                  value={getExportContent()}
                  rows={8}
                  className="w-full p-2 text-[10.5px] font-mono bg-[var(--bg-app)] border border-[var(--border)] rounded-lg outline-hidden text-[var(--text-main)] resize-y select-all"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10.5px] text-[var(--text-faint)]">
                  Exporting {project.lines.length} lines
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .{exportFormat.toUpperCase()}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
