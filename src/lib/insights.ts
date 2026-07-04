import { AssessmentData } from './parser';
import { AI_LEVELS, computeAverage } from '../hooks/useDashboardData';

export function generateInsights(data: AssessmentData[]) {
  if (data.length === 0) return [];

  const total = data.length;
  const avg = computeAverage(data);
  
  // AI Readiness
  const championCount = data.filter(d => d.nivel === AI_LEVELS[0]).length;
  const courierCount = data.filter(d => d.nivel === AI_LEVELS[1]).length;
  const topLevels = championCount + courierCount;
  const readiness = ((topLevels / total) * 100).toFixed(1);
  
  // Countries
  const byCountry = Object.entries(groupBy(data, 'pais'));
  const countryStats = byCountry.map(([pais, rows]) => ({ pais, avg: computeAverage(rows) })).sort((a,b) => b.avg - a.avg);
  const bestCountry = countryStats[0];
  const worstCountry = countryStats[countryStats.length - 1];

  // Areas
  const byArea = Object.entries(groupBy(data, 'area'));
  const areaStats = byArea.map(([area, rows]) => ({ area, avg: computeAverage(rows) })).sort((a,b) => b.avg - a.avg);
  const bestArea = areaStats[0];
  const worstArea = areaStats[areaStats.length - 1];

  // Seniority
  const byLevel = Object.entries(groupBy(data, 'level'));
  const levelStats = byLevel.map(([level, rows]) => ({ level, avg: computeAverage(rows) })).sort((a,b) => b.avg - a.avg);
  const bestLevel = levelStats[0];
  const worstLevel = levelStats[levelStats.length - 1];

  // Frequency
  const freqGroups = Object.entries(groupBy(data, 'frecuencia'));
  const freqStats = freqGroups.map(([freq, rows]) => ({ freq, avg: computeAverage(rows) })).sort((a,b) => b.avg - a.avg);
  const topFreq = freqStats[0];

  // Use cases (Advanced users = Champions + Couriers)
  const advancedUsers = data.filter(d => d.nivel === AI_LEVELS[0] || d.nivel === AI_LEVELS[1]);
  const useCaseCounts: Record<string, number> = {};
  advancedUsers.forEach(d => {
    d.motivos.forEach(m => {
      useCaseCounts[m] = (useCaseCounts[m] || 0) + 1;
    });
  });
  const topUseCase = Object.entries(useCaseCounts).sort((a,b) => b[1] - a[1])[0];

  const insights = [
    `Nivel de preparación global: El ${readiness}% de los participantes se encuentra en niveles avanzados o intermedios altos (AI Champion o AI Courier).`,
    bestCountry && worstCountry ? `Desempeño por país: ${bestCountry.pais} lidera con el mayor puntaje promedio (${bestCountry.avg.toFixed(1)}), mientras que ${worstCountry.pais} presenta la mayor oportunidad de mejora (${worstCountry.avg.toFixed(1)}).` : '',
    bestArea && worstArea ? `Desempeño por área: El área de ${bestArea.area} obtuvo el puntaje más alto promedio (${bestArea.avg.toFixed(1)}). El área de ${worstArea.area} obtuvo el menor (${worstArea.avg.toFixed(1)}).` : '',
    bestLevel && worstLevel ? `Seniority: Los perfiles ${bestLevel.level} reportan el mayor nivel de adopción promedio (${bestLevel.avg.toFixed(1)}), en contraste con ${worstLevel.level} (${worstLevel.avg.toFixed(1)}).` : '',
    topFreq ? `Frecuencia de uso: Aquellos que usan herramientas de IA con la frecuencia "${topFreq.freq}" tienen el mayor puntaje promedio (${topFreq.avg.toFixed(1)}), confirmando la correlación positiva entre uso y score.` : '',
    topUseCase ? `Casos de uso principales: Entre los usuarios avanzados, el principal motivo de uso es "${topUseCase[0]}".` : ''
  ];

  return insights.filter(Boolean);
}

function groupBy(data: AssessmentData[], key: keyof AssessmentData): Record<string, AssessmentData[]> {
  return data.reduce((acc, curr) => {
    const k = String(curr[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(curr);
    return acc;
  }, {} as Record<string, AssessmentData[]>);
}
