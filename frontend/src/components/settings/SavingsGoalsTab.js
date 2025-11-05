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
// Nous avons besoin de 'user' du hook useAuth pour cela
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
    
    // Vérification avant de retirer plus que disponible
    if (action === 'remove' && numericAmount > goal.current_amount) {
      setError('Vous ne pouvez pas retirer plus que le montant actuel de la cagnotte.');
      return;
    }

    setLoading(true);
    try {
      await adjustSavingsGoal(goal.id, numericAmount, action);
      setLoading(false);
      onSuccess(); // Rafraîchit les données dans le composant parent
      onClose();   // Ferme la modale
    } catch (err) {
      setError("Erreur lors de l'ajustement. Veuillez réessayer.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            Ajuster l'objectif : <span className="text-primary-600">{goal.name}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
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
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
            >
              <option value="add">Ajouter à la cagnotte</option>
              <option value="remove">Retirer de la cagnotte</option>
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
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
              placeholder="Ex: 50"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-white flex items-center space-x-2 ${
                action === 'add' ? 'bg-success-600 hover:bg-success-700' : 'bg-red-600 hover:bg-red-700'
              } disabled:opacity-50`}
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
  const [adjustGoal, setAdjustGoal] = useState(null); // Stocke l'objectif à ajuster

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await getSavingsGoals();
      setGoals(response.data);
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
      fetchData(); // Re-fetch pour mettre à jour la liste
    } catch (error) {
      console.error('Error adding savings goal:', error);
      alert('Erreur lors de l\'ajout de l\'objectif.');
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
      fetchData();
    } catch (error) {
      console.error('Error updating savings goal:', error);
      alert('Erreur lors de la modification');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet objectif ?')) {
      return;
    }
    try {
      await deleteSavingsGoal(id);
      fetchData();
    } catch (error) {
      console.error('Error deleting savings goal:', error);
      alert('Erreur lors de la suppression');
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
          <Plus className="h-5 w-5" />
          <span>Ajouter un objectif</span>
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-xl p-4 border-2 border-primary-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Nouvel objectif d'épargne</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l'objectif</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: Voyage au Japon"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Montant Cible</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={addForm.target_amount}
                  onChange={(e) => setAddForm({ ...addForm, target_amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: 3000"
                />
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
              >
                Ajouter
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Savings Goals List */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-gray-900 flex items-center">
          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg text-sm mr-2">Objectifs</span>
          <span className="text-gray-500 text-sm">({goals.length})</span>
        </h3>
        <div className="space-y-4">
          {goals.map((goal) => {
            const percentage = (goal.current_amount / goal.target_amount) * 100;
            const clampedPercentage = Math.min(percentage, 100);

            return (
              <div
                key={goal.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
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
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Montant Cible</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={editForm.target_amount}
                          onChange={(e) => setEditForm({ ...editForm, target_amount: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                       <button
                        onClick={() => setEditingId(null)}
                        className="text-gray-600 hover:text-gray-800 p-2"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleUpdate(goal.id)}
                        className="text-success-600 hover:text-success-800 p-2"
                      >
                        <Save className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  // --- Mode Affichage ---
                  <div>
                    {/* Nom, Montants et Boutons */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-xl text-gray-900">{goal.name}</span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => startEdit(goal)}
                          className="text-primary-600 hover:text-primary-800"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* Barre de progression */}
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden my-2">
                      <div
                        className="h-3 rounded-full bg-success-600 transition-all duration-500"
                        style={{ width: `${clampedPercentage}%` }}
                      ></div>
                    </div>
                    {/* Légende de progression */}
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-medium text-success-700">
                        <CurrencyFormatter amount={goal.current_amount} />
                      </span>
                      <span className="text-sm text-gray-500">
                        Objectif : <CurrencyFormatter amount={goal.target_amount} />
                      </span>
                    </div>
                    {/* Bouton Ajuster */}
                    <div className="flex justify-end mt-4">
                       <button
                         onClick={() => setAdjustGoal(goal)} // Ouvre la modale
                         className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-all text-sm flex items-center space-x-2"
                       >
                         <TrendingUp className="h-4 w-4" />
                         <span>Ajuster les fonds</span>
                       </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Placeholder si pas d'objectifs */}
          {goals.length === 0 && (
            <div className="text-gray-500 text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
              <Target className="h-12 w-12 mx-auto text-gray-400 mb-2" />
              <p className="font-medium">Aucun objectif d'épargne défini</p>
              <p className="text-sm">Cliquez sur "Ajouter un objectif" pour commencer.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Rendu de la Modale */}
      {adjustGoal && (
        <AdjustModal 
          goal={adjustGoal}
          onClose={() => setAdjustGoal(null)}
          onSuccess={() => {
            fetchData(); // Rafraîchit les objectifs après ajustement
          }}
        />
      )}
    </div>
  );
}

export default SavingsGoalsTab;