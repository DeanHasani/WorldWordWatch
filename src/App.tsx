import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { Globe as Globe2, RefreshCw, AlertCircle } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { motion, useMotionValue, animate } from 'framer-motion';
import WorldMap from './components/WorldMap';
import CountryPanel from './components/CountryPanel';
import Legend from './components/Legend';
import { useWorldData } from './hooks/useWorldData';
import { supabase } from './lib/supabase';
import type { Country } from './lib/types';
import { useMemo } from 'react';

// ─── Circular Text ──
interface CircularTextProps {
  text: string;
  radius?: number;
  fontSize?: number;
  className?: string;
  highlightChars?: string[];
}

function CircularText({
  text,
  radius = 52,
  fontSize = 9,
  className = '',
  highlightChars = [],
}: CircularTextProps) {
  const chars = text.split('');
  const total = chars.length;
  const rotation = useMotionValue(0);
  const [hovered, setHovered] = useState(false);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);

  // Kick off infinite slow spin on mount, speed up on hover
  useEffect(() => {
    const startSpin = (duration: number) => {
      const current = rotation.get();
      animRef.current = animate(rotation, current + 360, {
        duration,
        ease: 'linear',
        repeat: Infinity,
        repeatType: 'loop',
      });
    };

    if (hovered) {
      animRef.current?.stop();
      startSpin(4); // fast
    } else {
      animRef.current?.stop();
      startSpin(12); // normal
    }

    return () => animRef.current?.stop();
  }, [hovered]);

  const size = radius * 2 + fontSize * 2 + 4;

  return (
    <motion.div
      className={`relative select-none ${className}`}
      style={{ width: size, height: size }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <motion.svg
        style={{ rotate: rotation, width: size, height: size }}
        viewBox={`0 0 ${size} ${size}`}
      >
        {chars.map((char, i) => {
          const angle = (i / total) * 360 - 90; // start from top
          const rad = (angle * Math.PI) / 180;
          const cx = size / 2;
          const cy = size / 2;
          const x = cx + radius * Math.cos(rad);
          const y = cy + radius * Math.sin(rad);
          const isHighlight = highlightChars.includes(char);

          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${angle + 90}, ${x}, ${y})`}
              fontSize={fontSize}
              fontWeight={isHighlight ? '900' : '400'}
              fill={isHighlight ? '#67e8f9' : '#6b7280'} // cyan-300 : gray-500
              style={{
                fontFamily: 'inherit',
                letterSpacing: '0.05em',
                transition: 'fill 0.2s',
              }}
            >
              {char}
            </text>
          );
        })}
      </motion.svg>
    </motion.div>
  );
}

// ─── Globe Model ──────────────────────────────────────────────────────────────
function GlobeModel() {
  const modelRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/globe.glb');

  const centeredModel = useMemo(() => {
    const cloned = scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    cloned.children.forEach(child => {
      child.position.x -= center.x;
      child.position.y -= center.y;
      child.position.z -= center.z;
    });
    return cloned;
  }, [scene]);

  useFrame((_, delta) => {
    if (modelRef.current) {
      modelRef.current.rotation.y -= delta * 0.6;
    }
  });

  return (
    <group position={[0, 0.2, 0]}>
      <primitive ref={modelRef} object={centeredModel} scale={0.5} />
    </group>
  );
}

// ─── Branding Badge (globe + circular text) ───────────────────────────────────
const CIRCULAR_TEXT = 'W.W.W * DAILY TRENDING WORDS BY COUNTRY * ';

function BrandingBadge() {
  const ringSize = 110; // radius*2 + fontSize*2 + 4 = 48*2 + 7*2 + 4

  return (
    <div style={{ position: 'relative', width: ringSize, height: ringSize }}>
      <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto' }}>
        <CircularText
          text={CIRCULAR_TEXT}
          radius={45}
          fontSize={10}
          highlightChars={['W']}
        />
      </div>

      <div style={{
        position: 'absolute',
        top: '60%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 95,
        height: 95,
        zIndex: 1,
        pointerEvents: 'auto',
      }}>
        <Canvas camera={{ position: [0, 0, 2.4], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Suspense fallback={null}>
            <GlobeModel />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { data: worldData, loading, error, lastUpdated } = useWorldData();
  const [countries, setCountries] = useState<Record<string, Country>>({});
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    async function loadCountries() {
      const { data } = await supabase.from('countries').select('*');
      if (data) {
        const map: Record<string, Country> = {};
        for (const c of data) map[c.code] = c as Country;
        setCountries(map);
      }
    }
    loadCountries();
  }, []);

  const handleCountryClick = useCallback((code: string) => {
    setSelectedCode((prev) => (prev === code ? null : code));
  }, []);

  const handleClose = useCallback(() => {
    setSelectedCode(null);
  }, []);

  const countriesWithData = Object.keys(worldData).length;
  const formattedDate = lastUpdated
    ? new Date(lastUpdated + 'T00:00:00').toLocaleDateString('en', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="relative h-screen bg-[#080e1a] text-white overflow-hidden">

      <div className="absolute inset-0">
        <WorldMap
          worldData={worldData}
          onCountryClick={handleCountryClick}
          selectedCountry={selectedCode}
        />
      </div>

      {/* Floating top-left branding — globe with circular text */}
      <div className="absolute top-2 left-3 md:left-5 z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <BrandingBadge />
        </div>
      </div>

      <div className="absolute top-4 right-5 md:right-8 z-20 flex items-center gap-4 pointer-events-none">
        {loading && (
          <div className="flex items-center gap-2 text-gray-500 text-xs pointer-events-auto">
            <RefreshCw size={12} className="animate-spin" />
            Loading...
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center gap-1.5 text-red-400 text-xs pointer-events-auto">
            <AlertCircle size={12} />
            {error}
          </div>
        )}
        {!loading && !error && formattedDate && (
          <div className="hidden sm:flex flex-col items-end pointer-events-auto">
            <span className="text-gray-400 text-xs font-medium">{formattedDate}</span>
            <span className="text-gray-600 text-[10px]">
              {countriesWithData} countr{countriesWithData !== 1 ? 'ies' : 'y'} tracked
            </span>
          </div>
        )}
        {!loading && !error && countriesWithData === 0 && (
          <div className="hidden sm:block text-gray-500 text-xs pointer-events-auto">
            Awaiting pipeline run
          </div>
        )}
      </div>

      <div className="absolute bottom-4 left-4 z-20 pointer-events-auto">
        <Legend />
      </div>

      {!loading && countriesWithData === 0 && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-center bg-[#0a1120]/90 border border-gray-800 rounded-2xl p-8 max-w-sm mx-4 pointer-events-auto">
            <Globe2 size={40} className="text-gray-700 mx-auto mb-4" />
            <h3 className="text-white font-bold text-lg mb-2">No data yet</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              The daily pipeline has not run yet. Run it manually or wait for the
              scheduled GitHub Actions cron job.
            </p>
            <div className="mt-4 bg-gray-900/60 rounded-lg p-3">
              <code className="text-cyan-400 text-xs">cd pipeline && python pipeline.py</code>
            </div>
          </div>
        </div>
      )}

      <aside
        className={`
          absolute top-0 right-0 h-full z-30
          border-l border-gray-800 bg-[#0a1120] overflow-hidden
          transition-all duration-300 ease-in-out
          ${selectedCode ? 'w-full sm:w-80 md:w-96' : 'w-0'}
        `}
        style={{ maxWidth: selectedCode ? '384px' : '0' }}
      >
        {selectedCode && countries[selectedCode] && (
          <CountryPanel
            country={countries[selectedCode]}
            onClose={handleClose}
          />
        )}
      </aside>
    </div>
  );
}