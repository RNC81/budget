import React, { useState, useEffect } from 'react';
// 1. Import de 'Link' pour le lien vers les paramètres
import { Link } from 'react-router-dom';
import api from '../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Plus, Loader, PiggyBank, Calendar, Filter } from 'lucide-react';
import TransactionModal from '../components/TransactionModal';

import DatePicker, { registerLocale } from 'react-datepicker';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale/fr';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('fr', fr);

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', 
  '#E36414', '#9A348E', '#FF0000', '#3E619B', '#48A9A6',
  '#E4B7E5', '#FB9F89', '#B9E28C', '#F1E189', '#94C9F1'
];

/**
 * Fonctions d'initialisation (identiques)
 */
const getInitialStartDate = () => {
  const savedDate = localStorage.getItem('dashboardStartDate');
  if (savedDate && !isNaN(new Date(savedDate))) {
    return new Date(savedDate);
  }
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
};

const getInitialEndDate = () => {
  const savedDate = localStorage.getItem('dashboardEndDate');
  if (savedDate && !isNaN(new Date(savedDate))) {
    return new Date(savedDate);
  }
  return new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
};

// 2. Ajout d'une fonction helper pour le formatage
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};


function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [appliedParams, setAppliedParams] = useState(() => ({
    start: getInitialStartDate(),
    end: getInitialEndDate(),
  }));

  const [formStartDate, setFormStartDate] = useState(appliedParams.start);
  const [formEndDate, setFormEndDate] = useState(appliedParams.end);
  
  useEffect(() => {
    fetchStats();
  }, [refreshKey, appliedParams]); 

  const fetchStats = async () => {
    setLoading(true);
    
    if (!appliedParams.start || !appliedParams.end) {
      setLoading(false);
      return;
    }

    try {
      const params = {
        start_date_str: format(appliedParams.start, 'yyyy-MM-dd'),
        end_date_str: format(appliedParams.end, 'yyyy-MM-dd')
      };
      
      const response = await api.get('/api/dashboard/stats', { params: params });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    localStorage.setItem('dashboardStartDate', formStartDate.toISOString());
    localStorage.setItem('dashboardEndDate', formEndDate.toISOString());
    setAppliedParams({
      start: formStartDate,
      end: formEndDate,
    });
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
  const globalEpargnePositive = stats?.global_epargne_totale >= 0;
  const hasExpenseData = stats?.expense_breakdown && stats.expense_breakdown.length > 0;
  
  const displayPeriod = stats?.display_period || 'Période sélectionnée';
  const displayYear = appliedParams.start ? appliedParams.start.getFullYear() : new Date().getFullYear();

  // 3. Récupération des données de budget
  const budgets = stats?.budget_progress;

  return (
    <div className="space-y-8">
      {/* Header (Identique) */}
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

      {/* Filtres (Identique) */}
      <div className="bg-white rounded-2xl shadow-lg p-4 border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          
          {/* Sélecteur Date de Début */}
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <div className="relative">
              <DatePicker
                id="start-date"
                selected={formStartDate}
                onChange={(date) => setFormStartDate(date)} 
                selectsStart
                startDate={formStartDate}
                endDate={formEndDate}
                locale="fr"
                dateFormat="dd/MM/yyyy"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
              />
              <Calendar className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          
          {/* Sélecteur Date de Fin */}
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <div className="relative">
              <DatePicker
                id="end-date"
                selected={formEndDate}
                onChange={(date) => setFormEndDate(date)} 
                selectsEnd
                startDate={formStartDate}
                endDate={formEndDate}
                minDate={formStartDate}
                locale="fr"
                dateFormat="dd/MM/yyyy"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
              />
              <Calendar className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          
          {/* Bouton "Appliquer" */}
          <div className="flex-shrink-0 w-full sm:w-auto">
            <button
              onClick={handleApplyFilter}
              disabled={!formStartDate || !formEndDate}
              className="w-full sm:w-auto bg-primary-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-700 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Filter className="h-5 w-5" />
              <span>Appliquer</span>
            </button>
          </div>

        </div>
      </div>

      {/* Stats Cards (Identique) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Revenus */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Revenus</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(stats?.revenus_total || 0)}
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
                {formatCurrency(stats?.depenses_total || 0)}
              </p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Épargne (Période) */}
        <div className={`bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow ${
          epargnePositive ? 'ring-2 ring-success-200' : 'ring-2 ring-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Épargne (Période)</p>
              <p className={`text-3xl font-bold ${epargnePositive ? 'text-success-600' : 'text-red-600'}`}>
                {formatCurrency(stats?.epargne_total || 0)}
              </p>
            </div>
            <div className={`${epargnePositive ? 'bg-success-100' : 'bg-red-100'} rounded-full p-3`}>
              <Wallet className={`h-8 w-8 ${epargnePositive ? 'text-success-600' : 'text-red-600'}`} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 truncate" title={displayPeriod}>
            {displayPeriod}
          </p>
        </div>

        {/* ÉPARGNE GLOBALE */}
        <div className={`bg-white rounded-2xl shadow-lg p-6 border-2 ${
          globalEpargnePositive ? 'border-primary-300' : 'border-red-300'
        } hover:shadow-xl transition-shadow`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Épargne Globale</p>
              <p className={`text-3xl font-bold ${globalEpargnePositive ? 'text-primary-600' : 'text-red-600'}`}>
                {formatCurrency(stats?.global_epargne_totale || 0)}
              </p>
            </div>
            <div className={`${globalEpargnePositive ? 'bg-primary-100' : 'bg-red-100'} rounded-full p-3`}>
              <PiggyBank className={`h-8 w-8 ${globalEpargnePositive ? 'text-primary-600' : 'text-red-600'}`} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Total de tout votre historique
          </p>
        </div>
      </div>
      {/* --- FIN DES STATS CARDS --- */}


      {/* ---
        4. NOUVEAU BLOC : SUIVI DES BUDGETS
        ---
      */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Suivi des Budgets ({displayPeriod})</h2>
        
        {budgets && budgets.length > 0 ? (
          <div className="space-y-6">
            {budgets.map((budget) => {
              // Calcul des pourcentages
              const spent = budget.spent;
              const amount = budget.amount;
              // % brut (peut dépasser 100%)
              const rawPercentage = (spent / amount) * 100;
              // % plafonné à 100% pour la barre visuelle
              const clampedPercentage = Math.min(rawPercentage, 100);

              // Choix de la couleur
              let barColor = 'bg-success-600'; // Vert
              if (rawPercentage > 95) {
                barColor = 'bg-red-600'; // Rouge
              } else if (rawPercentage > 75) {
                barColor = 'bg-yellow-500'; // Orange/Jaune
              }

              return (
                <div key={budget.id}>
                  {/* Légende (Nom et montants) */}
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold text-gray-800">{budget.category_name}</span>
                    <span className="text-sm font-medium text-gray-600">
                      {formatCurrency(spent)} / {formatCurrency(amount)}
                    </span>
                  </div>
                  {/* Barre de progression */}
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-4 rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${clampedPercentage}%` }}
                    ></div>
                  </div>
                  {/* Indicateur de dépassement */}
                  {rawPercentage > 100 && (
                    <p className="text-right text-sm font-semibold text-red-600 mt-1">
                      Dépassement de {formatCurrency(spent - amount)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // --- Placeholder s'il n'y a pas de budget ---
          <div className="text-center text-gray-500 py-6 border-2 border-dashed border-gray-200 rounded-lg">
            <PiggyBank className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p className="font-medium">Aucun budget défini pour cette période.</p>
            <p className="text-sm mt-1">
              Vous pouvez ajouter des budgets mensuels dans les{' '}
              <Link to="/settings" className="font-semibold text-primary-600 hover:underline">
                Paramètres
              </Link>.
            </p>
          </div>
        )}
      </div>
      {/* --- FIN DU NOUVEAU BLOC BUDGETS --- */}


      {/* Conteneur pour les graphiques (Identique) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Graphique Barres */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Revenus vs Dépenses ({displayYear})</h2>
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
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend />
                <Bar dataKey="revenus" name="Revenus" fill="#22c55e" radius={[8, 8, 0, 0]} />
                <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique Camembert */}
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
                  >
                    {stats.expense_breakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), 'Total']}
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

      {/* Transaction Modal (Identique) */}
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
