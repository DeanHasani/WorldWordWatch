import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { DailyTopWord, HistoryEntry } from '../lib/types';

export function useCountryData(countryCode: string | null) {
  const [topWord, setTopWord] = useState<DailyTopWord | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!countryCode) {
      setTopWord(null);
      setHistory([]);
      return;
    }

    async function fetchCountryData() {
      setLoading(true);
      setError(null);
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: topData, error: topError } = await supabase
          .from('daily_top_word')
          .select('*')
          .eq('country_code', countryCode)
          .order('stat_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (topError) throw topError;
        setTopWord(topData as DailyTopWord | null);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        const topWordName = topData?.top_word;
        if (topWordName) {
          const { data: histData, error: histError } = await supabase
            .from('daily_word_stats')
            .select('stat_date, word, frequency, trend_score')
            .eq('country_code', countryCode)
            .eq('word', topWordName)
            .gte('stat_date', sevenDaysAgoStr)
            .lte('stat_date', today)
            .order('stat_date', { ascending: true });

          if (histError) throw histError;
          setHistory((histData ?? []) as HistoryEntry[]);
        } else {
          setHistory([]);
        }
      } catch (err) {
        console.error('useCountryData error', err);
        const message =
          err instanceof Error
            ? err.message
            : err && typeof err === 'object' && 'message' in err
            ? (err as { message: string }).message
            : JSON.stringify(err);
        setError(message || 'Failed to load country data');
      } finally {
        setLoading(false);
      }
    }

    fetchCountryData();
  }, [countryCode]);

  return { topWord, history, loading, error };
}
