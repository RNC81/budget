import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
// On importe les fonctions API directement
import { resetPassword } from '../api'; 
import { Wallet, Lock, AlertCircle, CheckCircle, KeyRound } from 'lucide-react'; 

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Au chargement, on récupère le token de l'URL
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      setError("Token de réinitialisation manquant ou invalide. Veuillez refaire une demande.");
    }
  }, [searchParams]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (password.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    if (!token) {
      setError("Token invalide. Veuillez refaire une demande.");
      setLoading(false);
      return;
    }

    try {
      const response = await resetPassword(token, password);
      setSuccessMessage(response.data.message);
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        if (err.response.data.detail.includes("invalid or expired")) {
            setError("Le lien de réinitialisation est invalide ou a expiré. Veuillez refaire une demande.");
        } else {
            setError(err.response.data.detail);
        }
      } else {
        setError("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-success-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo et Titre */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-primary-600 to-success-600 text-white rounded-2xl p-4 shadow-xl">
              <Wallet className="h-12 w-12" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary-600 to-success-600 bg-clip-text text-transparent">
            Budget Tracker
          </h1>
          <p className="text-gray-600">
            Réinitialiser votre mot de passe
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          
          {successMessage ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="bg-green-100 rounded-full p-3">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-800">Mot de passe réinitialisé !</h3>
              <p className="text-sm text-gray-600">
                {successMessage}
              </p>
              <Link
                to="/login"
                className="w-full inline-flex justify-center items-center bg-gradient-to-r from-primary-600 to-success-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg"
              >
                Aller à la page de connexion
              </Link>
            </div>
          ) : (
            // --- FORMULAIRE DE RÉINITIALISATION ---
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex justify-center">
                <div className="bg-primary-100 rounded-full p-3">
                  <KeyRound className="h-8 w-8 text-primary-600" />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Champ Nouveau Mot de passe */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Nouveau mot de passe (min. 8 caractères)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </span>
                  <input
                    id="password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required autoFocus
                    className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Champ Confirmer Mot de passe */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </span>
                  <input
                    id="confirmPassword" type="password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Bouton de validation */}
              <button
                type="submit"
                disabled={loading || !password || !confirmPassword || !token}
                className="w-full bg-gradient-to-r from-primary-600 to-success-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? ( <span><svg className="animate-spin h-5 w-5 mr-3 inline" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Mise à jour...</span> ) : ( 'Définir le nouveau mot de passe' )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;

