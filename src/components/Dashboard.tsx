import React, { useMemo, useState } from 'react';
import { AssessmentData } from '../lib/parser';
import { useDashboardData, AI_LEVELS, LEVEL_COLORS, computeAverage, computeMedian } from '../hooks/useDashboardData';
import { generateInsights } from '../lib/insights';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, ComposedChart 
} from 'recharts';
import { FileDown, Download, Layers, ShieldCheck, MapPin, Award, Users, TrendingUp, HelpCircle } from 'lucide-react';
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
  const filterKeys = ['pais', 'area', 'level', 'nivel', 'frecuencia', 'motivo'] as const;

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

  const insights = useMemo(() => generateInsights(filteredData), [filteredData]);

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
          { label: 'Motivo / Uso', key: 'motivo' }
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

                  {/* Promedio por País Chart */}
                  {sortedCountryStats.length > 0 && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 hover:bg-white/10 transition-all">
                      <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Puntaje Promedio por País</p>
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

                  {/* Promedio por Área Chart */}
                  {sortedAreaStats.length > 0 && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 hover:bg-white/10 transition-all">
                      <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Top Áreas (Puntaje Promedio)</p>
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

                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex-shrink-0">
                <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider mb-1">Recomendación Estratégica</p>
                <p className="text-xs font-semibold leading-relaxed text-white">
                  Potenciar la formación práctica en las áreas rezagadas y escalar los casos de uso exitosos de los Champions para maximizar el ROI.
                </p>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
