import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import Layout from './components/Layout';

// Import des nouvelles pages
import LoginPage from './pages/LoginPage'; 
import RegisterPage from './pages/RegisterPage';
// --- 1. IMPORTATION DE LA NOUVELLE PAGE ---
import VerifyEmailPage from './pages/VerifyEmailPage'; 

// Import des fonctions d'authentification depuis api.js
import { login as apiLogin, register as apiRegister, logout as apiLogout, getCurrentUser } from './api';

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

  // Fonction de connexion
  const login = async (email, password) => {
    try {
      await apiLogin(email, password); 
      const response = await getCurrentUser(); 
      setUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Failed to login", error);
      throw error; 
    }
  };

  // --- 2. MODIFICATION DE LA FONCTION D'INSCRIPTION ---
  // Elle n'essaie plus de se connecter automatiquement.
  const register = async (email, password) => {
    try {
      // On se contente de créer l'utilisateur.
      // Le backend enverra l'e-mail.
      await apiRegister(email, password);
      // On ne fait PAS 'await login()' ici.
    } catch (error) {
      console.error("Failed to register", error);
      throw error; // Renvoie l'erreur (ex: "Email already registered")
    }
  };
  // --- FIN MODIFICATION ---


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
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};


// --- Route Protégée (Mise à jour) ---
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

// --- Route Publique (Nouvelle) ---
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

// --- Composant App principal (Mis à jour) ---
function App() {
  return (
    <Router>
      <AuthProvider> 
        <Routes>
          {/* --- 3. AJOUT DE LA NOUVELLE ROUTE --- */}
          {/* C'est une page publique, mais pas enveloppée dans PublicRoute 
              car on doit y accéder même si on est "à moitié" authentifié. */}
          <Route
            path="/verify-email"
            element={<VerifyEmailPage />}
          />
          {/* --- FIN AJOUT --- */}

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