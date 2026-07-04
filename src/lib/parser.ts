import * as XLSX from 'xlsx';

export interface AssessmentData {
  puntaje: number;
  nivel: string;
  pais: string;
  area: string;
  level: string;
  candidato: string;
  email: string;
  frecuencia: string;
  motivos: string[];
}

export function parseExcelFile(file: File): Promise<AssessmentData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames.find(s => s.trim() === 'Reporte 37 - Respuestas') || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          throw new Error('El archivo no tiene el formato esperado (faltan filas de encabezado).');
        }

        // Header is row 2 (index 1)
        const headerRow = rows[1] || [];
        
        let puntajeIdx = -1, nivelIdx = -1, paisIdx = -1, candidatoIdx = -1, emailIdx = -1;
        let freqIdx = -1, motivoIdx = -1;
        
        headerRow.forEach((header: any, index: number) => {
          if (!header) return;
          const hStr = String(header).trim().toLowerCase();
          if (hStr === 'puntaje' || hStr === 'score') puntajeIdx = index;
          if (hStr === 'nivel' || hStr === 'level (ai)') nivelIdx = index;
          if (hStr === 'país' || hStr === 'pais' || hStr === 'country') paisIdx = index;
          if (hStr === 'candidato' || hStr === 'nombre') candidatoIdx = index;
          if (hStr === 'email' || hStr === 'correo' || hStr === 'id') emailIdx = index;
          if (hStr.startsWith('¿con qué frecuencia') || hStr.includes('frecuencia')) freqIdx = index;
          if (hStr.startsWith('¿para qué tipo de tareas') || hStr.includes('tipo de tareas') || hStr.includes('motivo')) motivoIdx = index;
        });

        // Some fallbacks if specific headers aren't found based on strict match
        if (puntajeIdx === -1) puntajeIdx = headerRow.findIndex(h => String(h).toLowerCase().includes('puntaje'));
        if (nivelIdx === -1) nivelIdx = headerRow.findIndex(h => String(h).toLowerCase().includes('nivel'));

        const parsedData: AssessmentData[] = [];
        const seenEmails = new Set<string>();

        // Data starts from row 3 (index 2)
        for (let i = 2; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || row.every((c: any) => c === null || c === undefined || String(c).trim() === '')) {
            continue;
          }

          let puntajeVal = puntajeIdx !== -1 ? row[puntajeIdx] : 0;
          let puntaje = parseFloat(String(puntajeVal).replace(',', '.'));
          if (isNaN(puntaje)) puntaje = 0;

          let rawNivel = nivelIdx !== -1 && row[nivelIdx] ? String(row[nivelIdx]).trim() : '';
          let nivel = '';
          
          if (!rawNivel) {
            if (puntaje >= 90) nivel = 'AI Champion - Avanzado';
            else if (puntaje >= 70) nivel = 'AI Courier - Intermedio/Alto';
            else if (puntaje >= 41) nivel = 'AI Ready - Intermedio/bajo';
            else nivel = 'AI Explorer - Inicial';
          } else {
            const nLower = rawNivel.toLowerCase();
            if (nLower.includes('champion') || nLower.includes('avanzado')) nivel = 'AI Champion - Avanzado';
            else if (nLower.includes('courier') || nLower.includes('alto')) nivel = 'AI Courier - Intermedio/Alto';
            else if (nLower.includes('ready') || nLower.includes('bajo')) nivel = 'AI Ready - Intermedio/bajo';
            else if (nLower.includes('explorer') || nLower.includes('inicial')) nivel = 'AI Explorer - Inicial';
            else nivel = rawNivel; // fallback
          }

          let pais = paisIdx !== -1 && row[paisIdx] ? String(row[paisIdx]).trim() : 'Desconocido';
          
          // Column I = 8, Column J = 9
          let area = row[8] ? String(row[8]).trim() : 'Desconocido';
          let level = row[9] ? String(row[9]).trim() : 'Desconocido';
          
          let candidato = candidatoIdx !== -1 && row[candidatoIdx] ? String(row[candidatoIdx]).trim() : `Participante ${i}`;
          let email = emailIdx !== -1 && row[emailIdx] ? String(row[emailIdx]).trim() : candidato;

          let frecuencia = freqIdx !== -1 && row[freqIdx] ? String(row[freqIdx]).trim() : 'No utilizo IA';
          if (!frecuencia || frecuencia.toLowerCase() === 'null') frecuencia = 'No utilizo IA';
          
          let motivoStr = motivoIdx !== -1 && row[motivoIdx] ? String(row[motivoIdx]) : '';
          let motivos = motivoStr.split(',')
            .map(m => m.trim())
            .filter(Boolean);
          
          if (motivos.length === 0 || motivos.includes('No utilizo IA') || motivos.includes('null')) {
            motivos = ['No utilizo IA'];
          }

          // Deduplication
          const id = email || candidato;
          if (seenEmails.has(id)) {
            continue;
          }
          seenEmails.add(id);

          parsedData.push({
            puntaje,
            nivel,
            pais,
            area,
            level,
            candidato,
            email,
            frecuencia,
            motivos
          });
        }

        resolve(parsedData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
