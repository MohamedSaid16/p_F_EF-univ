// frontend/src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true, // send cookies automatically (their auth system)
});

// No need for manual token injection — cookies are sent automatically
// But keep Bearer fallback for compatibility
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 — fire logout event
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  }
);

// ─── Auth ──────────────────────────────────────────────────
export const login          = (d) => api.post('/auth/login', d);
export const getMe          = ()  => api.get('/auth/me');
export const changePassword = (d) => api.post('/auth/change-password', d);

// ─── Conseils ──────────────────────────────────────────────
export const getConseils      = (p)           => api.get('/cd/conseils', { params: p });
export const getConseil       = (id)          => api.get(`/cd/conseils/${id}`);
export const createConseil    = (d)           => api.post('/cd/conseils', d);
export const updateConseil    = (id, d)       => api.patch(`/cd/conseils/${id}`, d);
export const deleteConseil    = (id)          => api.delete(`/cd/conseils/${id}`);
export const finaliserConseil = (id, drafts)  => api.patch(`/cd/conseils/${id}/finaliser`, { drafts });
export const addMembre        = (cid, d)      => api.post(`/cd/conseils/${cid}/membres`, d);
export const removeMembre     = (cid, mid)    => api.delete(`/cd/conseils/${cid}/membres/${mid}`);

// ─── Dossiers ──────────────────────────────────────────────
export const getDossiers    = (p)     => api.get('/cd/dossiers-disciplinaires', { params: p });
export const getDossier     = (id)    => api.get(`/cd/dossiers-disciplinaires/${id}`);
export const createDossier  = (d)     => api.post('/cd/dossiers-disciplinaires', d);
export const updateDossier  = (id, d) => api.patch(`/cd/dossiers-disciplinaires/${id}`, d);
export const deleteDossier  = (id)    => api.delete(`/cd/dossiers-disciplinaires/${id}`);

// ─── Reference tables ──────────────────────────────────────
export const getInfractions = () => api.get('/cd/infractions');
export const getDecisions   = () => api.get('/cd/decisions');

// ─── Enseignants + Etudiants (other groups' endpoints) ─────
export const getEnseignants = () => api.get('/enseignants');
export const getEtudiants   = () => api.get('/etudiants');

export default api;
