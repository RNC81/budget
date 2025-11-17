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

// --- NOUVEAU : Import de l'instance 'api' et de 'Loader' ---
import api from './api';
import { Loader } from 'lucide-react';
// --- FIN NOUVEAU ---

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

// --- Composant App principal (MODIFIÉ) ---
function App() {
  
  // --- NOUVEAU : État pour le démarrage à froid de Render ---
  const [isServerReady, setIsServerReady] = useState(false);

  useEffect(() => {
    console.log("Ping du serveur pour le démarrage (cold start)...");
    
    // On appelle l'API de santé pour "réveiller" le backend
    // S'il dort, cet appel prendra 20-40s.
    api.get('/api/health')
      .then(() => console.log("Réponse du serveur reçue."))
      .catch((err) => console.warn("Échec du ping de démarrage. (C'est peut-être un problème de réseau, on continue)", err))
      .finally(() => {
        // Que l'appel ait réussi ou échoué, on essaie de_
        // de toute façon d'afficher l'application.
        console.log("Démarrage terminé. Affichage de l'application.");
        setIsServerReady(true);
      });
  }, []); // [] = s'exécute une seule fois au montage de l'app

  // --- NOUVEAU : Affichage de l'écran de chargement ---
  if (!isServerReady) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50 text-center px-4">
        <Loader className="h-12 w-12 animate-spin text-primary-600" />
        <h1 className="text-2xl font-semibold text-gray-800 mt-6">
          Connexion au service sécurisé...
        </h1>
        <p className="text-gray-600 mt-2">
          Le démarrage peut prendre jusqu'à 40 secondes.
        </p>
        <p className="text-gray-600 mt-1">
          (Mise en route du serveur)
        </p>
      </div>
    );
  }

  // --- L'application normale s'affiche seulement après le réveil ---
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