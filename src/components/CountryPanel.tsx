import { X, TrendingUp, BarChart2, Loader2, AlertCircle } from 'lucide-react';
import { useCountryData } from '../hooks/useCountryData';
import WordChart from './WordChart';
import type { Country } from '../lib/types';

interface Props {
  country: Country | null;
  onClose: () => void;
}

export default function CountryPanel({ country, onClose }: Props) {
  const { topWord, history, loading, error } = useCountryData(country?.code ?? null);

  if (!country) return null;

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

            {topWord.top_10_words && topWord.top_10_words.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 size={14} className="text-sky-500" />
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-widest">
                    Top 10 Words
                  </span>
                </div>
                <div className="space-y-2">
                  {topWord.top_10_words.slice(0, 10).map((entry, idx) => {
                    const maxScore = topWord.top_10_words[0]?.trend_score ?? 1;
                    const pct = maxScore > 0 ? (entry.trend_score / maxScore) * 100 : 0;
                    return (
                      <div key={entry.word} className="flex items-center gap-3">
                        <span className="text-gray-600 text-xs w-4 text-right shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-gray-200 text-sm font-medium truncate">
                              {entry.word}
                            </span>
                            <span className="text-gray-500 text-xs shrink-0 ml-2">
                              {entry.frequency}×
                            </span>
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
