/*
  # Add Albania

  Adds Albania (AL) to the countries table so the daily pipeline
  starts collecting Albanian trending words.
  - Google News edition: sq (Albanian)
  - Subreddit: r/albania
*/

INSERT INTO countries (code, name, lang, subreddit, flag_emoji) VALUES
  ('AL', 'Albania', 'sq', 'albania', '🇦🇱')
ON CONFLICT (code) DO NOTHING;
