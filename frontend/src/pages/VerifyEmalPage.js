import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios'; // On utilise axios pur ici, pas 'api' car 'api' gère mal les 401
import { Loader, AlertCircle, CheckCircle, Mail } from 'lucide-react';

// On utilise l'URL de base directement
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage("Token de vérification manquant. Le lien est peut-être invalide.");
      return;
    }

    const verifyToken = async () => {
      try {
        // On fait un appel GET au nouvel endpoint
        await axios.get(`${API_BASE_URL}/api/auth/verify-email`, {
          params: { token: token }
        });
        
        setStatus('success');
        
        // Redirige vers la page de connexion après 5 secondes
        setTimeout(() => {
          navigate('/login');
        }, 5000);

      } catch (err) {
        setStatus('error');
        if (err.response && err.response.data && err.response.data.detail) {
          if (err.response.data.detail.includes("expired")) {
             setErrorMessage("Ce lien de vérification a expiré. Veuillez vous réinscrire.");
          } else {
             setErrorMessage("Ce lien de vérification est invalide. Veuillez réessayer.");
          }
        } else {
          setErrorMessage("Une erreur est survenue lors de la vérification.");
        }
      }
    };

    verifyToken();
  }, [token, navigate]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader className="h-12 w-12 animate-spin text-primary-600" />
            <h2 className="mt-4 text-2xl font-semibold text-gray-900">Vérification en cours...</h2>
            <p className="mt-2 text-gray-600">Nous validons votre compte.</p>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="h-12 w-12 text-success-600" />
            <h2 className="mt-4 text-2xl font-semibold text-gray-900">Compte vérifié !</h2>
            <p className="mt-2 text-gray-600">Votre e-mail a été validé avec succès.</p>
            <p className="mt-1 text-gray-500">Vous allez être redirigé vers la page de connexion...</p>
            <Link 
              to="/login"
              className="mt-6 inline-block bg-gradient-to-r from-primary-600 to-success-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              Se connecter maintenant
            </Link>
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="h-12 w-12 text-red-600" />
            <h2 className="mt-4 text-2xl font-semibold text-gray-900">Échec de la vérification</h2>
            <p className="mt-2 text-red-600">{errorMessage}</p>
            <Link 
              to="/register"
              className="mt-6 inline-block bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-700 transition-all duration-200"
            >
              Se réinscrire
            </Link>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-success-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
        <div className="flex justify-center mb-6">
          <div className="bg-primary-100 rounded-full p-4">
            <Mail className="h-10 w-10 text-primary-600" />
          </div>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}

export default VerifyEmailPage;