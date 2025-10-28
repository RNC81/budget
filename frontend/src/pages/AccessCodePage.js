import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Lock, AlertCircle } from 'lucide-react';

function AccessCodePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Code d'accès défini en dur
  const SECRET_CODE = 'MonBudget2025';

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulation d'un délai pour l'effet visuel
    setTimeout(() => {
      if (code === SECRET_CODE) {
        // Code correct: enregistrer dans localStorage et rediriger
        localStorage.setItem('isAuthenticated', 'true');
        navigate('/dashboard');
      } else {
        // Code incorrect: afficher une erreur
        setError('Code d\'accès incorrect. Veuillez réessayer.');
        setCode('');
      }
      setLoading(false);
    }, 500);
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
            Entrez votre code d'accès pour continuer
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Icône de verrouillage */}
            <div className="flex justify-center">
              <div className="bg-primary-100 rounded-full p-3">
                <Lock className="h-8 w-8 text-primary-600" />
              </div>
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Champ de saisie */}
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                Code d'accès
              </label>
              <input
                id="code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-lg tracking-widest"
                placeholder="••••••••"
              />
            </div>

            {/* Bouton de validation */}
            <button
              type="submit"
              disabled={loading || !code}
              className="w-full bg-gradient-to-r from-primary-600 to-success-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Vérification...
                </span>
              ) : (
                'Accéder à l\'application'
              )}
            </button>
          </form>

          {/* Aide */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              🔒 Accès sécurisé par code
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccessCodePage;
