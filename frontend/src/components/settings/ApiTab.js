FILE: frontend/src/components/settings/ApiTab.js
import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Key, AlertTriangle, Copy, CheckCircle, Trash2, Smartphone } from 'lucide-react';

function ApiTab() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchUserStatus();
  }, []);

  const fetchUserStatus = async () => {
    try {
      const response = await api.get('/users/me');
      setHasApiKey(response.data.has_api_key);
    } catch (err) {
      setError('Erreur lors de la récupération des données utilisateur.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateApiKey = async () => {
    if (window.confirm('Générer une nouvelle clé API va remplacer l\'ancienne si elle existe. Continuer ?')) {
      try {
        setIsLoading(true);
        setError(null);
        const response = await api.post('/users/me/api-key');
        setNewApiKey(response.data.api_key);
        setHasApiKey(true);
        setCopied(false);
      } catch (err) {
        setError('Erreur lors de la génération de la clé API.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const revokeApiKey = async () => {
    if (window.confirm('Voulez-vous vraiment révoquer cette clé ? Vos raccourcis iOS cesseront de fonctionner.')) {
      try {
        setIsLoading(true);
        setError(null);
        await api.delete('/users/me/api-key');
        setHasApiKey(false);
        setNewApiKey(null);
      } catch (err) {
        setError('Erreur lors de la révocation de la clé API.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const copyToClipboard = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (isLoading && !hasApiKey && !newApiKey) {
    return <div className="text-gray-500">Chargement...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-medium text-gray-900 flex items-center">
          <Smartphone className="h-5 w-5 mr-2 text-primary-600" />
          Intégration Apple Pay (Raccourcis iOS)
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Générez un jeton d'accès personnel pour autoriser des applications externes (comme les Raccourcis Apple) à envoyer des transactions vers votre compte.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {newApiKey && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center space-x-3 text-yellow-800 mb-4">
            <AlertTriangle className="h-6 w-6 flex-shrink-0" />
            <h3 className="font-semibold text-lg">Nouvelle Clé API Générée</h3>
          </div>
          <p className="text-sm text-yellow-700 mb-4">
            Copiez cette clé immédiatement. Pour des raisons de sécurité, <strong>elle ne sera plus jamais affichée</strong>.
          </p>
          
          <div className="flex items-center space-x-2">
            <code className="flex-1 block bg-yellow-100/50 p-3 rounded text-yellow-900 border border-yellow-300 break-all font-mono text-sm">
              {newApiKey}
            </code>
            <button
              onClick={copyToClipboard}
              className="p-3 bg-white border border-yellow-300 rounded hover:bg-yellow-50 transition-colors text-yellow-700 shadow-sm"
              title="Copier la clé"
            >
              {copied ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-full ${hasApiKey ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
            <Key className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">
              Statut de la clé API
            </h3>
            <p className={`text-sm font-medium ${hasApiKey ? 'text-green-600' : 'text-gray-500'}`}>
              {hasApiKey ? 'Active' : 'Aucune clé générée'}
            </p>
          </div>
        </div>

        <div>
          {hasApiKey ? (
            <button
              onClick={revokeApiKey}
              disabled={isLoading}
              className="flex items-center px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Révoquer la clé
            </button>
          ) : (
            <button
              onClick={generateApiKey}
              disabled={isLoading}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              <Key className="h-4 w-4 mr-2" />
              Générer une clé
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ApiTab;