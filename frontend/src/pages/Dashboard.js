import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Plus, Loader } from 'lucide-react';
import TransactionModal from '../components/TransactionModal';

// Couleurs pour le graphique camembert
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#E36414', '#9A348E'];

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchStats();
  }, [refreshKey]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionAdded = () => {
    setRefreshKey(prev => prev + 1);
    setShowModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const epargnePositive = stats?.epargne_du_mois >= 0;
  const hasExpenseData = stats?.expense_breakdown && stats.expense_breakdown.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-gray-600 mt-1">Vue d'ensemble de vos finances ce mois-ci</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-success-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Ajouter une transaction</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Revenus */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Revenus ce mois-ci</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.revenus_ce_mois?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            <div className="bg-success-100 rounded-full p-3">
              <TrendingUp className="h-8 w-8 text-success-600" />
            </div>
          </div>
        </div>

        {/* Dépenses */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Dépenses ce mois-ci</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.depenses_ce_mois?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Épargne */}
        <div className={`bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow ${
          epargnePositive ? 'ring-2 ring-success-200' : 'ring-2 ring-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Épargne du mois</p>
              <p className={`text-3xl font-bold ${epargnePositive ? 'text-success-600' : 'text-red-600'}`}>
                {stats?.epargne_du_mois?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            <div className={`${epargnePositive ? 'bg-success-100' : 'bg-red-100'} rounded-full p-3`}>
              <Wallet className={`h-8 w-8 ${epargnePositive ? 'text-success-600' : 'text-red-600'}`} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {epargnePositive ? '🎉 Excellent travail !' : '⚠️ Attention aux dépenses'}
          </p>
        </div>
      </div>

      {/* Conteneur pour les graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Graphique Barres (existant) */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Revenus vs Dépenses (12 derniers mois)</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.monthly_data || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                />
                <Legend />
                <Bar dataKey="revenus" name="Revenus" fill="#22c55e" radius={[8, 8, 0, 0]} />
                <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* NOUVEAU Graphique Camembert */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Répartition des Dépenses (Mois en cours)</h2>
          <div className="h-96">
            {hasExpenseData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.expense_breakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    fill="#8884d8"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {stats.expense_breakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }), 'Total']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Aucune dépense enregistrée pour ce mois.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Transaction Modal */}
      {showModal && (
        <TransactionModal
          onClose={() => setShowModal(false)}
          onSuccess={handleTransactionAdded}
        />
      )}
    </div>
  );
}

export default Dashboard;