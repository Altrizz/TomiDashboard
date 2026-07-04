import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileUploaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onFileSelect: (file: File) => void;
  className?: string;
}

export function FileUploader({ onFileSelect, className, ...props }: FileUploaderProps) {
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center w-full max-w-2xl h-64 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:bg-slate-100 cursor-pointer",
        className
      )}
      {...props}
    >
      <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
        <UploadCloud className="w-12 h-12 mb-4 text-slate-400" />
        <p className="mb-2 text-sm text-slate-500 font-semibold">
          <span className="text-blue-600">Click para subir</span> o arrastra y suelta
        </p>
        <p className="text-xs text-slate-400 text-center px-4">
          Sube tu archivo Excel (.xlsx) de resultados.<br/>Asegúrate que la hoja se llame "Reporte 37 - Respuestas".
        </p>
        <input
          type="file"
          className="hidden"
          accept=".xlsx, .xls"
          onChange={onFileInput}
        />
      </label>
    </div>
  );
}
