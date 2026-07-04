/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { Dashboard } from './components/Dashboard';
import { parseExcelFile, AssessmentData } from './lib/parser';

export default function App() {
  const [data, setData] = useState<AssessmentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const parsedData = await parseExcelFile(file);
      setData(parsedData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al procesar el archivo Excel. Asegúrate de que el formato sea correcto.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setData([]);
    setError(null);
  };

  if (data.length > 0) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans">
        <Dashboard data={data} onReset={handleReset} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
          AI Readiness Assessment
        </h1>
        <p className="text-slate-500">
          Sube los resultados de la encuesta para generar el dashboard interactivo.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg max-w-2xl w-full text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Procesando datos...</p>
        </div>
      ) : (
        <FileUploader onFileSelect={handleFileSelect} />
      )}
    </div>
  );
}

