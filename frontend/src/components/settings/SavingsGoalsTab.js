import React, { useState, useEffect } from 'react';
import { useAuth } from '../../App'; // Importé pour le formatage de la devise
import { 
  getSavingsGoals, 
  createSavingsGoal, 
  updateSavingsGoal, 
  deleteSavingsGoal,
  adjustSavingsGoal 
} from '../../api';
import { Plus, Edit2, Trash2, Save, X, Loader, Target, TrendingUp, TrendingDown, XCircle } from 'lucide-react';

// --- Formatage de la devise (interne) ---
const CurrencyFormatter = ({ amount }) => {
  const { user } = useAuth();
  const currencyCode = user?.currency || 'EUR';

  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount || 0);

  return <span>{formatted}</span>;
};


// --- Composant Modal pour Ajuster les Fonds ---
function AdjustModal({ goal, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState('add'); // 'add' ou 'remove'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const numericAmount = parseFloat(amount);

    if (!numericAmount || numericAmount <= 0) {
      setError('Veuillez entrer un montant valide.');
      return;
    }
    
    // Vérification locale avant de retirer plus que disponible
    if (action === 'remove' && numericAmount > goal.current_amount) {
      setError('Vous ne pouvez pas retirer plus que le montant actuel de la cagnotte.');
      return;
    }

    setLoading(true);
    try {
      // Appel API : le backend corrigé renvoie maintenant un 200 OK propre
      await adjustSavingsGoal(goal.id, numericAmount, action);
      
      setLoading(false);
      onSuccess(); // Rafraîchit les données dans le composant parent
      onClose();   // Ferme la modale
    } catch (err) {
      console.error("Erreur lors de l'ajustement:", err);
      // Affiche le message d'erreur du backend s'il existe, sinon un message générique
      const errorMessage = err.response?.data?.detail || "Erreur lors de l'ajustement. Veuillez réessayer.";
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            Ajuster l'objectif : <span className="text-primary-600">{goal.name}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 flex items-center">
              <XCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Montant actuel</label>
            <p className="text-2xl font-bold text-gray-800">
              <CurrencyFormatter amount={goal.current_amount} />
            </p>
          </div>

          <div>
            <label htmlFor="action" className="block text-sm font-medium text-gray-700 mb-2">Action</label>
            <select
              id="action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
            >
              <option value="add">➕ Ajouter à la cagnotte</option>
              <option value="remove">➖ Retirer de la cagnotte</option>
            </select>
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">Montant</label>
            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
              placeholder="Ex: 50"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-white flex items-center space-x-2 transition-all ${
                action === 'add' 
                  ? 'bg-success-600 hover:bg-success-700 shadow-success-100' 
                  : 'bg-red-600 hover:bg-red-700 shadow-red-100'
              } disabled:opacity-50 hover:shadow-lg`}
            >
              {loading ? (
                <Loader className="h-5 w-5 animate-spin" />
              ) : (
                action === 'add' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />
              )}
              <span>{action === 'add' ? 'Ajouter' : 'Retirer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// --- Composant Principal de l'Onglet ---
function SavingsGoalsTab() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', target_amount: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', target_amount: '' });

  // État pour la modale d'ajustement
  const [adjustGoal, setAdjustGoal] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await getSavingsGoals();
      // On s'assure de récupérer data qui est la liste d'objectifs
      setGoals(response.data || []);
    } catch (error) {
      console.error('Error fetching savings goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await createSavingsGoal(addForm.name, parseFloat(addForm.target_amount));
      setAddForm({ name: '', target_amount: '' });
      setShowAddForm(false);
      await fetchData(); 
    } catch (error) {
      console.error('Error adding savings goal:', error);
      alert(error.response?.data?.detail || 'Erreur lors de l\'ajout de l\'objectif.');
    }
  };

  const startEdit = (goal) => {
    setEditingId(goal.id);
    setEditForm({ name: goal.name, target_amount: goal.target_amount });
  };

  const handleUpdate = async (id) => {
    try {
      await updateSavingsGoal(id, {
        name: editForm.name,
        target_amount: parseFloat(editForm.target_amount),
      });
      setEditingId(null);
      await fetchData();
    } catch (error) {
      console.error('Error updating savings goal:', error);
      alert(error.response?.data?.detail || 'Erreur lors de la modification');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet objectif ?')) {
      return;
    }
    try {
      await deleteSavingsGoal(id);
      await fetchData();
    } catch (error) {
      console.error('Error deleting savings goal:', error);
      alert(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-gradient-to-r from-primary-600 to-success-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all flex items-center space-x-2"
        >
          {showAddForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          <span>{showAddForm ? 'Annuler' : 'Ajouter un objectif'}</span>
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-xl p-6 border-2 border-primary-100 shadow-sm transition-all animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center">
            <Target className="h-5 w-5 mr-2 text-primary-600" />
            Nouvel objectif d'épargne
          </h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l'objectif</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  placeholder="Ex: Voyage au Japon"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Montant Cible</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={addForm.target_amount}
                  onChange={(e) => setAddForm({ ...addForm, target_amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                  placeholder="Ex: 3000"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg transition-all"
              >
                Créer l'objectif
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Savings Goals List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-lg text-sm mr-2 font-bold">Cagnottes</span>
          <span className="text-gray-500 text-sm font-normal">({goals.length} objectifs en cours)</span>
        </h3>
        
        <div className="grid grid-cols-1 gap-4">
          {goals.map((goal) => {
            const percentage = (goal.current_amount / goal.target_amount) * 100;
            const clampedPercentage = Math.min(percentage, 100);

            return (
              <div
                key={goal.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all duration-200"
              >
                {editingId === goal.id ? (
                  // --- Mode Édition ---
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Montant Cible</label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={editForm.target_amount}
                          onChange={(e) => setEditForm({ ...editForm, target_amount: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                       <button
                        onClick={() => setEditingId(null)}
                        className="text-gray-600 hover:text-gray-800 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleUpdate(goal.id)}
                        className="text-success-600 hover:text-success-800 p-2 hover:bg-success-50 rounded-lg transition-colors"
                      >
                        <Save className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  // --- Mode Affichage ---
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${percentage >= 100 ? 'bg-success-100' : 'bg-primary-50'}`}>
                          <Target className={`h-5 w-5 ${percentage >= 100 ? 'text-success-600' : 'text-primary-600'}`} />
                        </div>
                        <span className="font-bold text-lg text-gray-900">{goal.name}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => startEdit(goal)}
                          className="text-gray-400 hover:text-primary-600 p-2 hover:bg-primary-50 rounded-lg transition-all"
                          title="Modifier"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Barre de progression stylisée */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-gray-500">
                        <span>Progression</span>
                        <span>{Math.round(percentage)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-50">
                        <div
                          className={`h-3 rounded-full transition-all duration-1000 ease-out ${
                            percentage >= 100 ? 'bg-success-500' : 'bg-gradient-to-r from-primary-500 to-primary-600'
                          }`}
                          style={{ width: `${clampedPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-end mt-4">
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase mb-1">Collecté</p>
                        <span className="text-xl font-bold text-success-600">
                          <CurrencyFormatter amount={goal.current_amount} />
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 font-medium uppercase mb-1">Objectif</p>
                        <span className="text-sm font-semibold text-gray-700">
                          <CurrencyFormatter amount={goal.target_amount} />
                        </span>
                      </div>
                    </div>

                    {/* Bouton Ajuster */}
                    <div className="flex justify-center mt-5 pt-4 border-t border-gray-50">
                       <button
                         onClick={() => setAdjustGoal(goal)}
                         className="w-full bg-gray-50 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-primary-600 hover:text-white transition-all duration-300 text-sm flex items-center justify-center space-x-2 group"
                       >
                         <TrendingUp className="h-4 w-4 group-hover:scale-110 transition-transform" />
                         <span>Gérer les fonds</span>
                       </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Placeholder si pas d'objectifs */}
          {goals.length === 0 && (
            <div className="text-gray-500 text-center py-12 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
              <div className="bg-gray-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-gray-300" />
              </div>
              <p className="font-bold text-gray-900">Aucun objectif d'épargne</p>
              <p className="text-sm text-gray-500 mt-1">Commencez à mettre de l'argent de côté pour vos projets.</p>
              <button 
                onClick={() => setShowAddForm(true)}
                className="mt-4 text-primary-600 font-semibold hover:underline"
              >
                Créer mon premier objectif
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Rendu de la Modale d'ajustement */}
      {adjustGoal && (
        <AdjustModal 
          goal={adjustGoal}
          onClose={() => setAdjustGoal(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}

export default SavingsGoalsTab;