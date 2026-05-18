// frontend/src/components/ExcelEditor/ExcelUploadPage.jsx
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import excelApi from '../../services/api/excelApi';

export default function ExcelUploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = async (file) => {
    if (!file) return;

    // Validate file
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Only Excel files allowed (.xlsx, .xls, .csv)');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large (max 50MB)');
      return;
    }

    setIsLoading(true);

    try {
      const response = await excelApi.uploadFile(file);
      toast.success('File uploaded successfully!');
      navigate(`/excel/${response.fileId}`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_34%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_38%,#eef2ff_100%)] px-4 py-8 text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_34%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] dark:text-slate-50">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80 sm:p-10">
            <div className="mb-10">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600 dark:text-cyan-400">
                Excel Editor
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Upload a workbook to edit in the browser
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Edit spreadsheets with autosave, formulas, sheet tabs, versioning, and exports in a premium in-app experience.
              </p>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`group rounded-[1.75rem] border-2 border-dashed p-10 text-center transition-all duration-200 ${
                dragActive
                  ? 'border-blue-500 bg-blue-50/80 shadow-lg dark:border-cyan-400 dark:bg-cyan-950/20'
                  : 'border-slate-300 bg-slate-50/70 hover:border-blue-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-cyan-400'
              }`}
            >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
            className="hidden"
            disabled={isLoading}
          />

              <div className="mb-5 flex justify-center">
            <svg
                  className="h-16 w-16 text-slate-400 transition group-hover:text-blue-500 dark:text-slate-500 dark:group-hover:text-cyan-300"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v24a4 4 0 004 4h24a4 4 0 004-4V20m-14-8v8m0 0l3-3m-3 3l-3-3"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
              </div>

              <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {isLoading ? 'Uploading...' : 'Drop your Excel file here'}
          </h3>

              <p className="mt-3 text-slate-600 dark:text-slate-300">
            or{' '}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
                  className="font-medium text-blue-600 underline decoration-blue-300 decoration-2 underline-offset-4 transition hover:text-blue-700 disabled:opacity-50"
            >
              browse your computer
            </button>
          </p>

              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Supported formats: XLSX, XLS, CSV (max 50MB)
          </p>

          {isLoading && (
                <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-cyan-300" />
                  Processing file and preparing sheets...
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-5 shadow-lg backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
              <div className="text-3xl">✏️</div>
              <h4 className="mt-3 text-lg font-semibold">Inline editing</h4>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Click any cell to edit values directly in the grid.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-5 shadow-lg backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
              <div className="text-3xl">💾</div>
              <h4 className="mt-3 text-lg font-semibold">Autosave</h4>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Keep work protected with background saving and version history.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-5 shadow-lg backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
              <div className="text-3xl">📊</div>
              <h4 className="mt-3 text-lg font-semibold">Formulas</h4>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Render workbook formulas and preserve them on export.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-5 shadow-lg backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
              <div className="text-3xl">↩️</div>
              <h4 className="mt-3 text-lg font-semibold">Undo / Redo</h4>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Built for iterative editing with a clean recovery path.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
