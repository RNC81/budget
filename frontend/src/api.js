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
// S'exécute AVANT chaque requête envoyée
api.interceptors.request.use(
  (config) => {
    // Récupère le token depuis le localStorage
    const token = localStorage.getItem('authToken');
    
    // Si le token existe, on l'ajoute à l'en-tête Authorization
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
// S'exécute APRÈS chaque réponse reçue
api.interceptors.response.use(
  (response) => {
    // Si la réponse est OK, on la retourne
    return response;
  },
  (error) => {
    // Si on reçoit une erreur 401 (Non autorisé)
    if (error.response && error.response.status === 401) {
      // Le token est invalide ou expiré
      localStorage.removeItem('authToken');
      
      // On redirige l'utilisateur vers la page de connexion
      // On utilise window.location pour forcer un rafraîchissement complet
      // et vider l'état de l'application.
      if (window.location.pathname !== '/login') {
         window.location.href = '/login';
      }

      // On retourne une promesse rejetée pour arrêter la chaîne
      return Promise.reject(new Error('Session expirée, veuillez vous reconnecter.'));
    }
    
    // Pour toutes les autres erreurs, on les retourne
    return Promise.reject(error);
  }
);


// --- Fonctions d'Authentification ---

/**
 * Tente de se connecter.
 * Note : Le backend (OAuth2PasswordRequestForm) attend des données
 * en 'application/x-www-form-urlencoded' et non en JSON.
 */
export const login = async (email, password) => {
  const params = new URLSearchParams();
  params.append('username', email); // FastAPI s'attend à 'username'
  params.append('password', password);

  const response = await api.post('/api/auth/token', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (response.data.access_token) {
    localStorage.setItem('authToken', response.data.access_token);
  }
  return response.data;
};

/**
 * Gère l'inscription d'un nouvel utilisateur.
 * (Celui-ci attend du JSON, géré par défaut par notre instance 'api')
 */
export const register = async (email, password) => {
  return await api.post('/api/auth/register', { email, password });
};

/**
 * Gère la déconnexion.
 */
export const logout = () => {
  localStorage.removeItem('authToken');
};

/**
 * Récupère les informations de l'utilisateur connecté.
 */
export const getCurrentUser = async () => {
  return await api.get('/api/users/me');
};


// On exporte l'instance 'api' par défaut pour les appels classiques
export default api;