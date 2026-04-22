import { X, TrendingUp, BarChart2, Loader2, AlertCircle, Languages, CheckCircle2 } from 'lucide-react';
import { useCountryData } from '../hooks/useCountryData';
import WordChart from './WordChart';
import type { Country } from '../lib/types';
import { useState, useCallback } from 'react';

interface Props {
  country: Country | null;
  onClose: () => void;
}

// Google Translate unofficial endpoint — works from browser, no API key needed
async function translateText(word: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(word)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Translation request failed');
  const data = await res.json();
  // Response shape: [ [ ["translated", "original", ...], ... ], ..., "detected-lang" ]
  const translated: string = data?.[0]?.map((chunk: string[]) => chunk?.[0] ?? '').join('') ?? '';
  if (!translated) throw new Error('Empty translation');
  return translated;
}

// Translate multiple words — fire in parallel using the same endpoint
async function translateMany(words: string[]): Promise<Record<string, string>> {
  const results = await Promise.allSettled(
    words.map(async (w) => {
      const t = await translateText(w);
      return [w, t] as const;
    })
  );
  const map: Record<string, string> = {};
  results.forEach((r, i) => {
    map[words[i]] = r.status === 'fulfilled' ? r.value[1] : words[i];
  });
  return map;
}

// ─── Translate button + inline result ───────────────────────────────────────
function TranslateWord({ word }: { word: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<string | null>(null);

  const handleTranslate = useCallback(async () => {
    if (state === 'loading' || state === 'done') return;
    setState('loading');
    try {
      const translated = await translateText(word);
      setResult(translated.trim().toLowerCase() === word.trim().toLowerCase() ? '(already English)' : translated);
      setState('done');
    } catch {
      setState('error');
    }
  }, [word, state]);

  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      {state === 'idle' && (
        <button
          onClick={handleTranslate}
          title="Translate to English"
          className="text-gray-600 hover:text-cyan-400 border border-gray-600 hover:border-cyan-400 hover:bg-cyan-400/10 rounded p-0.5 transition-all duration-150"
        >
          <Languages size={13} />
        </button>
      )}
      {state === 'loading' && <Loader2 size={13} className="text-cyan-500 animate-spin" />}
      {state === 'done' && result && (
        <span className="flex items-center gap-1">
          <CheckCircle2 size={12} className="text-cyan-500 shrink-0" />
          <span className="text-cyan-300 text-xs font-medium">{result}</span>
        </span>
      )}
      {state === 'error' && (
        <span className="text-red-400 text-xs">failed</span>
      )}
    </span>
  );
}

// ─── Translate all top words at once ─────────────────────────────────────────
interface TranslateAllProps {
  words: string[];
  onTranslations: (map: Record<string, string>) => void;
}

function TranslateAllButton({ words, onTranslations }: TranslateAllProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const handleAll = useCallback(async () => {
    if (state !== 'idle') return;
    setState('loading');
    try {
      const map = await translateMany(words);
      onTranslations(map);
      setState('done');
    } catch {
      setState('error');
    }
  }, [words, onTranslations, state]);

  if (state === 'done') return null;

  return (
    <button
      onClick={handleAll}
      disabled={state === 'loading'}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-cyan-400 border border-gray-700 hover:border-cyan-400 hover:bg-cyan-400/10 rounded px-2 py-0.5 disabled:opacity-50 transition-all duration-150"
    >
      {state === 'loading' ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Languages size={12} />
      )}
      {state === 'loading' ? 'Translating…' : 'Translate all'}
    </button>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────
export default function CountryPanel({ country, onClose }: Props) {
  const { topWord, history, loading, error } = useCountryData(country?.code ?? null);
  // bulk translations map: word → english
  const [translations, setTranslations] = useState<Record<string, string>>({});

  if (!country) return null;

  const wordList = topWord?.top_10_words?.map((e) => e.word) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{country.flag_emoji}</span>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">{country.name}</h2>
            <p className="text-gray-500 text-xs uppercase tracking-widest">{country.code}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label="Close panel"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={28} className="text-cyan-500 animate-spin" />
            <p className="text-gray-500 text-sm">Loading data...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/40 border border-red-900/40 text-red-400 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && !topWord && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <BarChart2 size={32} className="text-gray-700" />
            <p className="text-gray-500 text-sm">No data available yet</p>
            <p className="text-gray-600 text-xs max-w-[200px]">
              The pipeline runs daily. Check back tomorrow for trending words.
            </p>
          </div>
        )}

        {!loading && !error && topWord && (
          <>
            {/* ── Today's top word ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-cyan-500" />
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-widest">
                  Today&apos;s Trending Word
                </span>
              </div>
              <div className="bg-gradient-to-br from-cyan-950/60 to-sky-950/40 border border-cyan-900/40 rounded-xl p-5 text-center">
                <p className="text-5xl font-black text-white tracking-tight break-all leading-tight">
                  {topWord.top_word}
                </p>

                {/* Translation for the hero word */}
                <div className="mt-3 flex justify-center">
                  <TranslateWord word={topWord.top_word} />
                </div>

                {topWord.top_10_words?.[0]?.trend_score > 0 && (
                  <p className="text-cyan-400 text-sm mt-2 font-medium">
                    {topWord.top_10_words[0].trend_score.toFixed(1)}× trend score
                  </p>
                )}
                {topWord.sources_count > 0 && (
                  <p className="text-gray-600 text-xs mt-1">
                    from {topWord.sources_count} sources
                  </p>
                )}
              </div>
            </div>

            {/* ── Top 10 words ── */}
            {topWord.top_10_words && topWord.top_10_words.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart2 size={14} className="text-sky-500" />
                    <span className="text-gray-400 text-xs font-semibold uppercase tracking-widest">
                      Top 10 Words
                    </span>
                  </div>
                  {/* Translate all button — resets when country changes */}
                  <TranslateAllButton
                    key={country.code}
                    words={wordList}
                    onTranslations={setTranslations}
                  />
                </div>

                <div className="space-y-2">
                  {topWord.top_10_words.slice(0, 10).map((entry, idx) => {
                    const maxScore = topWord.top_10_words[0]?.trend_score ?? 1;
                    const pct = maxScore > 0 ? (entry.trend_score / maxScore) * 100 : 0;
                    const englishLabel = translations[entry.word];
                    const showTranslation = englishLabel && englishLabel !== entry.word;

                    return (
                      <div key={entry.word} className="flex items-center gap-3">
                        <span className="text-gray-600 text-xs w-4 text-right shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5 gap-2">
                            <div className="min-w-0">
                              <span className="text-gray-200 text-sm font-medium truncate block">
                                {entry.word}
                              </span>
                              {showTranslation && (
                                <span className="text-cyan-400 text-xs leading-tight block truncate">
                                  {englishLabel}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-gray-500 text-xs">
                                {entry.frequency}×
                              </span>
                              {/* Per-word translate icon (only shown when bulk not done) */}
                              {!translations[entry.word] && Object.keys(translations).length === 0 && (
                                <TranslateWord word={entry.word} />
                              )}
                            </div>
                          </div>
                          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-sky-600 to-cyan-400 rounded-full"
                              style={{ width: `${pct}%`, transition: 'width 0.5s ease' }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 7-day history ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={14} className="text-sky-500" />
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-widest">
                  7-Day History
                </span>
              </div>
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                <WordChart history={history} word={topWord.top_word} />
              </div>
            </div>

            <div className="pt-1 pb-2">
              <p className="text-gray-700 text-xs text-center">
                Data from {new Date(topWord.stat_date + 'T00:00:00').toLocaleDateString('en', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}