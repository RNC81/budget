import React, { useState } from 'react';
import api from '../../api'; // Importe notre instance axios
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';

function PasswordTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // 1. Vérification simple de la confirmation
    if (newPassword !== confirmPassword) {
      setError("Le nouveau mot de passe et la confirmation ne correspondent pas.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);

    try {
      // 2. Appel au nouvel endpoint (que nous allons créer)
      await api.put('/api/users/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      // 3. Succès
      setSuccess("Votre mot de passe a été mis à jour avec succès !");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

    } catch (err) {
      // 4. Gestion des erreurs
      if (err.response && err.response.status === 401) {
        setError("Votre mot de passe actuel est incorrect.");
      } else {
        setError("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Changer de mot de passe</h2>
      <p className="text-sm text-gray-600 mb-6">
        Pour votre sécurité, nous vous recommandons d'utiliser un mot de passe long et unique.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Champ Mot de passe actuel */}
        <div>
          <label 
            htmlFor="current-password" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Mot de passe actuel
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Champ Nouveau mot de passe */}
        <div>
          <label 
            htmlFor="new-password" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Nouveau mot de passe
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Champ Confirmer le nouveau mot de passe */}
        <div>
          <label 
            htmlFor="confirm-password" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirmer le nouveau mot de passe
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* --- Messages d'état --- */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
           <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}
        {/* --- Fin Messages d'état --- */}


        {/* Bouton de soumission */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="bg-primary-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <Lock className="h-5 w-5" />
            )}
            <span>Mettre à jour le mot de passe</span>
          </button>
        </div>

      </form>
    </div>
  );
}

export default PasswordTab;