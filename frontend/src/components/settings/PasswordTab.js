import React, { useState, useEffect } from 'react';
// 1. Importer les nouvelles fonctions de l'API et le hook useAuth
import api, { mfaSetup, mfaVerify, mfaDisable } from '../../api'; 
import { useAuth } from '../../App';
// 2. Importer de nouvelles icônes
import { Lock, AlertCircle, CheckCircle, Smartphone, Shield, Loader } from 'lucide-react';

function PasswordTab() {
  // --- États pour le changement de mot de passe (inchangés) ---
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState(null);
  const [pwdSuccess, setPwdSuccess] = useState(null);

  // --- 3. NOUVEAUX ÉTATS POUR LE MFA ---
  const { user, isLoading: isUserLoading } = useAuth(); // Récupère l'utilisateur actuel
  const [mfaEnabled, setMfaEnabled] = useState(false);
  
  // États pour l'activation
  const [mfaSetupInfo, setMfaSetupInfo] = useState(null); // Stocke { secret_key, qr_code_data_uri }
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaSetupLoading, setMfaSetupLoading] = useState(false);
  const [mfaSetupError, setMfaSetupError] = useState(null);

  // États pour la désactivation
  const [disablePassword, setDisablePassword] = useState('');
  const [disableMfaCode, setDisableMfaCode] = useState('');
  const [mfaDisableLoading, setMfaDisableLoading] = useState(false);
  const [mfaDisableError, setMfaDisableError] = useState(null);

  // Met à jour l'état local du MFA quand l'utilisateur est chargé
  useEffect(() => {
    if (user) {
      setMfaEnabled(user.mfa_enabled);
    }
  }, [user]);

  // --- Gestionnaire pour le changement de mot de passe (inchangé) ---
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (pwdNew !== pwdConfirm) {
      setPwdError("Le nouveau mot de passe et la confirmation ne correspondent pas.");
      return;
    }
    if (pwdNew.length < 8) {
      setPwdError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setPwdLoading(true);
    try {
      await api.put('/api/users/me/change-password', {
        current_password: pwdCurrent,
        new_password: pwdNew,
      });
      setPwdSuccess("Votre mot de passe a été mis à jour avec succès !");
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setPwdError("Votre mot de passe actuel est incorrect.");
      } else {
        setPwdError("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setPwdLoading(false);
    }
  };

  // --- 4. NOUVELLES FONCTIONS POUR LE MFA ---

  // Étape 1: L'utilisateur clique sur "Activer"
  const handleMfaEnableStart = async () => {
    setMfaSetupLoading(true);
    setMfaSetupError(null);
    try {
      const response = await mfaSetup(); // Appelle GET /api/mfa/setup
      setMfaSetupInfo(response.data); // Affiche le QR code
    } catch (err) {
      setMfaSetupError("Impossible de démarrer la configuration MFA. Veuillez réessayer.");
    } finally {
      setMfaSetupLoading(false);
    }
  };

  // Étape 2: L'utilisateur a scanné et entre son code
  const handleMfaEnableVerify = async (e) => {
    e.preventDefault();
    setMfaSetupLoading(true);
    setMfaSetupError(null);
    try {
      await mfaVerify(mfaVerifyCode); // Appelle POST /api/mfa/verify
      setMfaSetupLoading(false);
      
      // Succès !
      alert("MFA activé avec succès ! La page va se recharger.");
      window.location.reload(); // Recharge la page pour mettre à jour l'état 'user'
      
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail.includes("Invalid MFA code")) {
        setMfaSetupError("Code invalide. Vérifiez votre application et réessayez.");
      } else {
        setMfaSetupError("Une erreur est survenue lors de la vérification.");
      }
      setMfaSetupLoading(false);
    }
  };

  // Pour désactiver le MFA
  const handleMfaDisable = async (e) => {
    e.preventDefault();
    setMfaDisableLoading(true);
    setMfaDisableError(null);
    try {
      await mfaDisable(disablePassword, disableMfaCode); // Appelle POST /api/mfa/disable
      
      alert("MFA désactivé avec succès ! La page va se recharger.");
      window.location.reload(); // Recharge la page
      
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 400)) {
        setMfaDisableError(err.response.data.detail || "Mot de passe ou code MFA incorrect.");
      } else {
        setMfaDisableError("Une erreur est survenue. Veuillez réessayer.");
      }
      setMfaDisableLoading(false);
    }
  };


  // --- 5. MODIFICATION DU JSX POUR INCLURE LE MFA ---
  return (
    <div className="max-w-xl mx-auto divide-y divide-gray-200">
      
      {/* --- SECTION 1: CHANGEMENT DE MOT DE PASSE --- */}
      <div className="pb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Changer de mot de passe</h2>
        <p className="text-sm text-gray-600 mb-6">
          Pour votre sécurité, nous vous recommandons d'utiliser un mot de passe long et unique.
        </p>

        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          {/* Champ Mot de passe actuel */}
          <div>
            <label htmlFor="current-password" /* ... */>Mot de passe actuel</label>
            <input
              id="current-password" type="password"
              value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {/* Champ Nouveau mot de passe */}
          <div>
            <label htmlFor="new-password" /* ... */>Nouveau mot de passe</label>
            <input
              id="new-password" type="password"
              value={pwdNew} onChange={(e) => setPwdNew(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {/* Champ Confirmer le nouveau mot de passe */}
          <div>
            <label htmlFor="confirm-password" /* ... */>Confirmer le nouveau mot de passe</label>
            <input
              id="confirm-password" type="password"
              value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {/* Messages d'état (Erreur/Succès) */}
          {pwdError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-600">{pwdError}</p>
            </div>
          )}
          {pwdSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-600">{pwdSuccess}</p>
            </div>
          )}
          {/* Bouton de soumission */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwdLoading || !pwdCurrent || !pwdNew || !pwdConfirm}
              className="bg-primary-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {pwdLoading ? <Loader className="animate-spin h-5 w-5" /> : <Lock className="h-5 w-5" />}
              <span>Mettre à jour le mot de passe</span>
            </button>
          </div>
        </form>
      </div>

      {/* --- SECTION 2: AUTHENTIFICATION À DEUX FACTEURS (MFA) --- */}
      <div className="pt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Authentification à deux facteurs (MFA)</h2>
        
        {isUserLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader className="animate-spin h-8 w-8 text-primary-600" />
          </div>
        ) : mfaEnabled ? (
          
          // --- CAS 1: L'UTILISATEUR A DÉJÀ ACTIVÉ LE MFA ---
          <div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3 mb-6">
              <Shield className="h-6 w-6 text-green-600" />
              <p className="text-sm text-green-700 font-semibold">
                L'authentification à deux facteurs est activée sur votre compte.
              </p>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Désactiver le MFA</h3>
            <p className="text-sm text-gray-600 mb-6">
              Pour désactiver le MFA, veuillez confirmer votre mot de passe et entrer un code de vérification de votre application.
            </p>
            <form onSubmit={handleMfaDisable} className="space-y-4">
              {/* Champ Mot de passe */}
              <div>
                <label htmlFor="disable-password" /* ... */>Votre mot de passe</label>
                <input
                  id="disable-password" type="password"
                  value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {/* Champ Code MFA */}
              <div>
                <label htmlFor="disable-mfa-code" /* ... */>Code MFA (6 chiffres)</label>
                <input
                  id="disable-mfa-code" type="text"
                  value={disableMfaCode} onChange={(e) => setDisableMfaCode(e.target.value)}
                  required maxLength={6}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {/* Message d'erreur */}
              {mfaDisableError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm text-red-600">{mfaDisableError}</p>
                </div>
              )}
              {/* Bouton de désactivation */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={mfaDisableLoading || !disablePassword || !disableMfaCode}
                  className="bg-red-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-red-700 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {mfaDisableLoading ? <Loader className="animate-spin h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  <span>Désactiver le MFA</span>
                </button>
              </div>
            </form>
          </div>

        ) : mfaSetupInfo ? (

          // --- CAS 2: L'UTILISATEUR EST EN TRAIN D'ACTIVER LE MFA ---
          <div className="space-y-6">
            <p className="text-sm text-gray-600">
              Scannez ce QR code avec votre application d'authentification (Google Authenticator, Authy, etc.).
            </p>
            <div className="flex justify-center bg-white p-4 rounded-lg border border-gray-200">
              <img src={mfaSetupInfo.qr_code_data_uri} alt="QR Code MFA" className="w-48 h-48" />
            </div>
            <p className="text-sm text-gray-600">
              Si vous ne pouvez pas scanner le code, entrez manuellement cette clé secrète dans votre application :
              <code className="block bg-gray-100 text-gray-800 p-2 rounded-lg mt-2 text-center font-mono break-all">
                {mfaSetupInfo.secret_key}
              </code>
            </p>
            
            <form onSubmit={handleMfaEnableVerify} className="space-y-4">
              <div>
                <label htmlFor="verify-mfa-code" /* ... */>Entrez le code à 6 chiffres</label>
                <input
                  id="verify-mfa-code" type="text"
                  value={mfaVerifyCode} onChange={(e) => setMfaVerifyCode(e.target.value)}
                  required maxLength={6} autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {/* Message d'erreur */}
              {mfaSetupError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm text-red-600">{mfaSetupError}</p>
                </div>
              )}
              {/* Boutons d'action */}
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setMfaSetupInfo(null)}
                  className="bg-gray-200 text-gray-800 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-300 transition-all duration-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={mfaSetupLoading || mfaVerifyCode.length !== 6}
                  className="bg-success-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-success-700 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {mfaSetupLoading ? <Loader className="animate-spin h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                  <span>Vérifier et Activer</span>
                </button>
              </div>
            </form>
          </div>

        ) : (

          // --- CAS 3: LE MFA EST INACTIF ---
          <div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center space-x-3 mb-6">
              <Shield className="h-6 w-6 text-gray-500" />
              <p className="text-sm text-gray-600">
                L'authentification à deux facteurs est actuellement **désactivée**.
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Renforcez la sécurité de votre compte en exigeant un code de vérification à 6 chiffres lors de la connexion.
            </p>
            <button
              onClick={handleMfaEnableStart}
              disabled={mfaSetupLoading}
              className="bg-primary-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {mfaSetupLoading ? <Loader className="animate-spin h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
              <span>Activer le MFA</span>
            </button>
          </div>
        )}
      </div>
      
    </div>
  );
}

export default PasswordTab;