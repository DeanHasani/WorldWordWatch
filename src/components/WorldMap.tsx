import { useState, useCallback } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import type { DailyTopWord, TooltipState } from '../lib/types';
import { numericToAlpha2, supportedCountries } from '../lib/countryCodes';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

function getTrendColor(trendScore: number): string {
  if (trendScore === 0) return '#1e3a5f';
  if (trendScore < 1.5) return '#0e4d7a';
  if (trendScore < 2.5) return '#0369a1';
  if (trendScore < 4) return '#0284c7';
  if (trendScore < 6) return '#06b6d4';
  if (trendScore < 10) return '#22d3ee';
  return '#67e8f9';
}

interface Props {
  worldData: Record<string, DailyTopWord>;
  onCountryClick: (code: string, name: string) => void;
  selectedCountry: string | null;
}

export default function WorldMap({ worldData, onCountryClick, selectedCountry }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    countryCode: '',
    countryName: '',
    topWord: '',
  });

  const handleMouseMove = useCallback(
    (event: React.MouseEvent, code: string, name: string, topWord: string) => {
      const rect = (event.currentTarget as SVGElement).closest('div')?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({
        visible: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        countryCode: code,
        countryName: name,
        topWord,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((t) => ({ ...t, visible: false }));
  }, []);

  return (
    <div className="relative w-full h-full select-none">
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 160 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup center={[0, 20]} zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const numericId = String(geo.id).padStart(3, '0');
                const alpha2 = numericToAlpha2[numericId];
                const isSupported = alpha2 && supportedCountries.has(alpha2);
                const data = alpha2 ? worldData[alpha2] : undefined;
                const isSelected = alpha2 === selectedCountry;
                const trendScore = data?.top_word ? (data.top_10_words?.[0]?.trend_score ?? 1) : 0;
                const fillColor = isSelected
                  ? '#f59e0b'
                  : isSupported && data
                  ? getTrendColor(trendScore)
                  : isSupported
                  ? '#1e3a5f'
                  : '#162032';

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillColor}
                    stroke="#0a1628"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none', transition: 'fill 0.2s ease' },
                      hover: {
                        fill: isSelected ? '#f59e0b' : isSupported ? '#38bdf8' : '#1a2d4a',
                        outline: 'none',
                        cursor: isSupported ? 'pointer' : 'default',
                      },
                      pressed: { outline: 'none' },
                    }}
                    onClick={() => {
                      if (isSupported && alpha2) {
                        onCountryClick(alpha2, geo.properties.name ?? alpha2);
                      }
                    }}
                    onMouseMove={(e) => {
                      if (isSupported && alpha2) {
                        handleMouseMove(
                          e as unknown as React.MouseEvent,
                          alpha2,
                          geo.properties.name ?? alpha2,
                          data?.top_word ?? ''
                        );
                      }
                    }}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {tooltip.visible && tooltip.topWord && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          <div className="bg-gray-900 border border-cyan-500/30 rounded-lg px-3 py-2 shadow-xl shadow-black/50">
            <p className="text-xs text-gray-400 font-medium">{tooltip.countryName}</p>
            <p className="text-sm text-cyan-300 font-bold">{tooltip.topWord}</p>
          </div>
        </div>
      )}

      {tooltip.visible && !tooltip.topWord && tooltip.countryCode && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          <div className="bg-gray-900 border border-gray-700/30 rounded-lg px-3 py-2 shadow-xl shadow-black/50">
            <p className="text-xs text-gray-400 font-medium">{tooltip.countryName}</p>
            <p className="text-xs text-gray-500 italic">No data yet</p>
          </div>
        </div>
      )}
    </div>
  );
}
