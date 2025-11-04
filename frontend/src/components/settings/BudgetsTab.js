import React, { useState, useEffect } from 'react';
// 1. Import des nouvelles fonctions API
import api, { getBudgets, createBudget, updateBudget, deleteBudget } from '../../api';
import { Plus, Edit2, Trash2, Save, X, Loader, PiggyBank } from 'lucide-react';

function BudgetsTab() {
  // 2. Mise à jour de l'état
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  // Le formulaire d'édition ne gère que le montant
  const [editForm, setEditForm] = useState({ amount: 0 });
  const [showAddForm, setShowAddForm] = useState(false);
  // Le formulaire d'ajout gère l'ID de la catégorie et le montant
  const [addForm, setAddForm] = useState({ category_id: '', amount: '' });

  // Map pour trouver facilement le nom d'une catégorie par son ID
  const categoryNameMap = new Map(categories.map(cat => [cat.id, cat.name]));
  // Liste des catégories de DÉPENSE
  const expenseCategories = categories.filter(cat => cat.type === 'Dépense');
  // Set des ID de catégories qui ont déjà un budget
  const budgetedCategoryIds = new Set(budgets.map(b => b.category_id));
  // Liste des catégories de DÉPENSE qui n'ont PAS encore de budget
  const availableCategories = expenseCategories.filter(cat => !budgetedCategoryIds.has(cat.id));


  // 3. Double fetch au chargement
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // On charge les budgets ET les catégories en parallèle
      const [budgetsRes, categoriesRes] = await Promise.all([
        getBudgets(),
        api.get('/api/categories') // On garde l'appel 'api' générique pour les catégories
      ]);
      setBudgets(budgetsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 4. Handler d'ajout
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.category_id || !addForm.amount) {
      alert('Veuillez sélectionner une catégorie et entrer un montant.');
      return;
    }
    try {
      await createBudget(addForm.category_id, parseFloat(addForm.amount));
      setAddForm({ category_id: '', amount: '' });
      setShowAddForm(false);
      fetchData(); // Re-fetch pour mettre à jour la liste
    } catch (error) {
      console.error('Error adding budget:', error);
      alert('Erreur lors de l\'ajout du budget. Vérifiez qu\'un budget n\'existe pas déjà pour cette catégorie.');
    }
  };

  // 5. Handler de début d'édition
  const startEdit = (budget) => {
    setEditingId(budget.id);
    setEditForm({ amount: budget.amount });
  };

  // 6. Handler de mise à jour
  const handleUpdate = async (id) => {
    try {
      await updateBudget(id, parseFloat(editForm.amount));
      setEditingId(null);
      fetchData();
    } catch (error) {
      console.error('Error updating budget:', error);
      alert('Erreur lors de la modification');
    }
  };

  // 7. Handler de suppression
  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce budget ?')) {
      return;
    }
    try {
      await deleteBudget(id);
      fetchData();
    } catch (error) {
      console.error('Error deleting budget:', error);
      alert('Erreur lors de la suppression');
    }
  };

  // Formatage pour l'argent
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
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
          disabled={availableCategories.length === 0} // Désactive si toutes les catégories ont un budget
          className="bg-gradient-to-r from-primary-600 to-success-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-5 w-5" />
          <span>Ajouter un budget</span>
        </button>
      </div>

      {/* Message si aucune catégorie n'est dispo */}
      {showAddForm && availableCategories.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center text-blue-700">
          Toutes vos catégories de dépenses ont déjà un budget assigné.
        </div>
      )}

      {/* Add Form */}
      {showAddForm && availableCategories.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 border-2 border-primary-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Nouveau budget mensuel</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
                <select
                  value={addForm.category_id}
                  required
                  onChange={(e) => setAddForm({ ...addForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="" disabled>Sélectionner une catégorie...</option>
                  {/* On ne liste que les catégories de DÉPENSE disponibles */}
                  {availableCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Montant (par mois)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={addForm.amount}
                  onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: 150"
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

      {/* Budgets List (une seule liste pour les dépenses) */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-gray-900 flex items-center">
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-sm mr-2">Budgets Mensuels</span>
          <span className="text-gray-500 text-sm">({budgets.length})</span>
        </h3>
        <div className="space-y-2">
          {budgets.map((budget) => (
            <div
              key={budget.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {editingId === budget.id ? (
                // --- Mode Édition ---
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900 flex-1">
                    {categoryNameMap.get(budget.category_id) || 'Catégorie inconnue'}
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ amount: e.target.value })}
                    className="w-32 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={() => handleUpdate(budget.id)}
                    className="text-success-600 hover:text-success-800"
                  >
                    <Save className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                // --- Mode Affichage ---
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">
                      {categoryNameMap.get(budget.category_id) || 'Catégorie inconnue'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-semibold text-gray-800 text-lg">
                      {formatCurrency(budget.amount)}
                    </span>
                    <button
                      onClick={() => startEdit(budget)}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {budgets.length === 0 && (
            <div className="text-gray-500 text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
              <PiggyBank className="h-12 w-12 mx-auto text-gray-400 mb-2" />
              <p className="font-medium">Aucun budget défini</p>
              <p className="text-sm">Cliquez sur "Ajouter un budget" pour commencer.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BudgetsTab;
