import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import Layout from './components/Layout';

// Import des pages d'authentification
import LoginPage from './pages/LoginPage'; 
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage'; 
// --- NOUVEAU : Imports pour le mot de passe oublié ---
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
// --- FIN NOUVEAUTÉ ---


// --- 1. MODIFICATION DES IMPORTS ---
import { 
  login as apiLogin, 
  mfaLogin as apiMfaLogin,
  register as apiRegister, 
  logout as apiLogout, 
  getCurrentUser,
  // --- AJOUT DEVISE ---
  updateUserCurrency as apiUpdateCurrency 
  // --- FIN AJOUT DEVISE ---
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
  const [isLoading, setIsLoading] = useState(true); 

  // Effet pour vérifier le statut de l'authentification au chargement de l'app
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const response = await getCurrentUser(); 
          // 'response.data' contient maintenant { id, email, mfa_enabled, currency }
          setUser(response.data); 
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

  // --- 2. MODIFICATION DE LA FONCTION DE CONNEXION (Identique) ---
  
  /**
   * Étape 1 de la connexion (e-mail/mot de passe).
   */
  const login = async (email, password) => {
    try {
      const response = await apiLogin(email, password);
      return response.data; // On renvoie .data
    } catch (error) {
      console.error("Failed login step 1", error);
      throw error; 
    }
  };

  /**
   * Étape 2 de la connexion (Code MFA).
   */
  const loginWithMfa = async (mfaToken, mfaCode) => {
    try {
      const response = await apiMfaLogin(mfaToken, mfaCode);
      return response.data; // On renvoie .data
    } catch (error) {
      console.error("Failed login step 2 (MFA)", error);
      throw error;
    }
  };

  /**
   * Étape finale : L'authentification est réussie.
   */
  const completeLogin = async (accessToken) => {
    try {
      localStorage.setItem('authToken', accessToken);
      const response = await getCurrentUser();
      // 'response.data' contient maintenant la devise
      setUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Failed to complete login", error);
      apiLogout(); 
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
    apiLogout(); 
    setUser(null);
    setIsAuthenticated(false);
  };

  // --- AJOUT DEVISE : Nouvelle fonction pour mettre à jour la devise ---
  /**
   * Met à jour la devise dans le backend et dans l'état local.
   * @param {string} currency - Le nouveau code de devise (ex: "USD")
   */
  const updateCurrency = async (currency) => {
    try {
      // 1. Appelle l'API pour sauvegarder le changement
      const response = await apiUpdateCurrency(currency);
      
      // 2. Met à jour l'état local 'user' avec les nouvelles données
      //    'response.data' devrait renvoyer l'utilisateur mis à jour
      setUser(response.data);
      
    } catch (error) {
      console.error("Failed to update currency", error);
      // Gérer l'erreur (par exemple, afficher une notification à l'utilisateur)
      throw error;
    }
  };
  // --- FIN AJOUT DEVISE ---

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
    // --- AJOUT DEVISE ---
    updateCurrency, // On expose la nouvelle fonction
    // --- FIN AJOUT DEVISE ---
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
    // Vous pouvez remplacer ceci par un joli spinner de chargement
    return <div className="flex justify-center items-center min-h-screen">Chargement...</div>; 
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
    // Vous pouvez remplacer ceci par un joli spinner de chargement
    return <div className="flex justify-center items-center min-h-screen">Chargement...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// --- Composant App principal ---
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

          {/* --- NOUVEAU : Ajout des routes publiques --- */}
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicRoute>
                <ResetPasswordPage />
              </PublicRoute>
            }
          />
          {/* --- FIN NOUVEAUTÉ --- */}


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

