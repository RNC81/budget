import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Plus, Edit2, Trash2, Save, X, Loader } from 'lucide-react';

function SubCategoriesTab() {
  const [subcategories, setSubcategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', category_id: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', category_id: '' });

  useEffect(() => {
    fetchCategories();
    fetchSubcategories();
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
    setLoading(true);
    try {
      const response = await api.get('/api/subcategories');
      setSubcategories(response.data);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/subcategories', addForm);
      setAddForm({ name: '', category_id: '' });
      setShowAddForm(false);
      fetchSubcategories();
    } catch (error) {
      console.error('Error adding subcategory:', error);
      alert('Erreur lors de l\'ajout de la sous-catégorie');
    }
  };

  const startEdit = (subcategory) => {
    setEditingId(subcategory.id);
    setEditForm({ name: subcategory.name, category_id: subcategory.category_id });
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/api/subcategories/${id}`, editForm);
      setEditingId(null);
      fetchSubcategories();
    } catch (error) {
      console.error('Error updating subcategory:', error);
      alert('Erreur lors de la modification');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette sous-catégorie ?')) {
      return;
    }

    try {
      await api.delete(`/api/subcategories/${id}`);
      fetchSubcategories();
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || 'Inconnu';
  };

  const getCategoryType = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.type || '';
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
          <span>Ajouter une sous-catégorie</span>
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-xl p-4 border-2 border-primary-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Nouvelle sous-catégorie</h3>
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
                  placeholder="Ex: Essence"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Catégorie parente</label>
                <select
                  required
                  value={addForm.category_id}
                  onChange={(e) => setAddForm({ ...addForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.type})
                    </option>
                  ))}
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

      {/* Subcategories List */}
      <div className="space-y-2">
        {subcategories.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune sous-catégorie créée</p>
        ) : (
          subcategories.map((subcategory) => (
            <div
              key={subcategory.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {editingId === subcategory.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    />
                    <select
                      value={editForm.category_id}
                      onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({cat.type})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleUpdate(subcategory.id)}
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
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{subcategory.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          getCategoryType(subcategory.category_id) === 'Revenu'
                            ? 'bg-success-100 text-success-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {getCategoryName(subcategory.category_id)}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEdit(subcategory)}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(subcategory.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
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

export default SubCategoriesTab;