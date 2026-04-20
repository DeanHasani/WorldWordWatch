/*
  # World Word Watch - Initial Schema

  ## Overview
  Creates the core tables for storing trending word data per country.

  ## Tables

  ### 1. countries
  - Stores all supported countries with their metadata
  - `code`: ISO 3166-1 alpha-2 country code (primary key)
  - `name`: Human-readable country name
  - `lang`: BCP 47 language code used for Google News RSS
  - `subreddit`: Primary subreddit for data collection
  - `flag_emoji`: Country flag emoji for display

  ### 2. daily_word_stats
  - Stores word frequency statistics per country per day
  - `country_code`: References countries table
  - `stat_date`: The date this stat was recorded
  - `word`: The word being tracked
  - `frequency`: How many times the word appeared that day
  - `trend_score`: freq_today / avg_freq_last_7_days (higher = more trending)

  ### 3. daily_top_word
  - Stores the single top trending word and top 10 list per country per day
  - `country_code`: References countries table
  - `stat_date`: The date
  - `top_word`: The single highest trending word
  - `top_10_words`: JSONB array of top 10 words with scores

  ## Security
  - RLS enabled on all tables
  - Public read access for authenticated and anonymous users (display data)
  - Write access restricted to service role only (pipeline inserts)

  ## Indexes
  - Composite indexes on (country_code, stat_date) for fast lookups
  - Index on stat_date for range queries
*/

CREATE TABLE IF NOT EXISTS countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  subreddit text NOT NULL,
  flag_emoji text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_word_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  stat_date date NOT NULL DEFAULT CURRENT_DATE,
  word text NOT NULL,
  frequency integer NOT NULL DEFAULT 0,
  trend_score numeric(10, 4) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(country_code, stat_date, word)
);

CREATE TABLE IF NOT EXISTS daily_top_word (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  stat_date date NOT NULL DEFAULT CURRENT_DATE,
  top_word text NOT NULL DEFAULT '',
  top_10_words jsonb NOT NULL DEFAULT '[]',
  sources_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(country_code, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_word_stats_country_date ON daily_word_stats(country_code, stat_date);
CREATE INDEX IF NOT EXISTS idx_daily_word_stats_date ON daily_word_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_daily_word_stats_trend ON daily_word_stats(country_code, stat_date, trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_daily_top_word_country_date ON daily_top_word(country_code, stat_date);
CREATE INDEX IF NOT EXISTS idx_daily_top_word_date ON daily_top_word(stat_date);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_word_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_top_word ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Countries are publicly readable"
  ON countries FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Daily word stats are publicly readable"
  ON daily_word_stats FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Daily top words are publicly readable"
  ON daily_top_word FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO countries (code, name, lang, subreddit, flag_emoji) VALUES
  ('US', 'United States', 'en', 'unitedstates', '🇺🇸'),
  ('GB', 'United Kingdom', 'en', 'unitedkingdom', '🇬🇧'),
  ('CA', 'Canada', 'en', 'canada', '🇨🇦'),
  ('AU', 'Australia', 'en', 'australia', '🇦🇺'),
  ('DE', 'Germany', 'de', 'germany', '🇩🇪'),
  ('FR', 'France', 'fr', 'france', '🇫🇷'),
  ('IT', 'Italy', 'it', 'italy', '🇮🇹'),
  ('ES', 'Spain', 'es', 'spain', '🇪🇸'),
  ('BR', 'Brazil', 'pt', 'brazil', '🇧🇷'),
  ('MX', 'Mexico', 'es', 'mexico', '🇲🇽'),
  ('JP', 'Japan', 'ja', 'japan', '🇯🇵'),
  ('KR', 'South Korea', 'ko', 'korea', '🇰🇷'),
  ('CN', 'China', 'zh', 'china', '🇨🇳'),
  ('IN', 'India', 'en', 'india', '🇮🇳'),
  ('RU', 'Russia', 'ru', 'russia', '🇷🇺'),
  ('PL', 'Poland', 'pl', 'poland', '🇵🇱'),
  ('NL', 'Netherlands', 'nl', 'netherlands', '🇳🇱'),
  ('SE', 'Sweden', 'sv', 'sweden', '🇸🇪'),
  ('NO', 'Norway', 'no', 'norway', '🇳🇴'),
  ('CH', 'Switzerland', 'de', 'switzerland', '🇨🇭'),
  ('AR', 'Argentina', 'es', 'argentina', '🇦🇷'),
  ('ZA', 'South Africa', 'en', 'southafrica', '🇿🇦'),
  ('NG', 'Nigeria', 'en', 'nigeria', '🇳🇬'),
  ('EG', 'Egypt', 'ar', 'egypt', '🇪🇬'),
  ('TR', 'Turkey', 'tr', 'turkey', '🇹🇷'),
  ('PK', 'Pakistan', 'en', 'pakistan', '🇵🇰'),
  ('ID', 'Indonesia', 'id', 'indonesia', '🇮🇩'),
  ('PH', 'Philippines', 'en', 'philippines', '🇵🇭'),
  ('MY', 'Malaysia', 'en', 'malaysia', '🇲🇾'),
  ('TH', 'Thailand', 'th', 'thailand', '🇹🇭'),
  ('PT', 'Portugal', 'pt', 'portugal', '🇵🇹'),
  ('AT', 'Austria', 'de', 'austria', '🇦🇹'),
  ('BE', 'Belgium', 'fr', 'belgium', '🇧🇪'),
  ('DK', 'Denmark', 'da', 'denmark', '🇩🇰'),
  ('FI', 'Finland', 'fi', 'finland', '🇫🇮'),
  ('GR', 'Greece', 'el', 'greece', '🇬🇷'),
  ('CZ', 'Czech Republic', 'cs', 'czech', '🇨🇿'),
  ('HU', 'Hungary', 'hu', 'hungary', '🇭🇺'),
  ('RO', 'Romania', 'ro', 'romania', '🇷🇴'),
  ('UA', 'Ukraine', 'uk', 'ukraine', '🇺🇦'),
  ('NZ', 'New Zealand', 'en', 'newzealand', '🇳🇿'),
  ('SG', 'Singapore', 'en', 'singapore', '🇸🇬'),
  ('IL', 'Israel', 'he', 'israel', '🇮🇱'),
  ('SA', 'Saudi Arabia', 'ar', 'saudiarabia', '🇸🇦'),
  ('AE', 'UAE', 'ar', 'dubai', '🇦🇪'),
  ('CO', 'Colombia', 'es', 'colombia', '🇨🇴'),
  ('CL', 'Chile', 'es', 'chile', '🇨🇱'),
  ('PE', 'Peru', 'es', 'peru', '🇵🇪'),
  ('VN', 'Vietnam', 'vi', 'vietnam', '🇻🇳'),
  ('BD', 'Bangladesh', 'bn', 'bangladesh', '🇧🇩')
ON CONFLICT (code) DO NOTHING;
