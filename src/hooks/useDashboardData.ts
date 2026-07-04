import { useMemo, useState } from 'react';
import { AssessmentData } from '../lib/parser';

export const AI_LEVELS = [
  'AI Champion - Avanzado',
  'AI Courier - Intermedio/Alto',
  'AI Ready - Intermedio/bajo',
  'AI Explorer - Inicial'
];

export const LEVEL_COLORS: Record<string, string> = {
  'AI Champion - Avanzado': '#10b981', // green-500
  'AI Courier - Intermedio/Alto': '#3b82f6', // blue-500
  'AI Ready - Intermedio/bajo': '#f59e0b', // amber-500
  'AI Explorer - Inicial': '#ef4444', // red-500
  'Unknown': '#94a3b8' // slate-400
};

export type Filters = {
  pais: string[];
  area: string[];
  level: string[];
  nivel: string[];
  frecuencia: string[];
  motivo: string[];
  columnaZ: string[];
};

export function useDashboardData(rawData: AssessmentData[]) {
  const [filters, setFilters] = useState<Filters>({
    pais: [],
    area: [],
    level: [],
    nivel: [],
    frecuencia: [],
    motivo: [],
    columnaZ: []
  });

  const availableFilters = useMemo(() => {
    const paises = new Set<string>();
    const areas = new Set<string>();
    const levels = new Set<string>();
    const niveles = new Set<string>();
    const frecuencias = new Set<string>();
    const motivos = new Set<string>();
    const columnaZs = new Set<string>();

    rawData.forEach(d => {
      if (d.pais) paises.add(d.pais);
      if (d.area) areas.add(d.area);
      if (d.level) levels.add(d.level);
      if (d.nivel) niveles.add(d.nivel);
      if (d.frecuencia) frecuencias.add(d.frecuencia);
      if (d.columnaZ) columnaZs.add(d.columnaZ);
      d.motivos.forEach(m => motivos.add(m));
    });

    return {
      pais: Array.from(paises).sort(),
      area: Array.from(areas).sort(),
      level: Array.from(levels).sort(),
      nivel: AI_LEVELS.filter(l => niveles.has(l)),
      frecuencia: Array.from(frecuencias).sort(),
      motivo: Array.from(motivos).sort(),
      columnaZ: Array.from(columnaZs).sort()
    };
  }, [rawData]);

  const filteredData = useMemo(() => {
    return rawData.filter(d => {
      if (filters.pais.length > 0 && !filters.pais.includes(d.pais)) return false;
      if (filters.area.length > 0 && !filters.area.includes(d.area)) return false;
      if (filters.level.length > 0 && !filters.level.includes(d.level)) return false;
      if (filters.nivel.length > 0 && !filters.nivel.includes(d.nivel)) return false;
      if (filters.frecuencia.length > 0 && !filters.frecuencia.includes(d.frecuencia)) return false;
      if (filters.motivo.length > 0 && !d.motivos.some(m => filters.motivo.includes(m))) return false;
      if (filters.columnaZ && filters.columnaZ.length > 0 && !filters.columnaZ.includes(d.columnaZ || '')) return false;
      return true;
    });
  }, [rawData, filters]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "" ? [] : [value]
    }));
  };

  const clearFilters = () => {
    setFilters({ pais: [], area: [], level: [], nivel: [], frecuencia: [], motivo: [], columnaZ: [] });
  };

  return { filteredData, availableFilters, filters, updateFilter, clearFilters };
}

export function computeAverage(data: AssessmentData[], key: 'puntaje' = 'puntaje') {
  if (data.length === 0) return 0;
  return data.reduce((sum, item) => sum + item[key], 0) / data.length;
}

export function computeMedian(data: AssessmentData[]) {
  if (data.length === 0) return 0;
  const sorted = [...data].map(d => d.puntaje).sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[half - 1] + sorted[half]) / 2.0;
  }
  return sorted[half];
}
