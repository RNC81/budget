import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Plus, Edit2, Trash2, Save, X, Loader } from 'lucide-react';

function CategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', type: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', type: 'Dépense' });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/categories', addForm);
      setAddForm({ name: '', type: 'Dépense' });
      setShowAddForm(false);
      fetchCategories();
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Erreur lors de l\'ajout de la catégorie');
    }
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setEditForm({ name: category.name, type: category.type });
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/api/categories/${id}`, editForm);
      setEditingId(null);
      fetchCategories();
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Erreur lors de la modification');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ? Les transactions associées perdront leur catégorie.')) {
      return;
    }

    try {
      await api.delete(`/api/categories/${id}`);
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const revenueCategories = categories.filter(cat => cat.type === 'Revenu');
  const expenseCategories = categories.filter(cat => cat.type === 'Dépense');

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
          <span>Ajouter une catégorie</span>
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-xl p-4 border-2 border-primary-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Nouvelle catégorie</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: Transport"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={addForm.type}
                  onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Dépense">Dépense</option>
                  <option value="Revenu">Revenu</option>
                </select>
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

      {/* Revenue Categories */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-gray-900 flex items-center">
          <span className="bg-success-100 text-success-700 px-3 py-1 rounded-lg text-sm mr-2">Revenus</span>
          <span className="text-gray-500 text-sm">({revenueCategories.length})</span>
        </h3>
        <div className="space-y-2">
          {revenueCategories.map((category) => (
            <div
              key={category.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {editingId === category.id ? (
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={() => handleUpdate(category.id)}
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
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{category.name}</span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEdit(category)}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {revenueCategories.length === 0 && (
            <p className="text-gray-500 text-center py-4">Aucune catégorie de revenu</p>
          )}
        </div>
      </div>

      {/* Expense Categories */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-gray-900 flex items-center">
          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-sm mr-2">Dépenses</span>
          <span className="text-gray-500 text-sm">({expenseCategories.length})</span>
        </h3>
        <div className="space-y-2">
          {expenseCategories.map((category) => (
            <div
              key={category.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {editingId === category.id ? (
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={() => handleUpdate(category.id)}
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
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{category.name}</span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEdit(category)}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {expenseCategories.length === 0 && (
            <p className="text-gray-500 text-center py-4">Aucune catégorie de dépense</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CategoriesTab;