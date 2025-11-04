import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

// Crée une instance axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Intercepteur de Requête ---
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Intercepteur de Réponse ---
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // --- MODIFICATION : Ajout des nouvelles routes ---
      // Ne pas déconnecter sur les pages publiques
      const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
      if (!publicPaths.includes(window.location.pathname)) {
        localStorage.removeItem('authToken');
        window.location.href = '/login';
        return Promise.reject(new Error('Session expirée, veuillez vous reconnecter.'));
      }
    }
    return Promise.reject(error);
  }
);


// --- Fonctions d'Authentification ---

export const login = async (email, password) => {
  const params = new URLSearchParams();
  params.append('username', email); 
  params.append('password', password);

  const response = await api.post('/api/auth/token', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return response;
};

export const mfaLogin = async (mfaToken, mfaCode) => {
  const response = await api.post('/api/auth/mfa-login', {
    mfa_token: mfaToken,
    mfa_code: mfaCode,
  });
  return response;
};

export const register = async (email, password) => {
  return await api.post('/api/auth/register', { email, password });
};

export const logout = () => {
  localStorage.removeItem('authToken');
};

export const getCurrentUser = async () => {
  return await api.get('/api/users/me');
};


// --- Fonctions de Gestion MFA ---

export const mfaSetup = async () => {
  return await api.get('/api/mfa/setup');
};

export const mfaVerify = async (mfaCode) => {
  return await api.post('/api/mfa/verify', { mfa_code: mfaCode });
};

export const mfaDisable = async (password, mfaCode) => {
  return await api.post('/api/mfa/disable', {
    password: password,
    mfa_code: mfaCode,
  });
};

// --- Fonctions de réinitialisation de mot de passe ---

export const requestPasswordReset = async (email) => {
  return await api.post('/api/auth/forgot-password', {
    email: email,
  });
};

export const resetPassword = async (token, newPassword) => {
  return await api.post('/api/auth/reset-password', {
    token: token,
    new_password: newPassword,
  });
};
// --- FIN NOUVEAUTÉ ---

// --- NOUVEAU : Fonctions de Gestion des Budgets ---

/**
 * Récupère tous les budgets de l'utilisateur.
 */
export const getBudgets = async () => {
  return await api.get('/api/budgets');
};

/**
 * Crée un nouveau budget.
 * @param {string} categoryId - L'ID de la catégorie.
 * @param {number} amount - Le montant du budget.
 */
export const createBudget = async (categoryId, amount) => {
  return await api.post('/api/budgets', {
    category_id: categoryId,
    amount: amount,
  });
};

/**
 * Met à jour le montant d'un budget existant.
 * @param {string} budgetId - L'ID du budget.
 * @param {number} amount - Le nouveau montant.
 */
export const updateBudget = async (budgetId, amount) => {
  return await api.put(`/api/budgets/${budgetId}`, {
    amount: amount,
  });
};

/**
 * Supprime un budget.
 * @param {string} budgetId - L'ID du budget.
 */
export const deleteBudget = async (budgetId) => {
  return await api.delete(`/api/budgets/${budgetId}`);
};
// --- FIN NOUVEAUTÉ ---


export default api;

