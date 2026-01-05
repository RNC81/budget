import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../App';
import { X, Save, Loader, AlertCircle } from 'lucide-react';

function TransactionModal({ onClose, onSuccess, editTransaction = null }) {
  const { user } = useAuth();
  const currencySymbol = user?.currency === 'USD' ? '$' : '€';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  
  const [formData, setFormData] = useState({
    date: editTransaction?.date?.split('T')[0] || new Date().toISOString().split('T')[0],
    amount: editTransaction?.amount || '',
    type: editTransaction?.type || 'Dépense',
    description: editTransaction?.description || '',
    category_id: editTransaction?.category_id || '',
    subcategory_id: editTransaction?.subcategory_id || '',
  });

  useEffect(() => {
    fetchCategories();
    fetchSubcategories();
  }, []);

  useEffect(() => {
    // Filtrage des sous-catégories selon la catégorie sélectionnée
    if (formData.category_id) {
      const filtered = subcategories.filter(sub => sub.category_id === formData.category_id);
      // Si la sous-catégorie actuelle n'appartient plus à la catégorie, on reset
      if (formData.subcategory_id && !filtered.find(s => s.id === formData.subcategory_id)) {
        setFormData(prev => ({ ...prev, subcategory_id: '' }));
      }
    } else {
      setFormData(prev => ({ ...prev, subcategory_id: '' }));
    }
  }, [formData.category_id, subcategories]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSubcategories = async () => {
    try {
      const response = await api.get('/api/subcategories');
      setSubcategories(response.data);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        // S'assurer que la date est envoyée au bon format ISO pour le backend
        date: new Date(formData.date).toISOString(),
        amount: parseFloat(formData.amount),
        category_id: formData.category_id || null,
        subcategory_id: formData.subcategory_id || null,
      };

      if (editTransaction) {
        // Le backend corrigé renverra maintenant un 200 propre sans crash
        await api.put(`/api/transactions/${editTransaction.id}`, payload);
      } else {
        await api.post('/api/transactions', payload);
      }

      onSuccess(); // Déclenche le rafraîchissement de la liste et ferme la modale
    } catch (err) {
      console.error('Error saving transaction:', err);
      // Récupération du message d'erreur précis du backend
      const msg = err.response?.data?.detail || "Erreur lors de l'enregistrement. Veuillez réessayer.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Filtrage pour l'affichage dans le formulaire
  const filteredCategories = categories.filter(cat => cat.type === formData.type);
  const filteredSubcategories = subcategories.filter(sub => sub.category_id === formData.category_id);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {editTransaction ? 'Modifier la transaction' : 'Nouvelle transaction'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-all"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 animate-in fade-in zoom-in-95">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Type Toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Type de transaction</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'Revenu', category_id: '', subcategory_id: '' })}
                className={`px-4 py-3 rounded-xl font-bold transition-all duration-200 ${
                  formData.type === 'Revenu'
                    ? 'bg-success-600 text-white shadow-lg shadow-success-200 ring-2 ring-success-600 ring-offset-2'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Revenu
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'Dépense', category_id: '', subcategory_id: '' })}
                className={`px-4 py-3 rounded-xl font-bold transition-all duration-200 ${
                  formData.type === 'Dépense'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-200 ring-2 ring-red-600 ring-offset-2'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Dépense
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                Montant ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-mono text-lg"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Courses au supermarché"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* Category Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Catégorie</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value, subcategory_id: '' })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all bg-white"
              >
                <option value="">Aucune catégorie</option>
                {filteredCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Subcategory - Affiché seulement si nécessaire */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Sous-catégorie</label>
              <select
                value={formData.subcategory_id}
                onChange={(e) => setFormData({ ...formData, subcategory_id: e.target.value })}
                disabled={!formData.category_id || filteredSubcategories.length === 0}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all bg-white disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">{filteredSubcategories.length === 0 ? 'N/A' : 'Aucune sous-catégorie'}</option>
                {filteredSubcategories.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-4 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-primary-600 to-success-600 text-white px-4 py-4 rounded-xl font-bold hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>{editTransaction ? 'Valider les modifications' : 'Enregistrer la transaction'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TransactionModal;