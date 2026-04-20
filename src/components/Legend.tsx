export default function Legend() {
  const stops = [
    { color: '#1e3a5f', label: 'No data' },
    { color: '#0e4d7a', label: 'Low' },
    { color: '#0284c7', label: 'Rising' },
    { color: '#06b6d4', label: 'High' },
    { color: '#67e8f9', label: 'Viral' },
  ];

  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-500 text-xs font-medium">Trend</span>
      <div className="flex items-center gap-1.5">
        {stops.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1">
            <div
              className="w-5 h-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-gray-600 text-[9px]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
