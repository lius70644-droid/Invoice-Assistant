const API_BASE = '/api';

const getToken = () => localStorage.getItem('token');
const getAdminToken = () => localStorage.getItem('admin_token');

const request = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const adminToken = getAdminToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(adminToken && { Authorization: `Bearer ${adminToken}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  // 处理 CSV 下载
  if (response.headers.get('Content-Type')?.includes('text/csv')) {
    return response.blob();
  }

  return response.json();
};

// Auth
export const login = (data: { name: string; studentId: string; supervisor?: string; phone?: string }) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify(data) });

export const getUserInfo = () => request('/auth/me');

export const adminLogin = (data: { username: string; password: string }) =>
  request('/admin/login', { method: 'POST', body: JSON.stringify(data) });

// Records
export const getRecords = () => request('/records');

export const createRecord = (data: any) =>
  request('/records', { method: 'POST', body: JSON.stringify(data) });

export const deleteRecord = (id: string, isAdmin: boolean = false) => {
  const adminToken = getAdminToken();
  return request(`/records/${id}`, {
    method: 'DELETE',
    headers: {
      ...(isAdmin && adminToken ? { 'X-Admin-Mode': 'true', 'Authorization': `Bearer ${adminToken}` } : {})
    }
  });
};

export const updatePaidStatus = (id: string, isPaid: boolean) =>
  request(`/records/${id}/paid`, { method: 'PUT', body: JSON.stringify({ isPaid }) });

export const submitSurvey = (id: string, data: any) =>
  request(`/records/${id}/survey`, { method: 'PUT', body: JSON.stringify(data) });

// Admin
export const getAllRecords = () => request('/admin/records');

export const updateStatus = (id: string, status: string, rejectionReason?: string) =>
  request(`/admin/records/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, rejectionReason })
  });

export const rejectRecord = (id: string, reason: string) =>
  request(`/admin/records/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });

export const exportCSV = async () => {
  const blob = await request('/records/export');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `我的报销清单_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// 管理员导出全部数据
export const exportAllCSV = async () => {
  const blob = await request('/admin/export');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `全部报销清单_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// OCR
export const extractInvoice = (image: string, category?: string) =>
  request('/ocr/extract', { method: 'POST', body: JSON.stringify({ image, category }) });
