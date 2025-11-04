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
      
      // --- MODIFICATION : Ne pas déconnecter sur la page de connexion ---
      // Si l'erreur 401 se produit AILLEURS que sur /login
      // (par ex: token expiré sur le dashboard), alors on déconnecte.
      // Si l'erreur 401 se produit sur /login (mot de passe incorrect),
      // on laisse le composant gérer l'erreur.
      if (window.location.pathname !== '/login') {
         localStorage.removeItem('authToken');
         window.location.href = '/login';
         return Promise.reject(new Error('Session expirée, veuillez vous reconnecter.'));
      }
    }
    
    // Pour toutes les autres erreurs (y compris 401 sur /login), on les retourne
    return Promise.reject(error);
  }
);


// --- Fonctions d'Authentification ---

/**
 * Étape 1 de la connexion (Email/Pass).
 * Renvoie la réponse du backend (soit un token d'accès, soit une demande MFA).
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

  // --- MODIFICATION ---
  // On ne sauvegarde PLUS le token ici.
  // On renvoie la réponse complète pour que App.js puisse la traiter.
  return response;
};

// --- NOUVELLE FONCTION ---
/**
 * Étape 2 de la connexion (Code MFA).
 * Envoie le token temporaire et le code MFA.
 */
export const mfaLogin = async (mfaToken, mfaCode) => {
  const response = await api.post('/api/auth/mfa-login', {
    mfa_token: mfaToken,
    mfa_code: mfaCode,
  });
  // Ceci renverra le token d'accès final si le code est bon
  return response;
};
// --- FIN NOUVEAUTÉ ---


/**
 * Gère l'inscription d'un nouvel utilisateur.
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


// --- NOUVELLES FONCTIONS DE GESTION MFA (POUR LES PARAMÈTRES) ---

/**
 * Demande au backend de générer un nouveau secret MFA et un QR code.
 */
export const mfaSetup = async () => {
  return await api.get('/api/mfa/setup');
};

/**
 * Vérifie le code MFA pour finaliser l'activation.
 */
export const mfaVerify = async (mfaCode) => {
  return await api.post('/api/mfa/verify', { mfa_code: mfaCode });
};

/**
 * Demande la désactivation du MFA (nécessite mot de passe + code MFA).
 */
export const mfaDisable = async (password, mfaCode) => {
  return await api.post('/api/mfa/disable', {
    password: password,
    mfa_code: mfaCode,
  });
};
// --- FIN NOUVEAUTÉ ---


// On exporte l'instance 'api' par défaut pour les appels classiques
export default api;