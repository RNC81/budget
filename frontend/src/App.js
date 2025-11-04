import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import Layout from './components/Layout';

// Import des nouvelles pages
import LoginPage from './pages/LoginPage'; 
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage'; 

// --- 1. MODIFICATION DES IMPORTS ---
// On importe les fonctions *spécifiques* de l'API dont on aura besoin
import { 
  login as apiLogin, 
  mfaLogin as apiMfaLogin, // Import de la nouvelle fonction
  register as apiRegister, 
  logout as apiLogout, 
  getCurrentUser 
} from './api';

// --- Création du Contexte d'Authentification ---
const AuthContext = createContext(null);

/**
 * Hook personnalisé pour accéder facilement au contexte d'authentification
 */
export const useAuth = () => useContext(AuthContext);

// --- Création du Fournisseur d'Authentification ---
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Pour le chargement initial

  // Effet pour vérifier le statut de l'authentification au chargement de l'app
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const response = await getCurrentUser(); 
          setUser(response.data); // Stocke l'utilisateur (avec mfa_enabled)
          setIsAuthenticated(true);
        } catch (error) {
          apiLogout(); 
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      setIsLoading(false); 
    };

    checkAuthStatus();
  }, []);

  // --- 2. MODIFICATION DE LA FONCTION DE CONNEXION ---
  
  /**
   * Étape 1 de la connexion (e-mail/mot de passe).
   * N'authentifie PAS l'utilisateur, mais renvoie la réponse du backend.
   */
  const login = async (email, password) => {
    try {
      const response = await apiLogin(email, password);
      // Renvoie la réponse (ex: { mfa_required: true, mfa_token: '...' })
      // ou { mfa_required: false, access_token: '...' }
      return response.data; // On renvoie .data
    } catch (error) {
      console.error("Failed login step 1", error);
      throw error; 
    }
  };

  /**
   * Étape 2 de la connexion (Code MFA).
   * N'authentifie PAS l'utilisateur, mais renvoie le token d'accès final.
   */
  const loginWithMfa = async (mfaToken, mfaCode) => {
    try {
      const response = await apiMfaLogin(mfaToken, mfaCode);
      // Renvoie la réponse (ex: { access_token: '...' })
      return response.data; // On renvoie .data
    } catch (error) {
      console.error("Failed login step 2 (MFA)", error);
      throw error;
    }
  };

  /**
   * Étape finale : L'authentification est réussie.
   * Met à jour l'état de l'application.
   */
  const completeLogin = async (accessToken) => {
    try {
      localStorage.setItem('authToken', accessToken);
      // On re-récupère l'utilisateur pour avoir les infos à jour
      const response = await getCurrentUser();
      setUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Failed to complete login", error);
      apiLogout(); // Nettoyage en cas d'échec
      throw error;
    }
  };

  // Fonction d'inscription
  const register = async (email, password) => {
    try {
      await apiRegister(email, password);
    } catch (error) {
      console.error("Failed to register", error);
      throw error; 
    }
  };


  // Fonction de déconnexion
  const logout = () => {
    apiLogout(); // Nettoie le localStorage
    setUser(null);
    setIsAuthenticated(false);
  };

  // Valeur fournie par le contexte
  const value = {
    user,
    isAuthenticated,
    isLoading,
    login, // Étape 1
    loginWithMfa, // Étape 2
    completeLogin, // Étape finale
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};


// --- Route Protégée (Identique) ---
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Chargement de l'application...</div>; 
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// --- Route Publique (Identique) ---
function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Chargement de l'application...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// --- Composant App principal (Identique) ---
function App() {
  return (
    <Router>
      <AuthProvider> 
        <Routes>
          <Route
            path="/verify-email"
            element={<VerifyEmailPage />}
          />

          {/* Routes publiques (Connexion / Inscription) */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />

          {/* Routes protégées (Application principale) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Layout>
                  <Transactions />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />
          
          {/* Redirection par défaut */}
          <Route path="/" element={<Navigate to="/dashboard" />} />
          
          {/* Redirection pour l'ancienne page d'accès */}
          <Route path="/access-code" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;