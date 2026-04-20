export interface Country {
  code: string;
  name: string;
  lang: string;
  subreddit: string;
  flag_emoji: string;
}

export interface TopWordEntry {
  word: string;
  trend_score: number;
  frequency: number;
}

export interface DailyTopWord {
  country_code: string;
  stat_date: string;
  top_word: string;
  top_10_words: TopWordEntry[];
  sources_count: number;
}

export interface DailyWordStat {
  country_code: string;
  stat_date: string;
  word: string;
  frequency: number;
  trend_score: number;
}

export interface CountryWithData {
  country: Country;
  today: DailyTopWord | null;
}

export interface HistoryEntry {
  stat_date: string;
  word: string;
  frequency: number;
  trend_score: number;
}

export type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  countryCode: string;
  countryName: string;
  topWord: string;
};
