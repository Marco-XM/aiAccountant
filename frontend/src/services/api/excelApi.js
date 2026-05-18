// frontend/src/services/api/excelApi.js
const normalizeApiBase = (value) => {
  const base = String(value || '').replace(/\/$/, '');
  if (!base) return '/api';
  return base.endsWith('/api') ? base : `${base}/api`;
};

const API_BASE = normalizeApiBase(
  import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    '/api',
);

export const excelApi = {
  /**
   * Upload file
   */
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/excel/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },

  /**
   * Get file metadata
   */
  getFileMetadata: async (fileId) => {
    const response = await fetch(`${API_BASE}/excel/${fileId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) throw new Error('Failed to get file metadata');
    return response.json();
  },

  /**
   * Get file data
   */
  getFileData: async (fileId, sheet = null) => {
    const url = new URL(
      `${API_BASE}/excel/${fileId}/data`,
      window.location.origin,
    );
    if (sheet) url.searchParams.append('sheet', sheet);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) throw new Error('Failed to load file data');
    return response.json();
  },

  /**
   * Apply changes
   */
  applyChanges: async (fileId, changes, metadata = {}) => {
    const response = await fetch(`${API_BASE}/excel/${fileId}/changes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        changes,
        metadata,
      }),
    });

    if (!response.ok) throw new Error('Failed to apply changes');
    return response.json();
  },

  /**
   * Auto-save changes
   */
  autoSave: async (fileId, { changes, clientTimestamp }) => {
    const response = await fetch(`${API_BASE}/excel/${fileId}/auto-save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        changes,
        clientTimestamp,
      }),
    });

    if (!response.ok) throw new Error('Auto-save failed');
    return response.json();
  },

  /**
   * Export file
   */
  exportFile: async (fileId, format = 'xlsx') => {
    const url = new URL(`${API_BASE}/excel/${fileId}/export`, window.location.origin);
    url.searchParams.append('format', format);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  },

  /**
   * Get versions
   */
  getVersions: async (fileId, page = 1, limit = 20) => {
    const url = new URL(`${API_BASE}/excel/${fileId}/versions`, window.location.origin);
    url.searchParams.append('page', page);
    url.searchParams.append('limit', limit);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) throw new Error('Failed to get versions');
    return response.json();
  },

  /**
   * Restore version
   */
  restoreVersion: async (fileId, versionId) => {
    const response = await fetch(
      `${API_BASE}/excel/${fileId}/restore/${versionId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    if (!response.ok) throw new Error('Failed to restore version');
    return response.json();
  },

  /**
   * Get audit log
   */
  getAuditLog: async (fileId, startDate = null, endDate = null, page = 1) => {
    const url = new URL(`${API_BASE}/excel/${fileId}/audit`, window.location.origin);
    if (startDate) url.searchParams.append('startDate', startDate);
    if (endDate) url.searchParams.append('endDate', endDate);
    url.searchParams.append('page', page);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) throw new Error('Failed to get audit log');
    return response.json();
  },

  /**
   * Delete file
   */
  deleteFile: async (fileId) => {
    const response = await fetch(`${API_BASE}/excel/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) throw new Error('Failed to delete file');
    return response.json();
  },
};

export default excelApi;
