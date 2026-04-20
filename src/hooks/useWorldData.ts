import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { DailyTopWord } from '../lib/types';

export function useWorldData() {
  const [data, setData] = useState<Record<string, DailyTopWord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: rows, error: dbError } = await supabase
          .from('daily_top_word')
          .select('*')
          .eq('stat_date', today);

        if (dbError) throw dbError;

        if (!rows || rows.length === 0) {
          const { data: latestRows, error: latestError } = await supabase
            .from('daily_top_word')
            .select('*')
            .order('stat_date', { ascending: false })
            .limit(60);

          if (latestError) throw latestError;

          const map: Record<string, DailyTopWord> = {};
          for (const row of latestRows ?? []) {
            if (!map[row.country_code]) {
              map[row.country_code] = row as DailyTopWord;
            }
          }
          setData(map);
          const dates = Object.values(map).map((r) => r.stat_date);
          if (dates.length > 0) setLastUpdated(dates[0]);
        } else {
          const map: Record<string, DailyTopWord> = {};
          for (const row of rows) {
            map[row.country_code] = row as DailyTopWord;
          }
          setData(map);
          setLastUpdated(today);
        }
      } catch (err) {
        console.error('useWorldData error', err);
        const message =
          err instanceof Error
            ? err.message
            : err && typeof err === 'object' && 'message' in err
            ? (err as { message: string }).message
            : JSON.stringify(err);
        setError(message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error, lastUpdated };
}
