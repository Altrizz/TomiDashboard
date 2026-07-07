import React, { useMemo, useState, useEffect } from 'react';
import { AssessmentData } from '../lib/parser';
import { useDashboardData, AI_LEVELS, LEVEL_COLORS, computeAverage, computeMedian } from '../hooks/useDashboardData';
import { generateInsights } from '../lib/insights';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, ComposedChart 
} from 'recharts';
import { FileDown, Download, Layers, ShieldCheck, MapPin, Award, Users, TrendingUp, HelpCircle, Lightbulb } from 'lucide-react';
import * as FileSaver from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface DashboardProps {
  data: AssessmentData[];
  onReset: () => void;
}

export function Dashboard({ data, onReset }: DashboardProps) {
  const { filteredData, filters, availableFilters, updateFilter, clearFilters } = useDashboardData(data);
  const [activeTab, setActiveTab] = useState<'overview' | 'country' | 'seniority' | 'usage'>('overview');
  const filterKeys = ['pais', 'area', 'level', 'nivel', 'frecuencia', 'motivo', 'columnaZ'] as const;

  // Local Column Z filter for survey deep-dive
  const [columnaZFilter, setColumnaZFilter] = useState<string>('');

  const colZHeader = useMemo(() => {
    const found = data.find(d => d.columnaZHeader);
    return found?.columnaZHeader || 'Columna Z';
  }, [data]);

  const uniqueColZValues = useMemo(() => {
    const set = new Set<string>();
    data.forEach(d => {
      if (d.columnaZ) {
        set.add(d.columnaZ);
      }
    });
    return Array.from(set).filter(val => val && val !== 'Sin respuesta' && val.toLowerCase() !== 'undefined').sort();
  }, [data]);

  // General KPIs
  const totalParticipants = filteredData.length;
  const avgScore = computeAverage(filteredData);
  const medianScore = computeMedian(filteredData);

  const nivelCounts = useMemo(() => {
    const counts = AI_LEVELS.reduce((acc, level) => ({ ...acc, [level]: 0 }), {} as Record<string, number>);
    filteredData.forEach(d => {
      if (counts[d.nivel] !== undefined) counts[d.nivel]++;
    });
    return counts;
  }, [filteredData]);

  const nivelDistribution = Object.entries(nivelCounts).map(([name, value]) => ({ name, value: value as number }));
  const sortedLevels = [...nivelDistribution].sort((a,b) => b.value - a.value);
  const highestLevel = sortedLevels[0]?.name || 'N/A';
  const highestPct = totalParticipants > 0 ? ((sortedLevels[0]?.value || 0) / totalParticipants * 100).toFixed(0) : '0';
  const lowestLevel = sortedLevels[sortedLevels.length - 1]?.name || 'N/A';
  const lowestPct = totalParticipants > 0 ? ((sortedLevels[sortedLevels.length - 1]?.value || 0) / totalParticipants * 100).toFixed(0) : '0';

  const championCount = filteredData.filter(d => d.nivel === AI_LEVELS[0]).length;
  const courierCount = filteredData.filter(d => d.nivel === AI_LEVELS[1]).length;
  const topLevels = championCount + courierCount;
  const readiness = totalParticipants > 0 ? ((topLevels / totalParticipants) * 100).toFixed(1) : '0';

  // By Country
  const byCountry = useMemo(() => {
    const map = new Map<string, AssessmentData[]>();
    filteredData.forEach(d => {
      if (!map.has(d.pais)) map.set(d.pais, []);
      map.get(d.pais)!.push(d);
    });
    return Array.from(map.entries()).map(([pais, rows]) => {
      const counts = rows.reduce((acc, r) => ({ ...acc, [r.nivel]: (acc[r.nivel] || 0) + 1 }), {} as Record<string, number>);
      return {
        pais,
        total: rows.length,
        avg: computeAverage(rows),
        ...counts
      };
    });
  }, [filteredData]);

  // By Level (Seniority)
  const byLevel = useMemo(() => {
    const map = new Map<string, AssessmentData[]>();
    filteredData.forEach(d => {
      if (!map.has(d.level)) map.set(d.level, []);
      map.get(d.level)!.push(d);
    });
    return Array.from(map.entries()).map(([level, rows]) => {
      const counts = rows.reduce((acc, r) => ({ ...acc, [r.nivel]: (acc[r.nivel] || 0) + 1 }), {} as Record<string, number>);
      return {
        level,
        total: rows.length,
        avg: computeAverage(rows),
        ...counts
      };
    }).sort((a, b) => b.avg - a.avg);
  }, [filteredData]);

  // By Area
  const byArea = useMemo(() => {
    const map = new Map<string, AssessmentData[]>();
    filteredData.forEach(d => {
      if (!map.has(d.area)) map.set(d.area, []);
      map.get(d.area)!.push(d);
    });
    return Array.from(map.entries()).map(([area, rows]) => {
      const counts = rows.reduce((acc, r) => ({ ...acc, [r.nivel]: (acc[r.nivel] || 0) + 1 }), {} as Record<string, number>);
      return {
        area,
        total: rows.length,
        avg: computeAverage(rows),
        champCourierPct: (( (counts[AI_LEVELS[0]] || 0) + (counts[AI_LEVELS[1]] || 0) ) / rows.length) * 100,
        ...counts
      };
    }).sort((a,b) => b.avg - a.avg);
  }, [filteredData]);

  // Freq
  const byFreq = useMemo(() => {
    const map = new Map<string, AssessmentData[]>();
    filteredData.forEach(d => {
      if (!map.has(d.frecuencia)) map.set(d.frecuencia, []);
      map.get(d.frecuencia)!.push(d);
    });
    return Array.from(map.entries()).map(([freq, rows]) => {
      const counts = rows.reduce((acc, r) => ({ ...acc, [r.nivel]: (acc[r.nivel] || 0) + 1 }), {} as Record<string, number>);
      return {
        freq,
        total: rows.length,
        avg: computeAverage(rows),
        ...counts
      };
    }).sort((a,b) => b.avg - a.avg);
  }, [filteredData]);

  // Use cases
  const byUseCase = useMemo(() => {
    const map = new Map<string, AssessmentData[]>();
    filteredData.forEach(d => {
      d.motivos.forEach(m => {
        if (!map.has(m)) map.set(m, []);
        map.get(m)!.push(d);
      });
    });
    return Array.from(map.entries()).map(([motivo, rows]) => {
      const counts = rows.reduce((acc, r) => ({ ...acc, [r.nivel]: (acc[r.nivel] || 0) + 1 }), {} as Record<string, number>);
      return {
        motivo,
        total: rows.length,
        avg: computeAverage(rows),
        ...counts
      };
    }).sort((a,b) => b.total - a.total);
  }, [filteredData]);

  // Selected Column Z value for detailed deep-dive
  const [selectedColZ, setSelectedColZ] = useState<string>('');

  // Primary relationship builder between Column Z (Use Cases), Seniority (level) and AI Level (nivel)
  const colZAnalysis = useMemo(() => {
    const map = new Map<string, AssessmentData[]>();
    filteredData.forEach(d => {
      const val = d.columnaZ || 'Sin respuesta';
      if (!val || val === 'Sin respuesta' || val.toLowerCase() === 'undefined' || val.toLowerCase() === 'null') return;
      if (!map.has(val)) map.set(val, []);
      map.get(val)!.push(d);
    });

    return Array.from(map.entries()).map(([value, rows]) => {
      // AI Level counts
      const aiLevelCounts = AI_LEVELS.reduce((acc, lvl) => {
        acc[lvl] = 0;
        return acc;
      }, {} as Record<string, number>);

      // Seniority level counts
      const seniorityCounts = {} as Record<string, number>;
      availableFilters.level.forEach(lvl => {
        seniorityCounts[lvl] = 0;
      });

      rows.forEach(r => {
        if (r.nivel in aiLevelCounts) {
          aiLevelCounts[r.nivel]++;
        }
        if (r.level in seniorityCounts) {
          seniorityCounts[r.level]++;
        } else {
          seniorityCounts[r.level] = (seniorityCounts[r.level] || 0) + 1;
        }
      });

      return {
        useCase: value,
        total: rows.length,
        avg: computeAverage(rows),
        aiLevels: aiLevelCounts,
        seniority: seniorityCounts
      };
    }).sort((a, b) => b.total - a.total);
  }, [filteredData, availableFilters.level]);

  const colZAnalysisProcessed = useMemo(() => {
    return colZAnalysis.map(item => {
      // Find highest AI Level
      let maxAiLevel = '';
      let maxAiCount = -1;
      Object.entries(item.aiLevels as Record<string, number>).forEach(([lvl, count]) => {
        if (count > maxAiCount) {
          maxAiCount = count;
          maxAiLevel = lvl;
        }
      });

      // Find highest Seniority
      let maxSeniority = '';
      let maxSeniorityCount = -1;
      Object.entries(item.seniority as Record<string, number>).forEach(([lvl, count]) => {
        if (count > maxSeniorityCount) {
          maxSeniorityCount = count;
          maxSeniority = lvl;
        }
      });

      return {
        ...item,
        predominantAiLevel: maxAiLevel ? maxAiLevel.split(' - ')[0] : 'Desconocido',
        predominantAiLevelColor: LEVEL_COLORS[maxAiLevel] || '#94a3b8',
        predominantSeniority: maxSeniority || 'Desconocido'
      };
    });
  }, [colZAnalysis]);

  const activeColZDetail = useMemo(() => {
    if (!selectedColZ && colZAnalysisProcessed.length > 0) {
      return colZAnalysisProcessed[0];
    }
    return colZAnalysisProcessed.find(c => c.useCase === selectedColZ) || colZAnalysisProcessed[0] || null;
  }, [colZAnalysisProcessed, selectedColZ]);

  const aiLevelChartData = useMemo(() => {
    if (!activeColZDetail) return [];
    return AI_LEVELS.map(level => ({
      name: level.split(' - ')[0],
      fullName: level,
      count: activeColZDetail.aiLevels[level] || 0,
      percentage: activeColZDetail.total > 0 ? (((activeColZDetail.aiLevels[level] || 0) / activeColZDetail.total) * 100) : 0,
      fill: LEVEL_COLORS[level] || '#94a3b8'
    }));
  }, [activeColZDetail]);

  const seniorityChartData = useMemo(() => {
    if (!activeColZDetail) return [];
    return Object.entries(activeColZDetail.seniority as Record<string, number>).map(([level, count]) => ({
      name: level,
      count,
      percentage: activeColZDetail.total > 0 ? ((count / activeColZDetail.total) * 100) : 0
    })).sort((a, b) => b.count - a.count);
  }, [activeColZDetail]);

  const insights = useMemo(() => generateInsights(filteredData), [filteredData]);

  const executiveBulletInsights = useMemo(() => {
    if (filteredData.length === 0) return null;

    const levelExplorerCounts = {} as Record<string, number>;
    const paisCourierCounts = {} as Record<string, number>;
    const areaChampionCounts = {} as Record<string, number>;

    const useCaseLevelCounts = {
      [AI_LEVELS[0]]: {} as Record<string, number>, // Champion
      [AI_LEVELS[1]]: {} as Record<string, number>, // Courier
      [AI_LEVELS[2]]: {} as Record<string, number>, // Ready
      [AI_LEVELS[3]]: {} as Record<string, number>, // Explorer
    };

    filteredData.forEach(d => {
      if (d.nivel === AI_LEVELS[3] && d.level) {
        levelExplorerCounts[d.level] = (levelExplorerCounts[d.level] || 0) + 1;
      }
      if (d.nivel === AI_LEVELS[1] && d.pais) {
        paisCourierCounts[d.pais] = (paisCourierCounts[d.pais] || 0) + 1;
      }
      if (d.nivel === AI_LEVELS[0] && d.area) {
        areaChampionCounts[d.area] = (areaChampionCounts[d.area] || 0) + 1;
      }

      if (d.nivel && useCaseLevelCounts[d.nivel] && d.columnaZ && d.columnaZ !== 'Sin respuesta' && d.columnaZ !== 'undefined' && d.columnaZ !== 'null') {
        useCaseLevelCounts[d.nivel][d.columnaZ] = (useCaseLevelCounts[d.nivel][d.columnaZ] || 0) + 1;
      }
    });

    const getTop = (record: Record<string, number>) => {
      const entries = Object.entries(record).sort((a,b) => b[1] - a[1]);
      return entries.length > 0 ? entries[0] : null;
    };

    const topExplorerLevel = getTop(levelExplorerCounts);
    const topCourierPais = getTop(paisCourierCounts);
    const topChampionArea = getTop(areaChampionCounts);

    const topChampionUseCase = getTop(useCaseLevelCounts[AI_LEVELS[0]]);
    const topCourierUseCase = getTop(useCaseLevelCounts[AI_LEVELS[1]]);
    const topReadyUseCase = getTop(useCaseLevelCounts[AI_LEVELS[2]]);
    const topExplorerUseCase = getTop(useCaseLevelCounts[AI_LEVELS[3]]);

    const bullets = [];
    const recommendations = [];

    if (topExplorerLevel) {
      bullets.push({
        title: "Concentración Inicial",
        text: `El nivel (Seniority) que más aporta a la categoría "${AI_LEVELS[3].split(' - ')[0]}" es **${topExplorerLevel[0]}** (${topExplorerLevel[1]} usuarios).`
      });
      recommendations.push(`Diseñar programas de adopción (ej. clínicas de prompts) enfocados específicamente en el segmento de ${topExplorerLevel[0]} para acelerar su transición a niveles superiores.`);
    }

    if (topCourierPais) {
      bullets.push({
        title: "Impulso Intermedio",
        text: `El país que más aporta a la categoría "${AI_LEVELS[1].split(' - ')[0]}" es **${topCourierPais[0]}** (${topCourierPais[1]} usuarios).`
      });
      recommendations.push(`Aprovechar el gran volumen de usuarios intermedios en ${topCourierPais[0]} mediante retos prácticos y mentorías para convertirlos en Champions organizacionales.`);
    }

    if (topChampionArea) {
      bullets.push({
        title: "Liderazgo Avanzado",
        text: `El área que concentra más perfiles "${AI_LEVELS[0].split(' - ')[0]}" es **${topChampionArea[0]}** (${topChampionArea[1]} usuarios).`
      });
      recommendations.push(`Identificar a los Champions del área de ${topChampionArea[0]} para que funjan como embajadores tecnológicos y compartan sus casos de éxito con áreas de menor desempeño.`);
    }

    if (topChampionUseCase) {
      bullets.push({
        title: "Patrón Avanzado (Champions)",
        text: `El principal caso de uso para los usuarios "${AI_LEVELS[0].split(' - ')[0]}" es **${topChampionUseCase[0]}** (${topChampionUseCase[1]} menciones).`
      });
      recommendations.push(`Potenciar el caso de uso "${topChampionUseCase[0]}" documentando las mejores prácticas de los Champions para crear plantillas que el resto de la organización pueda reutilizar.`);
    }

    if (topCourierUseCase) {
      bullets.push({
        title: "Patrón Intermedio-Alto (Couriers)",
        text: `El principal caso de uso para los usuarios "${AI_LEVELS[1].split(' - ')[0]}" es **${topCourierUseCase[0]}** (${topCourierUseCase[1]} menciones).`
      });
      recommendations.push(`Aprovechar el interés en "${topCourierUseCase[0]}" para escalar casos de uso intermedios y brindar herramientas avanzadas a este segmento para que den el salto a Champions.`);
    }

    if (topReadyUseCase) {
      bullets.push({
        title: "Patrón Intermedio-Bajo (Ready)",
        text: `El principal caso de uso para los usuarios "${AI_LEVELS[2].split(' - ')[0]}" es **${topReadyUseCase[0]}** (${topReadyUseCase[1]} menciones).`
      });
      recommendations.push(`Fomentar el uso de IA en "${topReadyUseCase[0]}" mediante sesiones prácticas que muestren la eficiencia ganada, motivando a este grupo a integrar la IA más profundamente en sus rutinas.`);
    }

    if (topExplorerUseCase) {
      bullets.push({
        title: "Patrón Inicial (Explorers)",
        text: `El principal caso de uso para los usuarios "${AI_LEVELS[3].split(' - ')[0]}" es **${topExplorerUseCase[0]}** (${topExplorerUseCase[1]} menciones).`
      });
      recommendations.push(`Utilizar "${topExplorerUseCase[0]}" como el principal gancho de entrenamiento (quick-win) para aquellos en nivel inicial, demostrando valor inmediato y reduciendo la fricción tecnológica.`);
    }

    return { bullets, recommendations };
  }, [filteredData]);

  const sortedCountryStats = useMemo(() => {
    return [...byCountry]
      .filter(c => c.pais && c.pais !== 'undefined' && c.pais !== 'null' && c.pais !== '')
      .sort((a,b) => b.avg - a.avg);
  }, [byCountry]);

  const sortedAreaStats = useMemo(() => {
    return [...byArea]
      .filter(a => a.area && a.area !== 'undefined' && a.area !== 'null' && a.area !== '')
      .sort((a,b) => b.avg - a.avg);
  }, [byArea]);

  const sortedLevelStats = useMemo(() => {
    return [...byLevel]
      .filter(l => l.level && l.level !== 'undefined' && l.level !== 'null' && l.level !== '')
      .sort((a,b) => b.avg - a.avg);
  }, [byLevel]);

  const sortedFreqStats = useMemo(() => {
    return [...byFreq]
      .filter(f => f.freq && f.freq !== 'undefined' && f.freq !== 'null' && f.freq !== '')
      .sort((a,b) => b.avg - a.avg);
  }, [byFreq]);

  const topCountry = sortedCountryStats[0];
  const bottomCountry = sortedCountryStats[sortedCountryStats.length - 1];
  const topArea = sortedAreaStats[0];
  const bottomArea = sortedAreaStats[sortedAreaStats.length - 1];
  const topSeniority = sortedLevelStats[0];
  const bottomSeniority = sortedLevelStats[sortedLevelStats.length - 1];
  const topFreq = sortedFreqStats[0];
  const bottomFreq = sortedFreqStats[sortedFreqStats.length - 1];
  const topUseCase = byUseCase[0];

  const exportCSV = () => {
    const replacer = (key: string, value: any) => value === null ? '' : value; 
    const header = Object.keys(filteredData[0] || {});
    const csv = [
      header.join(','),
      ...filteredData.map(row => header.map(fieldName => JSON.stringify((row as any)[fieldName], replacer)).join(','))
    ].join('\r\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    FileSaver.saveAs(blob, 'assessment_data.csv');
  };

  const exportPDF = () => {
    const input = document.getElementById('dashboard-container');
    if (!input) return;
    html2canvas(input, { scale: 1.5, useCORS: true }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('dashboard_ai_readiness.pdf');
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col font-sans">
      
      {/* PROFESSIONAL SLEEK HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm z-10 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">AI Readiness Dashboard</h1>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reporte 37 - Respuestas</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-end mr-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Database Status</span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Live: XLSX Connected
            </span>
          </div>
          <button 
            onClick={onReset} 
            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-slate-400 rotate-180" /> Subir Otro Excel
          </button>
          <button 
            onClick={exportPDF} 
            className="bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all"
          >
            Exportar PDF
          </button>
        </div>
      </header>

      {/* FILTER & NAVIGATION BAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-10">
        <nav className="flex gap-6 pb-0 w-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'country', label: 'Country Analysis' },
            { id: 'seniority', label: 'Seniority & Area' },
            { id: 'usage', label: 'Usage Patterns' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`text-xs font-bold transition-all pb-1 border-b-2 ${
                activeTab === tab.id 
                  ? 'text-indigo-600 border-indigo-600' 
                  : 'text-slate-400 hover:text-slate-600 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* DETAILED DROPDOWNS FOR FILTERS */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap gap-4 items-center">
        {[
          { label: 'País', key: 'pais' },
          { label: 'Nivel', key: 'nivel' },
          { label: 'Área', key: 'area' },
          { label: 'Seniority', key: 'level' },
          { label: 'Frecuencia', key: 'frecuencia' },
          { label: 'Motivo / Uso', key: 'motivo' },
          { label: colZHeader.length > 25 ? colZHeader.slice(0, 25) + '...' : colZHeader, key: 'columnaZ' }
        ].map(f => (
          <div key={f.key} className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">{f.label}:</span>
            <select 
              className="p-1.5 text-xs border rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm font-semibold text-slate-700 min-w-[130px]"
              value={filters[f.key as keyof typeof filters][0] || ""}
              onChange={(e) => {
                updateFilter(f.key as any, e.target.value);
              }}
            >
              <option value="">Todos</option>
              {(availableFilters as any)[f.key].map((val: string) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
        ))}

        {filterKeys.some((k) => filters[k].length > 0) && (
          <button 
            onClick={clearFilters} 
            className="text-xs text-rose-600 hover:text-rose-700 font-bold ml-auto flex items-center gap-1 transition-all"
          >
            Limpiar Filtros
          </button>
        )}
      </div>

      {/* DASHBOARD CONTENT */}
      <div id="dashboard-container" className="flex-1 p-6 space-y-6 overflow-y-auto">
        
        {/* EXECUTIVE INSIGHTS STRIP */}
        {insights.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Total Participantes</p>
                    <p className="text-xl font-bold text-slate-900">{totalParticipants}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <Award className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Average Score</p>
                    <p className="text-xl font-bold text-slate-900">{avgScore.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 100</span></p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Highest Representation</p>
                    <p className="text-sm font-bold text-emerald-600 truncate" title={highestLevel}>{highestLevel.split(' - ')[0]} ({highestPct}%)</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Lowest Representation</p>
                    <p className="text-sm font-bold text-rose-600 truncate" title={lowestLevel}>{lowestLevel.split(' - ')[0]} ({lowestPct}%)</p>
                  </div>
                </div>
              </div>

              {/* DYNAMIC SCROLL CONTAINER BASED ON SELECTED TABS */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <Card className="lg:col-span-8">
                    <CardHeader>
                      <CardTitle className="text-base font-bold text-slate-800">Maturity Level Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={nivelDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={140} tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                              {nivelDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={LEVEL_COLORS[entry.name] || LEVEL_COLORS.Unknown} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-4">
                    <CardHeader>
                      <CardTitle className="text-base font-bold text-slate-800">Proporción Global</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center">
                      <div className="h-44 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={nivelDistribution} innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value">
                              {nivelDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={LEVEL_COLORS[entry.name] || LEVEL_COLORS.Unknown} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-xl font-bold text-slate-800">{totalParticipants}</span>
                        </div>
                      </div>
                      <div className="w-full space-y-1.5 mt-2">
                        {nivelDistribution.map((entry) => (
                          <div key={entry.name} className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[entry.name] }} />
                              <span className="text-slate-600 truncate max-w-[120px]" title={entry.name}>{entry.name.split(' - ')[0]}</span>
                            </div>
                            <span className="text-slate-900 font-semibold">{entry.value} ({totalParticipants > 0 ? ((entry.value/totalParticipants)*100).toFixed(0) : 0}%)</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'country' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-800">Distribución por País y Nivel</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byCountry} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="pais" tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                          <YAxis tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                          {AI_LEVELS.map(level => (
                            <Bar key={level} dataKey={level} stackId="a" fill={LEVEL_COLORS[level]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="overflow-x-auto border rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b">
                          <tr>
                            <th className="px-4 py-2.5 font-bold">País</th>
                            <th className="px-4 py-2.5 font-bold text-right">Volumen</th>
                            <th className="px-4 py-2.5 font-bold text-right">Puntaje Prom.</th>
                            {AI_LEVELS.map(l => <th key={l} className="px-4 py-2.5 font-bold text-right">{l.split(' - ')[0]} %</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {byCountry.map(c => (
                            <tr key={c.pais} className="border-b last:border-0 hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-semibold text-slate-800">{c.pais}</td>
                              <td className="px-4 py-2.5 text-right text-slate-500">{c.total}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-indigo-600">{c.avg.toFixed(1)}</td>
                              {AI_LEVELS.map(l => {
                                const val = c[l] || 0;
                                const pct = c.total > 0 ? ((val / c.total) * 100).toFixed(0) : '0';
                                return <td key={l} className="px-4 py-2.5 text-right text-slate-600">{pct}%</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'seniority' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-bold text-slate-800">Distribución por Seniority</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={byLevel} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="level" type="category" tick={{fontSize: 10}} width={70} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                            {AI_LEVELS.map(level => (
                              <Bar key={level} dataKey={level} stackId="a" fill={LEVEL_COLORS[level]} />
                            ))}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="overflow-x-auto border rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                              <th className="px-3 py-2 font-bold">Nivel</th>
                              <th className="px-3 py-2 font-bold text-right">Vol</th>
                              <th className="px-3 py-2 font-bold text-right">Promedio</th>
                            </tr>
                          </thead>
                          <tbody>
                            {byLevel.map(c => (
                              <tr key={c.level} className="border-b last:border-0 hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-semibold text-slate-800">{c.level}</td>
                                <td className="px-3 py-2 text-right text-slate-500">{c.total}</td>
                                <td className="px-3 py-2 text-right font-bold text-indigo-600">{c.avg.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-bold text-slate-800">Distribución por Área</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={byArea} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                            <XAxis type="number" dataKey="avg" domain={[0, 100]} />
                            <YAxis dataKey="area" type="category" tick={{fontSize: 10}} width={110} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                            <Bar dataKey="avg" name="Promedio" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={14} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="overflow-x-auto border rounded-xl max-h-[170px] overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b sticky top-0 z-10">
                            <tr>
                              <th className="px-3 py-2 font-bold">Área</th>
                              <th className="px-3 py-2 font-bold text-right">Vol</th>
                              <th className="px-3 py-2 font-bold text-right">% Avanzado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {byArea.map(c => (
                              <tr key={c.area} className="border-b last:border-0 hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-semibold text-slate-800 truncate max-w-[120px]">{c.area}</td>
                                <td className="px-3 py-2 text-right text-slate-500">{c.total}</td>
                                <td className="px-3 py-2 text-right font-bold text-indigo-600">{c.champCourierPct.toFixed(0)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'usage' && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-bold text-slate-800">Frecuencia de Uso vs Nivel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={byFreq} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="freq" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                            {AI_LEVELS.map(level => (
                              <Bar key={level} dataKey={level} stackId="a" fill={LEVEL_COLORS[level]} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-bold text-slate-800">Casos de Uso Principales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={byUseCase} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                              <XAxis type="number" hide />
                              <YAxis dataKey="motivo" type="category" tick={{fontSize: 10}} width={120} axisLine={false} tickLine={false} />
                              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                              <Bar dataKey="total" name="Menciones" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={12} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={byUseCase} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                              <XAxis type="number" domain={[0, 100]} />
                              <YAxis dataKey="motivo" type="category" tick={{fontSize: 10}} width={120} axisLine={false} tickLine={false} />
                              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                              <Bar dataKey="avg" name="Puntaje" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={12} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="overflow-x-auto border rounded-xl">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b">
                            <tr>
                              <th className="px-4 py-2.5 font-bold">Motivo de Uso</th>
                              {AI_LEVELS.map(l => <th key={l} className="px-4 py-2.5 font-bold text-center border-l" title={l}>{l.split(' - ')[0]}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {byUseCase.map(c => {
                              const maxVal = Math.max(...AI_LEVELS.map(l => c[l] || 0));
                              return (
                                <tr key={c.motivo} className="border-b last:border-0 hover:bg-slate-50/20">
                                  <td className="px-4 py-2.5 font-semibold text-slate-800">{c.motivo}</td>
                                  {AI_LEVELS.map(l => {
                                    const val = c[l] || 0;
                                    const intensity = maxVal === 0 ? 0 : val / maxVal;
                                    const bg = `rgba(79, 70, 229, ${intensity * 0.25})`; // sleek indigo opacity
                                    return (
                                      <td key={l} className="px-4 py-2.5 text-center text-slate-700 font-semibold border-l" style={{ backgroundColor: bg }}>
                                        {val} <span className="text-[10px] text-slate-400 font-normal">({c.total > 0 ? ((val/c.total)*100).toFixed(0) : 0}%)</span>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ANÁLISIS EXCLUSIVO COLUMNA Z - CASOS DE USO VS SENIORITY Y NIVEL DE IA */}
                  {colZAnalysisProcessed.length > 0 && (
                    <Card id="col-z-usecase-analysis" className="border border-slate-200">
                      <CardHeader className="border-b bg-slate-50/50">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                              <Award className="w-5 h-5 text-indigo-500" />
                              Relación de Casos de Uso (Columna Z) con Nivel de IA y Seniority
                            </CardTitle>
                            <p className="text-xs text-slate-500">
                              Visualiza exclusivamente la correlación entre los casos de uso descritos en la columna Z, el nivel de madurez calculado y el cargo (Seniority) de los participantes.
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-6">
                        {/* Selector of use cases */}
                        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="w-full md:w-80">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Seleccionar Caso de Uso para Análisis Detallado
                            </label>
                            <select
                              value={selectedColZ}
                              onChange={(e) => setSelectedColZ(e.target.value)}
                              className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                            >
                              <option value="">-- {colZHeader} (Más populares primero) --</option>
                              {colZAnalysisProcessed.map((item) => (
                                <option key={item.useCase} value={item.useCase}>
                                  {item.useCase} ({item.total} {item.total === 1 ? 'mención' : 'menciones'})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex-1 text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                            <span className="font-bold text-indigo-600">Tip de análisis:</span> Selecciona cualquier opción de la Columna Z de arriba para filtrar las visualizaciones y ver en detalle a qué cargos (Seniority) y niveles de madurez de IA corresponden los usuarios de dicho caso de uso.
                          </div>
                        </div>

                        {/* Top-level grid: Left list, Right breakdown charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          
                          {/* Left Column: All use cases comparison list */}
                          <div className="lg:col-span-6 space-y-3">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                              <span>Resumen de Casos de Uso (Columna Z)</span>
                            </h4>
                            <div className="overflow-x-auto border rounded-xl max-h-[380px] overflow-y-auto">
                              <table className="w-full text-xs text-left">
                                <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b sticky top-0 z-10">
                                  <tr>
                                    <th className="px-3 py-2.5 font-bold">Caso de Uso</th>
                                    <th className="px-3 py-2.5 font-bold text-right">Muestras</th>
                                    <th className="px-3 py-2.5 font-bold text-right">Promedio</th>
                                    <th className="px-3 py-2.5 font-bold">Nivel Predominante</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {colZAnalysisProcessed.map((item) => {
                                    const isSelected = activeColZDetail?.useCase === item.useCase;
                                    return (
                                      <tr 
                                        key={item.useCase} 
                                        onClick={() => setSelectedColZ(item.useCase)}
                                        className={`border-b last:border-0 cursor-pointer hover:bg-indigo-50/40 transition-colors ${isSelected ? 'bg-indigo-50/70 hover:bg-indigo-50/80 font-semibold' : ''}`}
                                      >
                                        <td className="px-3 py-2.5 text-slate-800 max-w-[200px] truncate" title={item.useCase}>
                                          {item.useCase}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-slate-500">
                                          {item.total}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-extrabold text-indigo-600">
                                          {item.avg.toFixed(1)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <span 
                                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap"
                                            style={{ backgroundColor: item.predominantAiLevelColor }}
                                          >
                                            {item.predominantAiLevel}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Right Column: Active Use Case Details & Breakdown */}
                          {activeColZDetail && (
                            <div className="lg:col-span-6 space-y-5 bg-slate-50/40 p-4 rounded-xl border border-slate-100">
                              <div>
                                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Caso de Uso Seleccionado</h4>
                                <p className="text-sm font-bold text-slate-800 break-words line-clamp-2" title={activeColZDetail.useCase}>
                                  &ldquo;{activeColZDetail.useCase}&rdquo;
                                </p>
                                <div className="mt-2 flex gap-4 text-xs">
                                  <div>
                                    <span className="text-slate-500">Total participantes:</span>{' '}
                                    <strong className="text-slate-800">{activeColZDetail.total}</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Madurez Promedio:</span>{' '}
                                    <strong className="text-indigo-600">{activeColZDetail.avg.toFixed(1)} pts</strong>
                                  </div>
                                </div>
                              </div>

                              {/* Breakdown 1: AI Level */}
                              <div className="space-y-2">
                                <h5 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                  Composición por Nivel de Madurez IA
                                </h5>
                                <div className="h-32 w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={aiLevelChartData} layout="vertical" margin={{ top: 0, right: 20, left: -25, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                      <XAxis type="number" domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                                      <YAxis dataKey="name" type="category" tick={{fontSize: 9}} width={60} axisLine={false} tickLine={false} />
                                      <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Porcentaje']}
                                      />
                                      <Bar dataKey="percentage" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={10}>
                                        {aiLevelChartData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>

                              {/* Breakdown 2: Seniority */}
                              <div className="space-y-2">
                                <h5 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                  Distribución por Cargo (Seniority)
                                </h5>
                                <div className="h-32 w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={seniorityChartData} layout="vertical" margin={{ top: 0, right: 20, left: -25, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                      <XAxis type="number" domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                                      <YAxis dataKey="name" type="category" tick={{fontSize: 9}} width={65} axisLine={false} tickLine={false} />
                                      <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Porcentaje']}
                                      />
                                      <Bar dataKey="percentage" name="Porcentaje" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={10} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>

                              {/* Interactive Text Insight */}
                              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-950">
                                <span className="font-bold uppercase text-[9px] text-indigo-600 block tracking-wider mb-1">
                                  Patrón Encontrado (Zoom de Uso)
                                </span>
                                <p className="leading-relaxed">
                                  Los encuestados que usan la IA para <strong className="text-indigo-900">&ldquo;{activeColZDetail.useCase}&rdquo;</strong> tienen una madurez promedio de <strong className="text-indigo-700">{activeColZDetail.avg.toFixed(1)} puntos</strong>. El cargo predominante en este segmento es <strong className="text-indigo-900">{activeColZDetail.predominantSeniority}</strong>, y la categoría de preparación de IA de mayor frecuencia es <strong className="text-indigo-700">{activeColZDetail.predominantAiLevel}</strong>.
                                </p>
                              </div>

                            </div>
                          )}

                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

            </div>

            {/* SLEEK INDIGO RIGHT-HAND INSIGHTS PANEL */}
            <div className="xl:col-span-4 bg-slate-900 rounded-2xl text-white p-6 shadow-xl relative overflow-hidden flex flex-col justify-between gap-6 border border-slate-800">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Layers className="w-40 h-44 text-white" />
              </div>

              <div className="space-y-6 flex-1 flex flex-col min-h-0">
                <h3 className="font-bold text-white text-base flex items-center gap-2 tracking-wide uppercase flex-shrink-0">
                  <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse"></span>
                  AI Executive Insights
                </h3>

                <div className="space-y-5 overflow-y-auto pr-1 flex-1 max-h-[520px] scrollbar-thin">
                  
                  {/* OVERVIEW TAB INSIGHTS */}
                  {activeTab === 'overview' && (
                    <>
                      {/* Circular Readiness Gauge */}
                      <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-4 hover:bg-white/10 transition-all">
                        <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.05)" strokeWidth="5" fill="transparent" />
                            <circle cx="32" cy="32" r="28" stroke="#818cf8" strokeWidth="5" fill="transparent"
                              strokeDasharray={2 * Math.PI * 28}
                              strokeDashoffset={2 * Math.PI * 28 * (1 - Number(readiness) / 100)}
                              strokeLinecap="round"
                              className="transition-all duration-1000"
                            />
                          </svg>
                          <span className="absolute text-xs font-black text-indigo-300">{readiness}%</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Preparación Global (Readiness)</p>
                          <p className="text-[11px] text-slate-300 font-medium leading-normal">
                            Proporción de usuarios con perfiles avanzados (Champions & Couriers) ({topLevels} de {totalParticipants}).
                          </p>
                        </div>
                      </div>

                      {/* Hallazgos y Recomendaciones */}
                      {executiveBulletInsights && (
                        <div className="space-y-4 mt-2">
                          {executiveBulletInsights.bullets.length > 0 && (
                            <div className="bg-white/5 p-4 rounded-xl border border-indigo-500/20 space-y-3 hover:bg-white/10 transition-all">
                              <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5" />
                                Hallazgos Clave
                              </p>
                              <ul className="space-y-2.5">
                                {executiveBulletInsights.bullets.map((b, i) => (
                                  <li key={i} className="text-[11px] text-slate-300 leading-relaxed flex gap-2">
                                    <span className="text-indigo-400 mt-0.5">•</span>
                                    <span>
                                      <strong className="text-indigo-200">{b.title}:</strong>{' '}
                                      <span dangerouslySetInnerHTML={{ __html: b.text.replace(/\*\*(.*?)\*\*/g, '<strong className="text-white">$1</strong>') }} />
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {executiveBulletInsights.recommendations.length > 0 && (
                            <div className="bg-indigo-950/40 p-4 rounded-xl border border-indigo-400/30 space-y-3 hover:bg-indigo-950/60 transition-all">
                              <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider flex items-center gap-1.5">
                                <Lightbulb className="w-3.5 h-3.5" />
                                Recomendaciones Estratégicas
                              </p>
                              <ul className="space-y-2.5">
                                {executiveBulletInsights.recommendations.map((r, i) => (
                                  <li key={i} className="text-[11px] text-indigo-100 leading-relaxed flex gap-2">
                                    <span className="text-indigo-400 mt-0.5">→</span>
                                    <span>{r}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Promedio por Área Chart */}
                      {sortedAreaStats.length > 0 && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 hover:bg-white/10 transition-all">
                          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Desempeño por Área (Promedio)</p>
                          <div className="space-y-2.5">
                            {sortedAreaStats.map((c) => (
                              <div key={c.area} className="space-y-1">
                                <div className="flex justify-between text-[11px] leading-none">
                                  <span className="font-semibold text-slate-200 truncate max-w-[170px]" title={c.area}>{c.area} ({c.total})</span>
                                  <span className="font-bold text-indigo-300">{c.avg.toFixed(1)} pts</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" style={{ width: `${c.avg}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Adopción por Seniority Chart */}
                      {sortedLevelStats.length > 0 && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 hover:bg-white/10 transition-all">
                          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Score por Seniority</p>
                          <div className="space-y-2.5">
                            {sortedLevelStats.map((c) => (
                              <div key={c.level} className="space-y-1">
                                <div className="flex justify-between text-[11px] leading-none">
                                  <span className="font-semibold text-slate-200 truncate max-w-[170px]" title={c.level}>{c.level} ({c.total})</span>
                                  <span className="font-bold text-indigo-300">{c.avg.toFixed(1)} pts</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full" style={{ width: `${c.avg}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* COUNTRY TAB INSIGHTS */}
                  {activeTab === 'country' && (
                    <>
                      {/* Circular top country Gauge */}
                      {topCountry && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-4 hover:bg-white/10 transition-all">
                          <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.05)" strokeWidth="5" fill="transparent" />
                              <circle cx="32" cy="32" r="28" stroke="#06b6d4" strokeWidth="5" fill="transparent"
                                strokeDasharray={2 * Math.PI * 28}
                                strokeDashoffset={2 * Math.PI * 28 * (1 - topCountry.avg / 100)}
                                strokeLinecap="round"
                                className="transition-all duration-1000"
                              />
                            </svg>
                            <span className="absolute text-xs font-black text-cyan-300">{topCountry.avg.toFixed(1)}</span>
                          </div>
                          <div>
                            <p className="text-[10px] text-cyan-300 uppercase font-bold tracking-wider">Líder Regional (Máximo Score)</p>
                            <p className="text-[11px] text-slate-300 font-medium leading-normal">
                              {topCountry.pais} lidera el índice con un promedio sobresaliente. ({topCountry.total} participantes)
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Promedio por País Chart */}
                      {sortedCountryStats.length > 0 && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 hover:bg-white/10 transition-all">
                          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Ranking de Países</p>
                          <div className="space-y-2.5">
                            {sortedCountryStats.map((c) => (
                              <div key={c.pais} className="space-y-1">
                                <div className="flex justify-between text-[11px] leading-none">
                                  <span className="font-semibold text-slate-200">{c.pais} ({c.total})</span>
                                  <span className="font-bold text-indigo-300">{c.avg.toFixed(1)} pts</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full" style={{ width: `${c.avg}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom regional analysis card */}
                      {topCountry && bottomCountry && topCountry.pais !== bottomCountry.pais && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
                          <p className="text-[10px] text-rose-300 uppercase font-bold tracking-wider">Brecha Geográfica</p>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            Existe una brecha de <strong className="text-white">{(topCountry.avg - bottomCountry.avg).toFixed(1)} puntos</strong> entre el país con mayor madurez ({topCountry.pais}) y el de menor madurez ({bottomCountry.pais}).
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* SENIORITY & AREA TAB INSIGHTS */}
                  {activeTab === 'seniority' && (
                    <>
                      {/* Circular top area Gauge */}
                      {topArea && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-4 hover:bg-white/10 transition-all">
                          <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.05)" strokeWidth="5" fill="transparent" />
                              <circle cx="32" cy="32" r="28" stroke="#a855f7" strokeWidth="5" fill="transparent"
                                strokeDasharray={2 * Math.PI * 28}
                                strokeDashoffset={2 * Math.PI * 28 * (1 - topArea.avg / 100)}
                                strokeLinecap="round"
                                className="transition-all duration-1000"
                              />
                            </svg>
                            <span className="absolute text-xs font-black text-purple-300">{topArea.avg.toFixed(1)}</span>
                          </div>
                          <div>
                            <p className="text-[10px] text-purple-300 uppercase font-bold tracking-wider">Área de Mayor Adopción</p>
                            <p className="text-[11px] text-slate-300 font-medium leading-normal">
                              El área de <strong className="text-white">{topArea.area}</strong> registra la mayor madurez tecnológica con un promedio alto.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Promedio por Área Chart */}
                      {sortedAreaStats.length > 0 && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 hover:bg-white/10 transition-all">
                          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Top Áreas</p>
                          <div className="space-y-2.5">
                            {sortedAreaStats.slice(0, 4).map((c) => (
                              <div key={c.area} className="space-y-1">
                                <div className="flex justify-between text-[11px] leading-none">
                                  <span className="font-semibold text-slate-200 truncate max-w-[170px]">{c.area} ({c.total})</span>
                                  <span className="font-bold text-indigo-300">{c.avg.toFixed(1)} pts</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" style={{ width: `${c.avg}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Adopción por Seniority Chart */}
                      {sortedLevelStats.length > 0 && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 hover:bg-white/10 transition-all">
                          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Score por Seniority</p>
                          <div className="space-y-2.5">
                            {sortedLevelStats.map((c) => (
                              <div key={c.level} className="space-y-1">
                                <div className="flex justify-between text-[11px] leading-none">
                                  <span className="font-semibold text-slate-200 truncate max-w-[170px]">{c.level} ({c.total})</span>
                                  <span className="font-bold text-indigo-300">{c.avg.toFixed(1)} pts</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full" style={{ width: `${c.avg}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* USAGE PATTERNS TAB INSIGHTS */}
                  {activeTab === 'usage' && (
                    <>
                      {/* Circular top use frequency Gauge */}
                      {topFreq && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-4 hover:bg-white/10 transition-all">
                          <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.05)" strokeWidth="5" fill="transparent" />
                              <circle cx="32" cy="32" r="28" stroke="#10b981" strokeWidth="5" fill="transparent"
                                strokeDasharray={2 * Math.PI * 28}
                                strokeDashoffset={2 * Math.PI * 28 * (1 - topFreq.avg / 100)}
                                strokeLinecap="round"
                                className="transition-all duration-1000"
                              />
                            </svg>
                            <span className="absolute text-xs font-black text-emerald-300">{topFreq.avg.toFixed(1)}</span>
                          </div>
                          <div>
                            <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Uso Más Efectivo</p>
                            <p className="text-[11px] text-slate-300 font-medium leading-normal">
                              La frecuencia &ldquo;{topFreq.freq}&rdquo; obtiene el puntaje promedio más alto. ({topFreq.total} colaboradores)
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Frecuencia de Uso Chart */}
                      {sortedFreqStats.length > 0 && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 hover:bg-white/10 transition-all">
                          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Uso vs Nivel de Preparación</p>
                          <div className="space-y-2.5">
                            {sortedFreqStats.map((c) => (
                              <div key={c.freq} className="space-y-1">
                                <div className="flex justify-between text-[11px] leading-none">
                                  <span className="font-semibold text-slate-200 truncate max-w-[170px]">{c.freq} ({c.total})</span>
                                  <span className="font-bold text-indigo-300">{c.avg.toFixed(1)} pts</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full" style={{ width: `${c.avg}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Top Use Case */}
                      {topUseCase && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
                          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Principal Caso de Uso</p>
                          <p className="text-[11px] text-slate-200 font-semibold leading-relaxed">
                            {topUseCase.motivo}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Adopción por {topUseCase.total} colaboradores con promedio de {topUseCase.avg.toFixed(1)} puntos.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                </div>
              </div>

              {/* DYNAMIC RECOMENDACIÓN ESTRATÉGICA AT BOTTOM */}
              <div className="pt-4 border-t border-white/10 flex-shrink-0">
                <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider mb-1">Recomendación Estratégica</p>
                <p className="text-xs font-semibold leading-relaxed text-white">
                  {activeTab === 'overview' && "Potenciar la formación práctica en las áreas rezagadas y escalar los casos de uso exitosos de los Champions para maximizar el ROI."}
                  {activeTab === 'country' && `Establecer transferencia de conocimientos y mentoría cruzada desde ${topCountry?.pais || 'el país líder'} hacia los equipos de ${bottomCountry?.pais || 'otros países'} para homologar el nivel.`}
                  {activeTab === 'seniority' && `Focalizar programas de habilitación para el área de ${bottomArea?.area || 'menor adopción'} e implementar talleres prácticos de IA diferenciados por nivel de seniority.`}
                  {activeTab === 'usage' && `Incentivar el uso diario de herramientas de IA asociándolo a los casos de uso más populares, como ${topUseCase?.motivo || 'casos clave'}, para acelerar la curva de aprendizaje global.`}
                </p>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
