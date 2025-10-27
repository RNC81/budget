import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Plus, Edit2, Trash2, Save, X, Loader, Play, CheckCircle } from 'lucide-react';

function RecurringTransactionsTab() {
  const [recurring, setRecurring] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    type: 'Dépense',
    description: '',
    category_id: '',
    subcategory_id: '',
    frequency: 'Mensuel',
    day_of_month: 1,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    amount: '',
    type: 'Dépense',
    description: '',
    category_id: '',
    subcategory_id: '',
    frequency: 'Mensuel',
    day_of_month: 1,
  });

  useEffect(() => {
    fetchCategories();
    fetchSubcategories();
    fetchRecurring();
  }, []);

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

  const fetchRecurring = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/recurring-transactions');
      setRecurring(response.data);
    } catch (error) {
      console.error('Error fetching recurring transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!window.confirm('Générer les transactions récurrentes pour ce mois ?')) {
      return;
    }

    setGenerating(true);
    try {
      const response = await api.post('/api/recurring-transactions/generate');
      alert(response.data.message);
    } catch (error) {
      console.error('Error generating transactions:', error);
      alert('Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/recurring-transactions', {
        ...addForm,
        amount: parseFloat(addForm.amount),
        day_of_month: parseInt(addForm.day_of_month),
        category_id: addForm.category_id || null,
        subcategory_id: addForm.subcategory_id || null,
      });
      setAddForm({
        amount: '',
        type: 'Dépense',
        description: '',
        category_id: '',
        subcategory_id: '',
        frequency: 'Mensuel',
        day_of_month: 1,
      });
      setShowAddForm(false);
      fetchRecurring();
    } catch (error) {
      console.error('Error adding recurring transaction:', error);
      alert('Erreur lors de l\'ajout');
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      amount: item.amount,
      type: item.type,
      description: item.description || '',
      category_id: item.category_id || '',
      subcategory_id: item.subcategory_id || '',
      frequency: item.frequency,
      day_of_month: item.day_of_month,
    });
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/api/recurring-transactions/${id}`, {
        ...editForm,
        amount: parseFloat(editForm.amount),
        day_of_month: parseInt(editForm.day_of_month),
        category_id: editForm.category_id || null,
        subcategory_id: editForm.subcategory_id || null,
      });
      setEditingId(null);
      fetchRecurring();
    } catch (error) {
      console.error('Error updating recurring transaction:', error);
      alert('Erreur lors de la modification');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette transaction récurrente ?')) {
      return;
    }

    try {
      await api.delete(`/api/recurring-transactions/${id}`);
      fetchRecurring();
    } catch (error) {
      console.error('Error deleting recurring transaction:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || '-';
  };

  const getSubcategoryName = (subcategoryId) => {
    const subcategory = subcategories.find(sub => sub.id === subcategoryId);
    return subcategory?.name || '';
  };

  const filteredCategories = (type) => categories.filter(cat => cat.type === type);
  const filteredSubcategories = (categoryId) => subcategories.filter(sub => sub.category_id === categoryId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <CheckCircle className="h-5 w-5 text-primary-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-primary-900">Génération automatique et manuelle</h4>
            <p className="text-sm text-primary-700 mt-1">
              Les transactions récurrentes peuvent être générées automatiquement ou manuellement avec le bouton ci-dessous.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex-1 bg-success-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-success-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {generating ? (
            <Loader className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Play className="h-5 w-5" />
              <span>Générer les transactions</span>
            </>
          )}
        </button>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex-1 bg-gradient-to-r from-primary-600 to-success-600 text-white px-4 py-3 rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Ajouter une transaction récurrente</span>
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-xl p-6 border-2 border-primary-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Nouvelle transaction récurrente</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={addForm.type}
                  onChange={(e) => setAddForm({ ...addForm, type: e.target.value, category_id: '', subcategory_id: '' })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Dépense">Dépense</option>
                  <option value="Revenu">Revenu</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={addForm.amount}
                  onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: Loyer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie</label>
                <select
                  value={addForm.category_id}
                  onChange={(e) => setAddForm({ ...addForm, category_id: e.target.value, subcategory_id: '' })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Aucune</option>
                  {filteredCategories(addForm.type).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              {addForm.category_id && filteredSubcategories(addForm.category_id).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sous-catégorie</label>
                  <select
                    value={addForm.subcategory_id}
                    onChange={(e) => setAddForm({ ...addForm, subcategory_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Aucune</option>
                    {filteredSubcategories(addForm.category_id).map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fréquence</label>
                <select
                  value={addForm.frequency}
                  onChange={(e) => setAddForm({ ...addForm, frequency: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Mensuel">Mensuel</option>
                  <option value="Annuel">Annuel</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jour du mois</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={addForm.day_of_month}
                  onChange={(e) => setAddForm({ ...addForm, day_of_month: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
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

      {/* Recurring Transactions List */}
      <div className="space-y-3">
        {recurring.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune transaction récurrente configurée</p>
        ) : (
          recurring.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              {editingId === item.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value, category_id: '', subcategory_id: '' })}
                      className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="Dépense">Dépense</option>
                      <option value="Revenu">Revenu</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Description"
                      className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    />
                    <select
                      value={editForm.category_id}
                      onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value, subcategory_id: '' })}
                      className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Aucune catégorie</option>
                      {filteredCategories(editForm.type).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    <select
                      value={editForm.frequency}
                      onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="Mensuel">Mensuel</option>
                      <option value="Annuel">Annuel</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={editForm.day_of_month}
                      onChange={(e) => setEditForm({ ...editForm, day_of_month: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleUpdate(item.id)}
                      className="text-success-600 hover:text-success-800 flex items-center space-x-1"
                    >
                      <Save className="h-4 w-4" />
                      <span className="text-sm">Enregistrer</span>
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-gray-600 hover:text-gray-800 flex items-center space-x-1"
                    >
                      <X className="h-4 w-4" />
                      <span className="text-sm">Annuler</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span
                        className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                          item.type === 'Revenu'
                            ? 'bg-success-100 text-success-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.type}
                      </span>
                      <span className="text-xl font-bold text-gray-900">
                        {item.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                    <p className="text-gray-700 font-medium">{item.description || 'Sans description'}</p>
                    <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-600">
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {getCategoryName(item.category_id)}
                      </span>
                      {item.subcategory_id && (
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          {getSubcategoryName(item.subcategory_id)}
                        </span>
                      )}
                      <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded">
                        {item.frequency} - Jour {item.day_of_month}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => startEdit(item)}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RecurringTransactionsTab;
