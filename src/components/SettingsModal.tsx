import React, { useState, useEffect, useMemo } from 'react';
import {
  Character,
  Series,
  DefaultProjectSettings,
  SubtitleLine,
  COMMON_FONTS,
  FONT_SIZES,
  CHARACTER_PALETTE,
  LanguageListDisplayMode,
} from '../types/subtitle';
import { InlineColorWheel } from './ColorWheelPicker';
import {
  X,
  Tv,
  Users,
  Sliders,
  Plus,
  Trash2,
  Check,
  Sparkles,
  AlertCircle,
  Bold,
  Italic,
  Languages,
  Search,
  Globe,
  HelpCircle,
  Eye,
} from 'lucide-react';
import {
  ALL_LANGUAGES,
  COMMON_SUBTITLE_LANGUAGES,
  getLanguageByCode,
  Language,
} from '../utils/languages';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'series' | 'characters' | 'typography' | 'language';
  seriesList: Series[];
  currentSeriesId?: string;
  characters: Character[];
  defaultSettings: DefaultProjectSettings;
  lines: SubtitleLine[];
  currentLanguage?: string;
  onSelectLanguage?: (code: string) => void;
  onSelectSeries: (seriesId: string | undefined) => void;
  onSaveSeriesList: (seriesList: Series[]) => void;
  onSaveCharacters: (characters: Character[]) => void;
  onSaveDefaults: (defaults: DefaultProjectSettings) => void;
  onApplyStyleToLines?: (
    characterId: string,
    style: { font: string; size: number; bold: boolean; italic: boolean }
  ) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'series',
  seriesList,
  currentSeriesId,
  characters,
  defaultSettings,
  lines,
  currentLanguage,
  onSelectLanguage,
  onSelectSeries,
  onSaveSeriesList,
  onSaveCharacters,
  onSaveDefaults,
  onApplyStyleToLines,
}) => {
  const [activeTab, setActiveTab] = useState<'series' | 'characters' | 'typography' | 'language'>(initialTab);

  // Sync initial tab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // ================= SERIES STATE =================
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(
    currentSeriesId || seriesList[0]?.id || 'new'
  );
  const [seriesName, setSeriesName] = useState('');
  const [seriesDescription, setSeriesDescription] = useState('');
  const [seriesColor, setSeriesColor] = useState('#3b82f6');
  const [seriesFont, setSeriesFont] = useState('Inter');
  const [seriesSize, setSeriesSize] = useState(18);
  const [seriesBold, setSeriesBold] = useState(false);
  const [seriesItalic, setSeriesItalic] = useState(false);
  const [seriesCpsLimit, setSeriesCpsLimit] = useState(21);
  const [isEditingExistingSeries, setIsEditingExistingSeries] = useState(false);

  useEffect(() => {
    const existing = seriesList.find((s) => s.id === selectedSeriesId);
    if (existing) {
      setSeriesName(existing.name);
      setSeriesDescription(existing.description || '');
      setSeriesColor(existing.color);
      setSeriesFont(existing.defaultSettings.font);
      setSeriesSize(existing.defaultSettings.size);
      setSeriesBold(existing.defaultSettings.bold);
      setSeriesItalic(existing.defaultSettings.italic);
      setSeriesCpsLimit(existing.defaultSettings.cpsLimit || 21);
      setIsEditingExistingSeries(true);
    } else {
      setSeriesName('');
      setSeriesDescription('');
      setSeriesColor(CHARACTER_PALETTE[Math.floor(Math.random() * CHARACTER_PALETTE.length)]);
      setSeriesFont('Inter');
      setSeriesSize(18);
      setSeriesBold(false);
      setSeriesItalic(false);
      setSeriesCpsLimit(21);
      setIsEditingExistingSeries(false);
    }
  }, [selectedSeriesId, seriesList]);

  // ================= CHARACTERS STATE =================
  const [selectedCharId, setSelectedCharId] = useState<string>(characters[0]?.id || 'new');
  const [charName, setCharName] = useState('');
  const [charColor, setCharColor] = useState('#3b82f6');
  const [charFont, setCharFont] = useState('Inter');
  const [charSize, setCharSize] = useState(18);
  const [charBold, setCharBold] = useState(false);
  const [charItalic, setCharItalic] = useState(false);
  const [charDescription, setCharDescription] = useState('');
  const [isEditingExistingChar, setIsEditingExistingChar] = useState(false);
  const [applyToExistingLines, setApplyToExistingLines] = useState(true);

  useEffect(() => {
    const existing = characters.find((c) => c.id === selectedCharId);
    if (existing) {
      setCharName(existing.name);
      setCharColor(existing.color);
      setCharFont(existing.font);
      setCharSize(existing.size);
      setCharBold(existing.bold);
      setCharItalic(existing.italic);
      setCharDescription(existing.description || '');
      setIsEditingExistingChar(true);
    } else {
      setCharName('');
      setCharColor(CHARACTER_PALETTE[Math.floor(Math.random() * CHARACTER_PALETTE.length)]);
      setCharFont('Inter');
      setCharSize(18);
      setCharBold(false);
      setCharItalic(false);
      setCharDescription('');
      setIsEditingExistingChar(false);
    }
  }, [selectedCharId, characters]);

  // ================= PROJECT DEFAULTS STATE =================
  const [projFont, setProjFont] = useState(defaultSettings.font || 'Inter');
  const [projSize, setProjSize] = useState(defaultSettings.size || 18);
  const [projBold, setProjBold] = useState(defaultSettings.bold || false);
  const [projItalic, setProjItalic] = useState(defaultSettings.italic || false);
  const [projCpsLimit, setProjCpsLimit] = useState(defaultSettings.cpsLimit || 21);
  const [projMaxLineLength, setProjMaxLineLength] = useState(defaultSettings.maxLineLength || 42);
  const [projRememberScroll, setProjRememberScroll] = useState(
    defaultSettings.rememberCharacterListScroll !== undefined
      ? defaultSettings.rememberCharacterListScroll
      : true
  );
  const [projRewindSeconds, setProjRewindSeconds] = useState(defaultSettings.rewindSeconds ?? 10);
  const [projFastForwardSeconds, setProjFastForwardSeconds] = useState(defaultSettings.fastForwardSeconds ?? 10);

  // ================= LANGUAGE STATE =================
  const [selectedDefaultLang, setSelectedDefaultLang] = useState<string>(
    defaultSettings.defaultLanguage || currentLanguage || 'en'
  );
  const [langListDisplayMode, setLangListDisplayMode] = useState<LanguageListDisplayMode>(
    defaultSettings.languageListDisplay || 'native'
  );
  const [langSearch, setLangSearch] = useState('');
  const [demoHoveredLang, setDemoHoveredLang] = useState<string | null>(null);
  const [demoHeldLang, setDemoHeldLang] = useState<string | null>(null);
  const [isLangSaved, setIsLangSaved] = useState(false);
  const demoHoldTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setProjFont(defaultSettings.font || 'Inter');
    setProjSize(defaultSettings.size || 18);
    setProjBold(defaultSettings.bold || false);
    setProjItalic(defaultSettings.italic || false);
    setProjCpsLimit(defaultSettings.cpsLimit || 21);
    setProjMaxLineLength(defaultSettings.maxLineLength || 42);
    setProjRememberScroll(
      defaultSettings.rememberCharacterListScroll !== undefined
        ? defaultSettings.rememberCharacterListScroll
        : true
    );
    setProjRewindSeconds(defaultSettings.rewindSeconds ?? 10);
    setProjFastForwardSeconds(defaultSettings.fastForwardSeconds ?? 10);
    setSelectedDefaultLang(defaultSettings.defaultLanguage || currentLanguage || 'en');
    setLangListDisplayMode(defaultSettings.languageListDisplay || 'native');
  }, [defaultSettings, currentLanguage]);

  // Clean up demo timer on unmount
  useEffect(() => {
    return () => {
      if (demoHoldTimerRef.current) clearTimeout(demoHoldTimerRef.current);
    };
  }, []);

  const currentSelectedLangObj = useMemo(
    () => getLanguageByCode(selectedDefaultLang),
    [selectedDefaultLang]
  );

  const filteredModalLanguages = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return ALL_LANGUAGES;
    return ALL_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [langSearch]);

  if (!isOpen) return null;

  // ================= HANDLERS =================
  const countLinesForChar = (charId: string) => {
    return lines.filter((l) => l.characterId === charId).length;
  };

  const handleSaveSeries = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seriesName.trim()) return;

    const existingSeries = seriesList.find((s) => s.id === selectedSeriesId);
    const seriesData: Series = {
      id: isEditingExistingSeries ? selectedSeriesId : `series_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: seriesName.trim(),
      description: seriesDescription.trim(),
      color: seriesColor,
      defaultSettings: {
        font: seriesFont,
        size: seriesSize,
        bold: seriesBold,
        italic: seriesItalic,
        cpsLimit: seriesCpsLimit,
        maxLineLength: existingSeries?.defaultSettings?.maxLineLength || 42,
      },
      characters: existingSeries?.characters || characters,
      updatedAt: Date.now(),
    };

    let updatedList: Series[];
    if (isEditingExistingSeries) {
      updatedList = seriesList.map((s) => (s.id === seriesData.id ? seriesData : s));
    } else {
      updatedList = [...seriesList, seriesData];
      setSelectedSeriesId(seriesData.id);
    }

    onSaveSeriesList(updatedList);

    // If this series is the currently active one for this file, update current project defaults
    if (currentSeriesId === seriesData.id) {
      onSaveDefaults(seriesData.defaultSettings);
    }
  };

  const handleDeleteSeries = (id: string) => {
    const updated = seriesList.filter((s) => s.id !== id);
    onSaveSeriesList(updated);
    if (currentSeriesId === id) {
      onSelectSeries(undefined);
    }
    if (selectedSeriesId === id) {
      setSelectedSeriesId(updated[0]?.id || 'new');
    }
  };

  const handleSaveCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim()) return;

    const charData: Character = {
      id: isEditingExistingChar ? selectedCharId : `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: charName.trim().toUpperCase(),
      color: charColor,
      font: charFont,
      size: charSize,
      bold: charBold,
      italic: charItalic,
      description: charDescription.trim(),
    };

    let updatedList: Character[];
    if (isEditingExistingChar) {
      updatedList = characters.map((c) => (c.id === charData.id ? charData : c));
    } else {
      updatedList = [...characters, charData];
      setSelectedCharId(charData.id);
    }

    onSaveCharacters(updatedList);

    // If active series exists, also persist character into that series' character roster
    if (currentSeriesId) {
      const updatedSeriesList = seriesList.map((s) => {
        if (s.id === currentSeriesId) {
          return { ...s, characters: updatedList, updatedAt: Date.now() };
        }
        return s;
      });
      onSaveSeriesList(updatedSeriesList);
    }

    if (applyToExistingLines && onApplyStyleToLines) {
      onApplyStyleToLines(charData.id, {
        font: charData.font,
        size: charData.size,
        bold: charData.bold,
        italic: charData.italic,
      });
    }
  };

  const handleDeleteCharacter = (charId: string) => {
    const updated = characters.filter((c) => c.id !== charId);
    onSaveCharacters(updated);
    if (currentSeriesId) {
      const updatedSeriesList = seriesList.map((s) => {
        if (s.id === currentSeriesId) {
          return { ...s, characters: updated, updatedAt: Date.now() };
        }
        return s;
      });
      onSaveSeriesList(updatedSeriesList);
    }
    if (selectedCharId === charId) {
      setSelectedCharId(updated[0]?.id || 'new');
    }
  };

  const handleSaveProjectDefaults = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedDefaults: DefaultProjectSettings = {
      ...defaultSettings,
      font: projFont,
      size: projSize,
      bold: projBold,
      italic: projItalic,
      cpsLimit: projCpsLimit,
      maxLineLength: projMaxLineLength,
      rememberCharacterListScroll: projRememberScroll,
      defaultLanguage: selectedDefaultLang,
      languageListDisplay: langListDisplayMode,
      rewindSeconds: Math.max(1, Math.min(60, Number(projRewindSeconds) || 10)),
      fastForwardSeconds: Math.max(1, Math.min(60, Number(projFastForwardSeconds) || 10)),
    };
    onSaveDefaults(updatedDefaults);

    // If a series is active, also sync it to that series
    if (currentSeriesId) {
      const updatedSeriesList = seriesList.map((s) => {
        if (s.id === currentSeriesId) {
          return { ...s, defaultSettings: updatedDefaults, updatedAt: Date.now() };
        }
        return s;
      });
      onSaveSeriesList(updatedSeriesList);
    }
  };

  const handleSaveLanguage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updatedDefaults: DefaultProjectSettings = {
      ...defaultSettings,
      font: projFont,
      size: projSize,
      bold: projBold,
      italic: projItalic,
      cpsLimit: projCpsLimit,
      maxLineLength: projMaxLineLength,
      rememberCharacterListScroll: projRememberScroll,
      defaultLanguage: selectedDefaultLang,
      languageListDisplay: langListDisplayMode,
      rewindSeconds: Math.max(1, Math.min(60, Number(projRewindSeconds) || 10)),
      fastForwardSeconds: Math.max(1, Math.min(60, Number(projFastForwardSeconds) || 10)),
    };
    onSaveDefaults(updatedDefaults);
    if (onSelectLanguage) {
      onSelectLanguage(selectedDefaultLang);
    }
    setIsLangSaved(true);
    setTimeout(() => setIsLangSaved(false), 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md">
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans text-xs transition-colors"
        role="dialog"
        aria-modal="true"
      >
        {/* Header with Clean Tab Groupings */}
        <div className="h-11 px-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-[var(--text-main)] uppercase tracking-wider font-mono mr-2">
              Settings
            </span>

            {/* Navigation Tabs */}
            <div className="flex items-center bg-[var(--bg-app)] p-0.5 rounded-lg border border-[var(--border)]">
              {/* Tab 1: Series */}
              <button
                type="button"
                onClick={() => setActiveTab('series')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  activeTab === 'series'
                    ? 'bg-[var(--accent)] text-white shadow-xs font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Series</span>
                <span className="text-[10px] opacity-75 font-mono">({seriesList.length})</span>
              </button>

              {/* Tab 2: Characters */}
              <button
                type="button"
                onClick={() => setActiveTab('characters')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  activeTab === 'characters'
                    ? 'bg-[var(--accent)] text-white shadow-xs font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Characters</span>
                <span className="text-[10px] opacity-75 font-mono">({characters.length})</span>
              </button>

              {/* Tab 3: Typography & Defaults */}
              <button
                type="button"
                onClick={() => setActiveTab('typography')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  activeTab === 'typography'
                    ? 'bg-[var(--accent)] text-white shadow-xs font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Typography Defaults</span>
              </button>

              {/* Tab 4: Language */}
              <button
                type="button"
                onClick={() => setActiveTab('language')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  activeTab === 'language'
                    ? 'bg-[var(--accent)] text-white shadow-xs font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Languages className="w-3.5 h-3.5" />
                <span>Language</span>
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-1 rounded-md transition-colors cursor-pointer"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* ========================================================================= */}
          {/* TAB 1: SERIES GROUPING                                                    */}
          {/* ========================================================================= */}
          {activeTab === 'series' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left Column: Series List */}
              <div className="w-full md:w-60 border-r border-[var(--border)] bg-[var(--bg-app)] flex flex-col shrink-0">
                <div className="p-2 border-b border-[var(--border)] flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-[var(--text-muted)] font-semibold">
                    Series Library
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSeriesId('new')}
                    className="flex items-center gap-1 px-2 py-0.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded text-[10.5px] font-medium transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Series</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                  {seriesList.map((s) => {
                    const isSelected = selectedSeriesId === s.id;
                    const isCurrentForFile = currentSeriesId === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedSeriesId(s.id)}
                        className={`p-2 rounded-lg cursor-pointer transition-all border flex items-center justify-between group ${
                          isSelected
                            ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--text-main)] shadow-2xs'
                            : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: s.color }}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                              <span>{s.name}</span>
                              {isCurrentForFile && (
                                <span className="text-[8.5px] px-1 py-0.2 rounded font-mono font-bold bg-[var(--accent)] text-white shrink-0">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <div className="text-[9.5px] font-mono text-[var(--text-faint)] truncate">
                              {s.characters?.length || 0} chars · {s.defaultSettings?.font || 'Inter'}
                            </div>
                          </div>
                        </div>

                        {seriesList.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSeries(s.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-faint)] hover:text-rose-500 rounded transition-opacity cursor-pointer"
                            title="Delete Series"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Series Editor */}
              <form onSubmit={handleSaveSeries} className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                    <div>
                      <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                        <Tv className="w-4 h-4" style={{ color: seriesColor }} />
                        <span>{isEditingExistingSeries ? `Edit Series: ${seriesName}` : 'Create New Series'}</span>
                      </h3>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Series store consistent characters, fonts, and typography rules across all episodes.
                      </p>
                    </div>

                    {isEditingExistingSeries && (
                      <button
                        type="button"
                        onClick={() => onSelectSeries(selectedSeriesId)}
                        className={`px-2.5 py-1 rounded-md text-[10.5px] font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                          currentSeriesId === selectedSeriesId
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white'
                        }`}
                      >
                        {currentSeriesId === selectedSeriesId ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Active for This File</span>
                          </>
                        ) : (
                          <>
                            <Tv className="w-3 h-3" />
                            <span>Assign to This File</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                        Series Title / Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={seriesName}
                        onChange={(e) => setSeriesName(e.target.value)}
                        placeholder="e.g. Project Aurora, Cyberpunk 2099..."
                        className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-md text-xs text-[var(--text-main)] outline-hidden focus:border-[var(--accent)]"
                      />
                    </div>

                    <div>
                      <InlineColorWheel
                        color={seriesColor}
                        initialColor={seriesColor}
                        onChange={setSeriesColor}
                        title="Accent / Badge Color"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Description / Synopsis (Optional)
                    </label>
                    <input
                      type="text"
                      value={seriesDescription}
                      onChange={(e) => setSeriesDescription(e.target.value)}
                      placeholder="e.g. Space exploration sci-fi anime series..."
                      className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-md text-xs text-[var(--text-main)] outline-hidden focus:border-[var(--accent)]"
                    />
                  </div>

                  {/* Series Default Typography Rule */}
                  <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] space-y-2.5">
                    <div className="font-semibold text-xs text-[var(--text-main)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Series Default Typography Settings</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[9.5px] font-mono uppercase text-[var(--text-muted)] mb-1">
                          Font
                        </label>
                        <select
                          value={seriesFont}
                          onChange={(e) => setSeriesFont(e.target.value)}
                          className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] rounded text-xs text-[var(--text-main)] outline-hidden"
                        >
                          {COMMON_FONTS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-mono uppercase text-[var(--text-muted)] mb-1">
                          Size
                        </label>
                        <select
                          value={seriesSize}
                          onChange={(e) => setSeriesSize(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] rounded text-xs text-[var(--text-main)] outline-hidden"
                        >
                          {FONT_SIZES.map((s) => (
                            <option key={s} value={s}>
                              {s}px
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-mono uppercase text-[var(--text-muted)] mb-1">
                          Style
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSeriesBold(!seriesBold)}
                            className={`flex-1 py-1 rounded text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                              seriesBold
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border)]'
                            }`}
                            title="Bold"
                            aria-label="Bold"
                          >
                            <Bold className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSeriesItalic(!seriesItalic)}
                            className={`flex-1 py-1 rounded text-xs italic border transition-colors cursor-pointer flex items-center justify-center ${
                              seriesItalic
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border)]'
                            }`}
                            title="Italic"
                            aria-label="Italic"
                          >
                            <Italic className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-mono uppercase text-[var(--text-muted)] mb-1">
                          CPS Limit
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={40}
                          value={seriesCpsLimit}
                          onChange={(e) => setSeriesCpsLimit(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] rounded text-xs text-[var(--text-main)] outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)] mt-4">
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-md text-xs font-medium transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isEditingExistingSeries ? 'Save Series Changes' : 'Create Series'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CHARACTERS GROUPING (Moved to Settings)                           */}
          {/* ========================================================================= */}
          {activeTab === 'characters' && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left Column: Character Roster */}
              <div className="w-full md:w-60 border-r border-[var(--border)] bg-[var(--bg-app)] flex flex-col shrink-0">
                <div className="p-2 border-b border-[var(--border)] flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-[var(--text-muted)] font-semibold">
                    Characters Roster
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCharId('new')}
                    className="flex items-center gap-1 px-2 py-0.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded text-[10.5px] font-medium transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Character</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                  {characters.map((c) => {
                    const isSelected = selectedCharId === c.id;
                    const lineCount = countLinesForChar(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCharId(c.id)}
                        className={`p-2 rounded-lg cursor-pointer transition-all border flex items-center justify-between group ${
                          isSelected
                            ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--text-main)] shadow-2xs'
                            : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: c.color }}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-xs truncate">{c.name}</div>
                            <div className="text-[9.5px] font-mono text-[var(--text-faint)] truncate">
                              {lineCount} lines · {c.font}, {c.size}px
                            </div>
                          </div>
                        </div>

                        {characters.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCharacter(c.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-faint)] hover:text-rose-500 rounded transition-opacity cursor-pointer"
                            title="Delete Character"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Character Editor */}
              <form onSubmit={handleSaveCharacter} className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                    <div>
                      <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full inline-block"
                          style={{ backgroundColor: charColor }}
                        />
                        <span>{isEditingExistingChar ? `Edit Character: ${charName}` : 'Add New Character'}</span>
                      </h3>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Characters provide standardized badges, dedicated subtitle fonts, and styling consistency.
                      </p>
                    </div>

                    {isEditingExistingChar && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]">
                        Used in {countLinesForChar(selectedCharId)} lines
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                        Character Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={charName}
                        onChange={(e) => setCharName(e.target.value)}
                        placeholder="e.g. CAPTAIN VANCE, DR. THORNE..."
                        className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-md text-xs text-[var(--text-main)] outline-hidden focus:border-[var(--accent)] font-semibold"
                      />
                    </div>

                    <div>
                      <InlineColorWheel
                        color={charColor}
                        initialColor={charColor}
                        onChange={setCharColor}
                        title="Badge / Dialogue Color"
                      />
                    </div>
                  </div>

                  {/* Character Specific Typography */}
                  <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] space-y-2.5">
                    <div className="font-semibold text-xs text-[var(--text-main)]">
                      Dedicated Character Font & Typography
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[9.5px] font-mono uppercase text-[var(--text-muted)] mb-1">
                          Font
                        </label>
                        <select
                          value={charFont}
                          onChange={(e) => setCharFont(e.target.value)}
                          className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] rounded text-xs text-[var(--text-main)] outline-hidden"
                        >
                          {COMMON_FONTS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-mono uppercase text-[var(--text-muted)] mb-1">
                          Size
                        </label>
                        <select
                          value={charSize}
                          onChange={(e) => setCharSize(Number(e.target.value))}
                          className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] rounded text-xs text-[var(--text-main)] outline-hidden"
                        >
                          {FONT_SIZES.map((s) => (
                            <option key={s} value={s}>
                              {s}px
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9.5px] font-mono uppercase text-[var(--text-muted)] mb-1">
                          Style
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCharBold(!charBold)}
                            className={`flex-1 py-1 rounded text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                              charBold
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border)]'
                            }`}
                            title="Bold"
                            aria-label="Bold"
                          >
                            <Bold className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCharItalic(!charItalic)}
                            className={`flex-1 py-1 rounded text-xs italic border transition-colors cursor-pointer flex items-center justify-center ${
                              charItalic
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border)]'
                            }`}
                            title="Italic"
                            aria-label="Italic"
                          >
                            <Italic className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Role / Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={charDescription}
                      onChange={(e) => setCharDescription(e.target.value)}
                      placeholder="e.g. Lead Pilot / Commander, Ship AI..."
                      className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-md text-xs text-[var(--text-main)] outline-hidden focus:border-[var(--accent)]"
                    />
                  </div>

                  {isEditingExistingChar && (
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={applyToExistingLines}
                        onChange={(e) => setApplyToExistingLines(e.target.checked)}
                        className="rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
                      />
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Apply typography update to all existing subtitle lines spoken by this character
                      </span>
                    </label>
                  )}

                  {/* Character Selector UX Setting */}
                  <div className="pt-2 border-t border-[var(--border)]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={projRememberScroll}
                        onChange={(e) => setProjRememberScroll(e.target.checked)}
                        className="rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
                      />
                      <div>
                        <span className="text-[11px] font-medium text-[var(--text-main)] block">
                          Remember character list scroll position
                        </span>
                        <span className="text-[9.5px] text-[var(--text-faint)] block">
                          Preserves scroll position when reopening the character assignment menu.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)] mt-4">
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-md text-xs font-medium transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isEditingExistingChar ? 'Save Character' : 'Add Character'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: PROJECT DEFAULTS & TYPOGRAPHY                                     */}
          {/* ========================================================================= */}
          {activeTab === 'typography' && (
            <form onSubmit={handleSaveProjectDefaults} className="flex-1 overflow-y-auto p-5 flex flex-col justify-between">
              <div className="max-w-xl mx-auto w-full space-y-4">
                <div className="border-b border-[var(--border)] pb-2.5">
                  <h3 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[var(--accent)]" />
                    <span>Default Typography & Project Guardrails</span>
                  </h3>
                  <p className="text-[10.5px] text-[var(--text-muted)] mt-0.5">
                    These settings apply as fallbacks to any subtitle lines without explicit character or line overrides.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Default Project Font
                    </label>
                    <select
                      value={projFont}
                      onChange={(e) => setProjFont(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-md text-xs text-[var(--text-main)] outline-hidden focus:border-[var(--accent)]"
                    >
                      {COMMON_FONTS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Default Font Size
                    </label>
                    <select
                      value={projSize}
                      onChange={(e) => setProjSize(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-md text-xs text-[var(--text-main)] outline-hidden focus:border-[var(--accent)]"
                    >
                      {FONT_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}px
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Default Bold
                    </label>
                    <button
                      type="button"
                      onClick={() => setProjBold(!projBold)}
                      className={`w-full py-1.5 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                        projBold
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border)]'
                      }`}
                    >
                      Bold: {projBold ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Default Italic
                    </label>
                    <button
                      type="button"
                      onClick={() => setProjItalic(!projItalic)}
                      className={`w-full py-1.5 rounded-md text-xs italic border transition-colors cursor-pointer ${
                        projItalic
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border)]'
                      }`}
                    >
                      Italic: {projItalic ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      CPS Warning Limit (Chars/sec)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={40}
                      value={projCpsLimit}
                      onChange={(e) => setProjCpsLimit(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-md text-xs text-[var(--text-main)] outline-hidden focus:border-[var(--accent)]"
                    />
                    <span className="text-[9.5px] text-[var(--text-faint)]">Standard broadcast is 17-21 CPS.</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Suggested Line Length (Chars)
                    </label>
                    <input
                      type="number"
                      min={20}
                      max={80}
                      value={projMaxLineLength}
                      onChange={(e) => setProjMaxLineLength(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-md text-xs text-[var(--text-main)] outline-hidden focus:border-[var(--accent)]"
                    />
                    <span className="text-[9.5px] text-[var(--text-faint)]">Standard cinema is 37-42 chars.</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border)]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={projRememberScroll}
                      onChange={(e) => setProjRememberScroll(e.target.checked)}
                      className="rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
                    />
                    <div>
                      <span className="text-[11px] font-medium text-[var(--text-main)] block">
                        Remember character menu scroll position
                      </span>
                      <span className="text-[9.5px] text-[var(--text-faint)] block">
                        Maintains the scroll state inside the quick character assign popover between opens.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="pt-2 border-t border-[var(--border)]">
                  <div className="text-[11px] font-bold text-[var(--text-main)] mb-2 flex items-center gap-1.5">
                    <span>Video Playback Skip Controls</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                        Rewind Skip (Seconds)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={projRewindSeconds}
                        onChange={(e) => setProjRewindSeconds(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-md text-xs text-[var(--text-main)] outline-hidden focus:border-[var(--accent)]"
                      />
                      <span className="text-[9.5px] text-[var(--text-faint)]">Default is 10 seconds.</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                        Fast-Forward Skip (Seconds)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={projFastForwardSeconds}
                        onChange={(e) => setProjFastForwardSeconds(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-md text-xs text-[var(--text-main)] outline-hidden focus:border-[var(--accent)]"
                      />
                      <span className="text-[9.5px] text-[var(--text-faint)]">Default is 10 seconds.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)] mt-4">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-md text-xs font-medium transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Typography Defaults</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: LANGUAGE SETTINGS                                                  */}
          {/* ========================================================================= */}
          {activeTab === 'language' && (
            <form onSubmit={handleSaveLanguage} className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
              <div className="space-y-4 max-w-2xl">
                {/* Section 1: Dropdown List Display Mode */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Language List Display Mode</span>
                    </label>
                    <span className="text-[10px] font-mono text-[var(--text-faint)]">
                      Top-Bar Dropdown Preference
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mb-2.5 leading-relaxed">
                    Determines how languages are rendered inside the top-bar Language dropdown, and controls what is temporarily revealed when hovering or clicking-and-holding.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Option 1: Native Language (Default) */}
                    <div
                      onClick={() => setLangListDisplayMode('native')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        langListDisplayMode === 'native'
                          ? 'bg-[var(--accent-subtle)] border-[var(--accent)] ring-1 ring-[var(--accent)] shadow-2xs'
                          : 'bg-[var(--bg-app)] border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full border-2 border-[var(--accent)] flex items-center justify-center">
                            {langListDisplayMode === 'native' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                            )}
                          </span>
                          <span className="font-semibold text-xs text-[var(--text-main)]">
                            Respective Native Language
                          </span>
                        </div>
                        <span className="text-[8.5px] font-mono uppercase px-1 py-0.2 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)]">
                          Default
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[var(--text-muted)] pl-4.5 mt-0.5 leading-normal">
                        Listed in authentic native script (e.g. <strong>日本語</strong>, <strong>Español</strong>, <strong>Français</strong>).
                      </p>
                      <div className="mt-2 pl-4.5 pt-1.5 border-t border-[var(--border-light)] text-[9.5px] text-[var(--text-faint)] font-mono flex items-center gap-1">
                        <Eye className="w-3 h-3 text-[var(--accent)]" />
                        <span>Hover / Hold reveals: <strong>English name</strong></span>
                      </div>
                    </div>

                    {/* Option 2: App Language (English) */}
                    <div
                      onClick={() => setLangListDisplayMode('app')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        langListDisplayMode === 'app'
                          ? 'bg-[var(--accent-subtle)] border-[var(--accent)] ring-1 ring-[var(--accent)] shadow-2xs'
                          : 'bg-[var(--bg-app)] border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full border-2 border-[var(--accent)] flex items-center justify-center">
                            {langListDisplayMode === 'app' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                            )}
                          </span>
                          <span className="font-semibold text-xs text-[var(--text-main)]">
                            App Language (English)
                          </span>
                        </div>
                      </div>
                      <p className="text-[10.5px] text-[var(--text-muted)] pl-4.5 mt-0.5 leading-normal">
                        Listed in English (e.g. <strong>Japanese</strong>, <strong>Spanish</strong>, <strong>French</strong>).
                      </p>
                      <div className="mt-2 pl-4.5 pt-1.5 border-t border-[var(--border-light)] text-[9.5px] text-[var(--text-faint)] font-mono flex items-center gap-1">
                        <Eye className="w-3 h-3 text-[var(--accent)]" />
                        <span>Hover / Hold reveals: <strong>Native script</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Peek Demo Card */}
                  <div className="mt-3 p-2.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] font-semibold flex items-center gap-1">
                        <Eye className="w-3 h-3 text-[var(--accent)]" />
                        <span>Interactive Peek Tester (Hover or Press & Hold below)</span>
                      </span>
                      <span className="text-[9.5px] text-[var(--text-faint)]">
                        Hold & release does not trigger selection
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { code: 'ja', name: 'Japanese', nativeName: '日本語' },
                        { code: 'es', name: 'Spanish', nativeName: 'Español' },
                        { code: 'fr', name: 'French', nativeName: 'Français' },
                        { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
                        { code: 'de', name: 'German', nativeName: 'Deutsch' },
                      ].map((item) => {
                        const isPeeking = demoHoveredLang === item.code || demoHeldLang === item.code;
                        const mainName = langListDisplayMode === 'native' ? item.nativeName : item.name;
                        const altName = langListDisplayMode === 'native' ? item.name : item.nativeName;
                        const displayText = isPeeking ? altName : mainName;

                        return (
                          <div
                            key={item.code}
                            onMouseEnter={() => setDemoHoveredLang(item.code)}
                            onMouseLeave={() => {
                              setDemoHoveredLang(null);
                              setDemoHeldLang(null);
                            }}
                            onPointerDown={() => {
                              setDemoHeldLang(item.code);
                              if (demoHoldTimerRef.current) clearTimeout(demoHoldTimerRef.current);
                            }}
                            onPointerUp={() => setDemoHeldLang(null)}
                            onPointerCancel={() => setDemoHeldLang(null)}
                            className={`px-2.5 py-1 rounded-md border text-[11px] font-sans select-none cursor-pointer transition-all flex items-center gap-1.5 ${
                              isPeeking
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-2xs scale-102 font-medium'
                                : 'bg-[var(--bg-surface)] text-[var(--text-main)] border-[var(--border)] hover:border-[var(--accent)]'
                            }`}
                            title="Hover or press & hold to peek alternate name"
                          >
                            <span className="font-mono text-[9px] opacity-75 uppercase">{item.code}</span>
                            <span>{displayText}</span>
                            {isPeeking && (
                              <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-black/20 text-white/90">
                                {langListDisplayMode === 'native' ? 'EN' : 'NATIVE'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Section 2: Default Subtitle Language Picker */}
                <div className="pt-3 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Default Subtitle Language</span>
                    </label>
                    <span className="text-[10.5px] font-mono text-[var(--accent)] font-semibold">
                      Selected: {currentSelectedLangObj.name} ({currentSelectedLangObj.nativeName})
                    </span>
                  </div>

                  <p className="text-[11px] text-[var(--text-muted)] mb-2.5 leading-relaxed">
                    Set the primary language assigned to new projects and export files. Default is English.
                  </p>

                  {/* Popular Language Quick Pick Chips */}
                  <div className="mb-2.5">
                    <span className="text-[9.5px] font-mono uppercase text-[var(--text-faint)] block mb-1">
                      Common Subtitle Languages:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {COMMON_SUBTITLE_LANGUAGES.slice(0, 10).map((l) => {
                        const isSelected = selectedDefaultLang.toLowerCase() === l.code.toLowerCase();
                        return (
                          <button
                            key={l.code}
                            type="button"
                            onClick={() => setSelectedDefaultLang(l.code)}
                            className={`px-2 py-0.5 rounded text-[10.5px] transition-all cursor-pointer font-sans flex items-center gap-1 border ${
                              isSelected
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-semibold shadow-2xs'
                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-main)] hover:border-[var(--border-hover)]'
                            }`}
                          >
                            <span>{langListDisplayMode === 'native' ? l.nativeName : l.name}</span>
                            <span className="text-[8.5px] font-mono opacity-70">({l.code.toUpperCase()})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Search and Full Languages List */}
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-app)] p-2">
                    <div className="relative flex items-center mb-1.5">
                      <Search className="w-3 h-3 text-[var(--text-faint)] absolute left-2 pointer-events-none" />
                      <input
                        type="text"
                        value={langSearch}
                        onChange={(e) => setLangSearch(e.target.value)}
                        placeholder="Search all 120+ languages by name, native script, or code (e.g. Japanese, 日本語, ja)..."
                        className="w-full pl-6.5 pr-2 py-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md text-[11px] text-[var(--text-main)] placeholder:text-[var(--text-faint)] outline-hidden focus:border-[var(--accent)]"
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-0.5 scrollbar-thin pr-1">
                      {filteredModalLanguages.map((l) => {
                        const isSelected = selectedDefaultLang.toLowerCase() === l.code.toLowerCase();
                        const primary = langListDisplayMode === 'native' ? l.nativeName : l.name;
                        const secondary = langListDisplayMode === 'native' ? l.name : l.nativeName;

                        return (
                          <div
                            key={l.code}
                            onClick={() => setSelectedDefaultLang(l.code)}
                            className={`px-2 py-1 rounded-md cursor-pointer transition-all flex items-center justify-between text-xs ${
                              isSelected
                                ? 'bg-[var(--accent-subtle)] text-[var(--text-main)] font-semibold ring-1 ring-[var(--accent)]'
                                : 'hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-6 h-4.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[8.5px] font-mono uppercase text-[var(--text-muted)] flex items-center justify-center shrink-0">
                                {l.code}
                              </span>
                              <span className="text-[11px] text-[var(--text-main)] font-medium truncate">
                                {primary}
                              </span>
                              <span className="text-[10px] text-[var(--text-faint)] truncate">
                                · {secondary}
                              </span>
                            </div>

                            {isSelected && <Check className="w-3 h-3 text-[var(--accent)] shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] mt-4">
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                  {isLangSaved ? (
                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Language settings saved successfully!</span>
                    </span>
                  ) : (
                    <span>Changes take effect immediately across all subtitle tools.</span>
                  )}
                </div>

                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-md text-xs font-medium transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Language Settings</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
