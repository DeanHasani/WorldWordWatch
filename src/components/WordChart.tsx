import type { HistoryEntry } from '../lib/types';

interface Props {
  history: HistoryEntry[];
  word: string;
}

export default function WordChart({ history, word }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-600 text-sm">
        No historical data available
      </div>
    );
  }

  const last7: HistoryEntry[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const found = history.find((h) => h.stat_date === dateStr);
    last7.push(
      found ?? { stat_date: dateStr, word, frequency: 0, trend_score: 0 }
    );
  }

  const maxFreq = Math.max(...last7.map((h) => h.frequency), 1);
  const chartH = 80;
  const chartW = 280;
  const barW = 30;
  const gap = 10;
  const totalW = last7.length * (barW + gap) - gap;
  const offsetX = (chartW - totalW) / 2;

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">
        Frequency of &ldquo;<span className="text-cyan-400">{word}</span>&rdquo; — last 7 days
      </p>
      <svg width={chartW} height={chartH + 24} className="overflow-visible">
        {last7.map((entry, i) => {
          const barH = entry.frequency > 0 ? Math.max(4, (entry.frequency / maxFreq) * chartH) : 2;
          const x = offsetX + i * (barW + gap);
          const y = chartH - barH;
          const date = new Date(entry.stat_date + 'T00:00:00');
          const label = date.toLocaleDateString('en', { weekday: 'short' }).charAt(0);
          const isToday = i === 6;

          return (
            <g key={entry.stat_date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={4}
                fill={entry.frequency > 0 ? (isToday ? '#06b6d4' : '#0284c7') : '#1e3a5f'}
                opacity={entry.frequency > 0 ? 1 : 0.4}
              />
              {entry.frequency > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#94a3b8"
                >
                  {entry.frequency}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={chartH + 16}
                textAnchor="middle"
                fontSize={10}
                fill={isToday ? '#06b6d4' : '#64748b'}
                fontWeight={isToday ? 'bold' : 'normal'}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
