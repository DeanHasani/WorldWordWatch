"""
World Word Watch - Daily Data Pipeline
Fetches headlines from Google News RSS and Reddit, computes trending words per country.
"""

import os
import re
import time
import logging
from datetime import date, datetime, timedelta, timezone
from collections import Counter, defaultdict

import feedparser
import requests
import nltk
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_JWT = os.environ.get("SUPABASE_SERVICE_ROLE_JWT")

REDDIT_USER_AGENT = "WorldWordWatch/1.0 (github.com/youruser/world-word-watch)"
REDDIT_BASE = "https://www.reddit.com"
NEWS_RSS_URL = "https://news.google.com/rss?hl={lang}&gl={country}&ceid={country}:{lang}"

EXTRA_STOPWORDS = {
    "said", "says", "say", "new", "one", "two", "three", "year", "years",
    "day", "days", "time", "way", "make", "made", "like", "just", "will",
    "also", "people", "world", "first", "after", "could", "would", "may",
    "get", "got", "back", "take", "part", "still", "even", "many", "last",
    "week", "month", "us", "uk", "amid", "over", "into", "more", "than",
    "from", "that", "this", "with", "have", "been", "were", "they", "their",
    "well", "about", "there", "what", "when", "where", "who", "which",
    "news", "report", "update", "latest", "top", "read", "show", "live",
    "know", "going", "come", "look", "think", "want", "give", "use",
    "find", "need", "high", "down", "government", "minister", "president",
    "official", "state", "national", "country", "city", "case", "cases",
    "2024", "2025", "2026", "january", "february", "march", "april", "may",
    "june", "july", "august", "september", "october", "november", "december",
}

LANG_STOPWORD_MAP = {
    "en": "english", "de": "german", "fr": "french", "es": "spanish",
    "it": "italian", "pt": "portuguese", "nl": "dutch", "sv": "swedish",
    "no": "norwegian", "da": "danish", "fi": "finnish", "pl": "polish",
    "ru": "russian", "uk": "russian", "cs": "czech", "hu": "hungarian",
    "ro": "romanian", "tr": "turkish", "ar": "arabic", "zh": "chinese",
    "ja": "japanese", "ko": "korean", "th": "thai", "vi": "english",
    "id": "indonesian", "el": "greek", "he": "english", "bn": "english",
}


def setup_nltk():
    for resource in ["stopwords", "punkt", "punkt_tab"]:
        try:
            nltk.download(resource, quiet=True)
        except Exception:
            pass


def validate_supabase_env() -> None:
    """Validate Supabase authentication environment variables."""
    url = os.environ.get("SUPABASE_URL")
    jwt = os.environ.get("SUPABASE_SERVICE_ROLE_JWT")

    if not url:
        log.error("Missing SUPABASE_URL environment variable")
        raise SystemExit(1)

    if not jwt:
        log.error("Missing SUPABASE_SERVICE_ROLE_JWT environment variable")
        raise SystemExit(1)

    if jwt.startswith("sb_"):
        log.error(
            "Invalid Supabase key detected.\n"
            "You are using a 'sb_secret' or 'sb_publishable' key.\n"
            "The Python pipeline requires the SERVICE_ROLE JWT key.\n"
            "Go to Supabase Dashboard → Settings → API → Project JWTs → service_role."
        )
        raise SystemExit(1)


def get_stopwords(lang_code: str) -> set:
    from nltk.corpus import stopwords as nltk_sw
    lang_name = LANG_STOPWORD_MAP.get(lang_code, "english")
    try:
        words = set(nltk_sw.words(lang_name))
    except Exception:
        words = set(nltk_sw.words("english"))
    return words | EXTRA_STOPWORDS


def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"www\.\S+", " ", text)
    text = re.sub(r"[^a-z\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff\u3000-\u9fff\s]", " ", text)
    text = re.sub(r"\b\d+\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize(text: str, stopwords: set) -> list[str]:
    words = text.split()
    return [w for w in words if len(w) >= 3 and w not in stopwords and not w.isdigit()]


def fetch_google_news(country_code: str, lang: str, max_items: int = 60) -> list[str]:
    url = NEWS_RSS_URL.format(lang=lang, country=country_code)
    try:
        feed = feedparser.parse(url)
        titles = [e.title for e in feed.entries[:max_items] if hasattr(e, "title")]
        log.info(f"  Google News [{country_code}]: {len(titles)} headlines")
        return titles
    except Exception as e:
        log.warning(f"  Google News [{country_code}] failed: {e}")
        return []


def fetch_reddit(subreddit: str, max_posts: int = 50) -> list[str]:
    headers = {"User-Agent": REDDIT_USER_AGENT}
    url = f"{REDDIT_BASE}/r/{subreddit}/hot.json?limit={max_posts}"
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        posts = resp.json()["data"]["children"]
        titles = [p["data"]["title"] for p in posts]
        log.info(f"  Reddit r/{subreddit}: {len(titles)} posts")
        return titles
    except Exception as e:
        log.warning(f"  Reddit r/{subreddit} failed: {e}, falling back to r/worldnews")
        try:
            url2 = f"{REDDIT_BASE}/r/worldnews/hot.json?limit={max_posts}"
            resp2 = requests.get(url2, headers=headers, timeout=10)
            resp2.raise_for_status()
            posts2 = resp2.json()["data"]["children"]
            return [p["data"]["title"] for p in posts2]
        except Exception as e2:
            log.warning(f"  r/worldnews also failed: {e2}")
            return []


def count_words(texts: list[str], stopwords: set) -> Counter:
    counter: Counter = Counter()
    for text in texts:
        cleaned = clean_text(text)
        tokens = tokenize(cleaned, stopwords)
        counter.update(tokens)
    return counter


def compute_trend_scores(
    today_counts: Counter,
    historical: dict[str, list[int]],
    today_str: str,
) -> list[dict]:
    results = []
    all_words = set(today_counts.keys()) | set(historical.keys())

    for word in all_words:
        freq_today = today_counts.get(word, 0)
        if freq_today == 0:
            continue

        past_freqs = historical.get(word, [])
        if past_freqs:
            avg_past = sum(past_freqs) / len(past_freqs)
        else:
            avg_past = 0

        if avg_past > 0:
            trend_score = freq_today / avg_past
        else:
            trend_score = float(freq_today)

        results.append({
            "word": word,
            "frequency": freq_today,
            "trend_score": round(trend_score, 4),
        })

    results.sort(key=lambda x: x["trend_score"], reverse=True)
    return results


def get_historical_counts(supabase_client, country_code: str, today: date) -> dict[str, list[int]]:
    from_date = (today - timedelta(days=7)).isoformat()
    to_date = (today - timedelta(days=1)).isoformat()

    try:
        resp = (
            supabase_client.table("daily_word_stats")
            .select("word, frequency, stat_date")
            .eq("country_code", country_code)
            .gte("stat_date", from_date)
            .lte("stat_date", to_date)
            .execute()
        )
        historical: dict[str, list[int]] = defaultdict(list)
        for row in resp.data or []:
            historical[row["word"]].append(row["frequency"])
        return dict(historical)
    except Exception as e:
        log.warning(f"  Failed to fetch history for {country_code}: {e}")
        return {}


def save_results(
    supabase_client,
    country_code: str,
    today_str: str,
    ranked: list[dict],
    sources_count: int,
):
    if not ranked:
        log.info(f"  [{country_code}] No words to save, skipping")
        return

    top_word = ranked[0]["word"]
    top_10 = ranked[:10]

    batch = [
        {
            "country_code": country_code,
            "stat_date": today_str,
            "word": r["word"],
            "frequency": r["frequency"],
            "trend_score": r["trend_score"],
        }
        for r in ranked[:100]
    ]

    try:
        supabase_client.table("daily_word_stats").upsert(
            batch,
            on_conflict="country_code,stat_date,word",
        ).execute()
        log.info(f"  [{country_code}] Saved {len(batch)} word stats")
    except Exception as e:
        log.error(f"  [{country_code}] Failed to save word stats: {e}")

    try:
        supabase_client.table("daily_top_word").upsert(
            {
                "country_code": country_code,
                "stat_date": today_str,
                "top_word": top_word,
                "top_10_words": top_10,
                "sources_count": sources_count,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="country_code,stat_date",
        ).execute()
        log.info(f"  [{country_code}] Top word: '{top_word}' (score={ranked[0]['trend_score']})")
    except Exception as e:
        log.error(f"  [{country_code}] Failed to save top word: {e}")


def process_country(supabase_client, country: dict, today: date, today_str: str):
    code = country["code"]
    lang = country["lang"]
    subreddit = country["subreddit"]

    log.info(f"Processing {country['name']} ({code})...")

    news_titles = fetch_google_news(code, lang)
    reddit_titles = fetch_reddit(subreddit)
    all_texts = news_titles + reddit_titles
    sources_count = len(all_texts)

    if not all_texts:
        log.warning(f"  [{code}] No text collected, skipping")
        return

    stopwords = get_stopwords(lang)
    today_counts = count_words(all_texts, stopwords)

    if not today_counts:
        log.warning(f"  [{code}] No words after filtering, skipping")
        return

    historical = get_historical_counts(supabase_client, code, today)
    ranked = compute_trend_scores(today_counts, historical, today_str)

    save_results(supabase_client, code, today_str, ranked, sources_count)
    time.sleep(1.5)


def main():
    log.info("World Word Watch Pipeline starting...")
    setup_nltk()

    validate_supabase_env()
    
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_JWT)
        log.info(f"✓ Connected to Supabase: {SUPABASE_URL}")
    except Exception as e:
        log.error(
            f"Failed to connect to Supabase: {e}\n"
            "Please verify:\n"
            "  1. SUPABASE_URL is correct (https://your-project.supabase.co)\n"
            "  2. SUPABASE_SERVICE_ROLE_JWT is a valid service_role JWT (not sb_secret_ or sb_publishable_)\n"
            "  3. The JWT has not expired"
        )
        raise SystemExit(1)
    today = date.today()
    today_str = today.isoformat()
    log.info(f"Running for date: {today_str}")

    try:
        resp = supabase_client.table("countries").select("*").execute()
        countries = resp.data or []
    except Exception as e:
        log.error(f"Failed to fetch countries: {e}")
        return

    log.info(f"Found {len(countries)} countries to process")
    errors = []

    for i, country in enumerate(countries, 1):
        log.info(f"\n[{i}/{len(countries)}]")
        try:
            process_country(supabase_client, country, today, today_str)
        except Exception as e:
            log.error(f"  Unhandled error for {country['code']}: {e}")
            errors.append(country["code"])

    log.info(f"\nPipeline complete for {today_str}")
    log.info(f"Processed {len(countries) - len(errors)}/{len(countries)} countries")
    if errors:
        log.warning(f"Failed countries: {', '.join(errors)}")


if __name__ == "__main__":
    main()
