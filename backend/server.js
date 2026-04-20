import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3001;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_JWT
);

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET'],
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString().split('T')[0] });
});

app.get('/api/top-words', async (_req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('daily_top_word')
      .select('country_code, top_word, top_10_words, stat_date, sources_count')
      .eq('stat_date', today);

    if (error) throw error;

    if (!data || data.length === 0) {
      const { data: latest, error: latestErr } = await supabase
        .from('daily_top_word')
        .select('country_code, top_word, top_10_words, stat_date, sources_count')
        .order('stat_date', { ascending: false })
        .limit(60);

      if (latestErr) throw latestErr;

      const seen = new Set();
      const deduped = (latest ?? []).filter((r) => {
        if (seen.has(r.country_code)) return false;
        seen.add(r.country_code);
        return true;
      });
      return res.json({ data: deduped, date: deduped[0]?.stat_date ?? null });
    }

    res.json({ data, date: today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/country/:code', async (req, res) => {
  const { code } = req.params;
  const upperCode = code.toUpperCase();

  try {
    const { data: country, error: countryErr } = await supabase
      .from('countries')
      .select('*')
      .eq('code', upperCode)
      .maybeSingle();

    if (countryErr) throw countryErr;
    if (!country) return res.status(404).json({ error: 'Country not found' });

    const { data: topWordData, error: topErr } = await supabase
      .from('daily_top_word')
      .select('*')
      .eq('country_code', upperCode)
      .order('stat_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (topErr) throw topErr;

    let history = [];
    if (topWordData?.top_word) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fromDate = sevenDaysAgo.toISOString().split('T')[0];

      const { data: histData, error: histErr } = await supabase
        .from('daily_word_stats')
        .select('stat_date, word, frequency, trend_score')
        .eq('country_code', upperCode)
        .eq('word', topWordData.top_word)
        .gte('stat_date', fromDate)
        .order('stat_date', { ascending: true });

      if (histErr) throw histErr;
      history = histData ?? [];
    }

    res.json({
      country,
      today: topWordData,
      history,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (_req, res) => {
  try {
    const { count: countriesCount } = await supabase
      .from('countries')
      .select('*', { count: 'exact', head: true });

    const today = new Date().toISOString().split('T')[0];
    const { count: todayCount } = await supabase
      .from('daily_top_word')
      .select('*', { count: 'exact', head: true })
      .eq('stat_date', today);

    const { data: latestDate } = await supabase
      .from('daily_top_word')
      .select('stat_date')
      .order('stat_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({
      total_countries: countriesCount ?? 0,
      countries_today: todayCount ?? 0,
      latest_date: latestDate?.stat_date ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`World Word Watch API running on port ${PORT}`);
});
