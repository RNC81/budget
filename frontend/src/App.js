import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import Layout from './components/Layout';

// Import des nouvelles pages (que nous allons créer)
import LoginPage from './pages/LoginPage'; 
import RegisterPage from './pages/RegisterPage';

// Import des fonctions d'authentification depuis api.js
import { login as apiLogin, register as apiRegister, logout as apiLogout, getCurrentUser } from './api';

// --- 1. Création du Contexte d'Authentification ---
const AuthContext = createContext(null);

/**
 * Hook personnalisé pour accéder facilement au contexte d'authentification
 */
export const useAuth = () => useContext(AuthContext);

// --- 2. Création du Fournisseur d'Authentification ---
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
          // L'intercepteur d'api.js ajoutera le token
          const response = await getCurrentUser(); 
          setUser(response.data);
          setIsAuthenticated(true);
        } catch (error) {
          // Le token est invalide ou expiré
          apiLogout(); // Nettoie le localStorage
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      setIsLoading(false); // Fin du chargement
    };

    checkAuthStatus();
  }, []);

  // Fonction de connexion
  const login = async (email, password) => {
    try {
      await apiLogin(email, password); // Stocke le token
      const response = await getCurrentUser(); // Récupère les infos utilisateur
      setUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Failed to login", error);
      throw error; // Renvoie l'erreur pour que le composant LoginPage puisse l'afficher
    }
  };

  // Fonction d'inscription (qui connecte automatiquement)
  const register = async (email, password) => {
    try {
      await apiRegister(email, password);
      // Connecte l'utilisateur juste après l'inscription
      await login(email, password); 
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
    login,
    register,
    logout,
  };

  // Ne rend les enfants que lorsque le chargement initial est terminé
  // Sauf si on utilise un écran de chargement global
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};


// --- 3. Route Protégée (Mise à jour) ---
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // Affiche un état de chargement pendant la vérification du token
    return <div>Chargement de l'application...</div>; 
  }

  if (!isAuthenticated) {
    // Redirige vers la page de connexion
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// --- 4. Route Publique (Nouvelle) ---
function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Chargement de l'application...</div>;
  }

  if (isAuthenticated) {
    // Redirige vers le tableau de bord si l'utilisateur est déjà connecté
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// --- 5. Composant App principal (Mis à jour) ---
function App() {
  return (
    <Router>
      <AuthProvider> {/* Le fournisseur enveloppe toutes les routes */}
        <Routes>
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