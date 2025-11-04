import React, { useState } from 'react';
import { Link } from 'react-router-dom';
// On importe les fonctions API directement
import { requestPasswordReset } from '../api'; 
import { Wallet, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'; 

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // On appelle directement l'API
      const response = await requestPasswordReset(email);
      // On affiche le message de succès (le même quoi qu'il arrive)
      setSuccessMessage(response.data.message);
    } catch (err) {
      // Normalement, notre backend ne renvoie jamais d'erreur ici,
      // mais en cas d'erreur 500 (SendGrid mal configuré), on l'affiche.
      setError("Une erreur de serveur est survenue. Veuillez réessayer plus tard.");
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
            Mot de passe oublié ?
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          
          {/* Si le message de succès est affiché, on cache le formulaire */}
          {successMessage ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="bg-green-100 rounded-full p-3">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-800">Vérifiez vos e-mails</h3>
              <p className="text-sm text-gray-600">
                {successMessage}
              </p>
              <Link
                to="/login"
                className="w-full inline-flex justify-center items-center bg-gray-600 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:shadow-lg hover:bg-gray-700 transition-all duration-200"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Retour à la connexion
              </Link>
            </div>
          ) : (
            // --- FORMULAIRE DE DEMANDE ---
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Entrez votre adresse e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Champ E-mail */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse e-mail
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </span>
                  <input
                    id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required autoFocus
                    className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="vous@exemple.com"
                  />
                </div>
              </div>

              {/* Bouton de validation */}
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-gradient-to-r from-primary-600 to-success-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? ( <span><svg className="animate-spin h-5 w-5 mr-3 inline" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Envoi...</span> ) : ( 'Envoyer le lien' )}
              </button>
            </form>
          )}

          {/* Lien Retour (uniquement si le succès n'est pas affiché) */}
          {!successMessage && (
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm font-semibold text-gray-600 hover:text-gray-700">
                &larr; Retour à la connexion
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;

