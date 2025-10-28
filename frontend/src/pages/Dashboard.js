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

const years = [2025, 2024, 2023]; // Tu peux ajouter plus d'années ici
const months = [
  { value: 'all', name: 'Toute l\'année' },
  { value: 1, name: 'Janvier' },
  { value: 2, name: 'Février' },
  { value: 3, name: 'Mars' },
  { value: 4, name: 'Avril' },
  { value: 5, name: 'Mai' },
  { value: 6, name: 'Juin' },
  { value: 7, name: 'Juillet' },
  { value: 8, name: 'Août' },
  { value: 9, name: 'Septembre' },
  { value: 10, name: 'Octobre' },
  { value: 11, name: 'Novembre' },
  { value: 12, name: 'Décembre' },
];

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // --- NOUVEAUX ÉTATS POUR LES FILTRES ---
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // +1 car les mois JS sont 0-11
  // ---

  useEffect(() => {
    fetchStats();
    // Re-déclenche le fetch si la clé, l'année ou le mois changent
  }, [refreshKey, selectedYear, selectedMonth]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = { year: selectedYear };
      if (selectedMonth !== 'all') {
        params.month = selectedMonth;
      }
      
      const response = await api.get('/api/dashboard/stats', { params });
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

  const epargnePositive = stats?.epargne_total >= 0;
  const hasExpenseData = stats?.expense_breakdown && stats.expense_breakdown.length > 0;
  const displayPeriod = stats?.display_period || 'Mois en cours';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-gray-600 mt-1">
            Vue d'ensemble de vos finances pour : <span className="font-semibold text-primary-700">{displayPeriod}</span>
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-success-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Ajouter une transaction</span>
        </button>
      </div>

      {/* --- NOUVEAUX FILTRES --- */}
      <div className="bg-white rounded-2xl shadow-lg p-4 border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label htmlFor="year-select" className="block text-sm font-medium text-gray-700 mb-1">Année</label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 mb-1">Mois</label>
            <select
              id="month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {/* --- FIN NOUVEAUX FILTRES --- */}


      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Revenus */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Revenus</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.revenus_total?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
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
              <p className="text-sm font-medium text-gray-600 mb-1">Total Dépenses</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.depenses_total?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
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
              <p className="text-sm font-medium text-gray-600 mb-1">Épargne</p>
              <p className={`text-3xl font-bold ${epargnePositive ? 'text-success-600' : 'text-red-600'}`}>
                {stats?.epargne_total?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
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
        
        {/* Graphique Barres (Titre mis à jour) */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Revenus vs Dépenses ({selectedYear})</h2>
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

        {/* Graphique Camembert (Titre mis à jour) */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Répartition des Dépenses ({displayPeriod})</h2>
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
                <p className="text-gray-500">Aucune dépense enregistrée pour cette période.</p>
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