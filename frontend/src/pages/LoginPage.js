import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App'; // Importe le hook d'authentification
// Ajout de l'icône ShieldCheck pour le MFA
import { Wallet, Lock, AlertCircle, Mail, ShieldCheck } from 'lucide-react'; 

function LoginPage() {
  // --- 1. MISE À JOUR DES IMPORTS useAuth ---
  // On récupère toutes les nouvelles fonctions de notre Contexte
  const { login, loginWithMfa, completeLogin } = useAuth(); 
  
  // --- 2. NOUVELLE GESTION D'ÉTAT ---
  const [loginStep, setLoginStep] = useState('credentials'); // 'credentials' ou 'mfa'
  
  // États pour l'étape 1
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // États pour l'étape 2
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  // États globaux
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // --- FIN GESTION D'ÉTAT ---


  // --- 3. GESTIONNAIRE POUR L'ÉTAPE 1 (E-mail/Mot de passe) ---
  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Appelle la fonction login (étape 1) de App.js
      const response = await login(email, password);

      if (response.mfa_required) {
        // --- CAS 1: MFA REQUIS ---
        setMfaToken(response.mfa_token); // Stocke le token temporaire
        setLoginStep('mfa'); // Passe à l'étape 2 (MFA)
        setLoading(false);
        setPassword(''); // Efface le mot de passe pour la sécurité
      } else {
        // --- CAS 2: CONNEXION NORMALE (MFA DÉSACTIVÉ) ---
        // On a reçu le token d'accès final, on finalise la connexion
        await completeLogin(response.access_token);
        // La redirection est gérée par PublicRoute dans App.js
      }
    } catch (err) {
      // Gère les erreurs de l'étape 1 (Mot de passe incorrect, e-mail non vérifié...)
      if (err.response && err.response.data && err.response.data.detail) {
        if (err.response.data.detail.includes("Email not verified")) {
          setError("Votre compte n'est pas vérifié. Veuillez consulter le lien envoyé à votre adresse e-mail (vérifiez aussi vos spams).");
        } else {
          setError('E-mail ou mot de passe incorrect.');
        }
      } else {
        setError('E-mail ou mot de passe incorrect.');
      }
      setLoading(false); 
    }
  };

  // --- 4. NOUVEAU GESTIONNAIRE POUR L'ÉTAPE 2 (Code MFA) ---
  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Appelle la fonction login (étape 2) de App.js
      const response = await loginWithMfa(mfaToken, mfaCode);

      // On a reçu le token d'accès final, on finalise la connexion
      await completeLogin(response.access_token);
      // La redirection est gérée par PublicRoute dans App.js

    } catch (err) {
      // Gère les erreurs de l'étape 2 (Code MFA incorrect, session expirée)
      if (err.response && err.response.data && err.response.data.detail) {
         if (err.response.data.detail.includes("Invalid MFA code")) {
           setError('Code de vérification incorrect.');
         } else {
           setError('Session MFA expirée. Veuillez vous reconnecter.');
           setLoginStep('credentials'); // Renvoie à l'étape 1
         }
      } else {
        setError('Une erreur est survenue lors de la vérification MFA.');
      }
      setLoading(false);
    }
  };
  
  // --- 5. NOUVEAU GESTIONNAIRE POUR LE BOUTON "RETOUR" ---
  const goBackToCredentials = () => {
    setLoginStep('credentials');
    setError('');
    setMfaToken('');
    setMfaCode('');
    setPassword(''); // S'assure que le mot de passe est vide
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-success-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo et Titre (identique) */}
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
            {loginStep === 'credentials' 
              ? "Connectez-vous à votre compte pour continuer"
              : "Vérification en deux étapes"
            }
          </p>
        </div>

        {/* --- 6. AFFICHAGE CONDITIONNEL DES FORMULAIRES --- */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          
          {loginStep === 'credentials' ? (
            
            // --- FORMULAIRE ÉTAPE 1 (E-MAIL/MOT DE PASSE) ---
            <form onSubmit={handleCredentialSubmit} className="space-y-6">
              <div className="flex justify-center">
                <div className="bg-primary-100 rounded-full p-3">
                  <Lock className="h-8 w-8 text-primary-600" />
                </div>
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

              {/* Champ Mot de passe */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </span>
                  <input
                    id="password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Bouton de validation Étape 1 */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-gradient-to-r from-primary-600 to-success-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? ( <span><svg className="animate-spin h-5 w-5 mr-3 inline" viewBox="0 0 24 24">...</svg>Connexion...</span> ) : ( 'Connexion' )}
              </button>
            </form>

          ) : (
            
            // --- FORMULAIRE ÉTAPE 2 (CODE MFA) ---
            <form onSubmit={handleMfaSubmit} className="space-y-6">
              <div className="flex justify-center">
                <div className="bg-blue-100 rounded-full p-3">
                  <ShieldCheck className="h-8 w-8 text-blue-600" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Ouvrez votre application d'authentification et entrez le code à 6 chiffres pour l'utilisateur <strong className="text-gray-800">{email}</strong>.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Champ Code MFA */}
              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 mb-2">
                  Code de vérification (6 chiffres)
                </label>
                <div className="relative">
                  <input
                    id="mfa-code" type="text" value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    required autoFocus maxLength={6}
                    className="w-full px-4 py-3 text-center tracking-[0.3em] text-lg rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••"
                  />
                </div>
              </div>

              {/* Bouton de validation Étape 2 */}
              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? ( <span><svg className="animate-spin h-5 w-5 mr-3 inline" viewBox="0 0 24 24">...</svg>Vérification...</span> ) : ( 'Vérifier et se connecter' )}
              </button>
            </form>

          )}

          {/* --- 7. LIEN CONDITIONNEL (RETOUR ou INSCRIPTION) --- */}
          <div className="mt-6 text-center">
            {loginStep === 'mfa' ? (
              <button
                onClick={goBackToCredentials}
                className="text-sm font-semibold text-gray-600 hover:text-gray-700"
              >
                &larr; Retour (e-mail/mot de passe)
              </button>
            ) : (
              <p className="text-sm text-gray-600">
                Pas encore de compte ?{' '}
                <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700">
                  Créez-en un
                </Link>
              </p>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}

export default LoginPage;