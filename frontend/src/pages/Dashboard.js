import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { 
  getMonthlyReview, 
  getPendingTransactions, 
  resolvePendingTransaction, 
  deletePendingTransaction 
} from '../api';
import { useAuth } from '../App'; 
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Wallet, Plus, Loader, PiggyBank, Calendar, Filter,
  Repeat, Target, Award, AlertTriangle, Inbox, Check, Trash2
} from 'lucide-react';
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
 * Fonctions d'initialisation
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

function Dashboard() {
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [monthlyReviewData, setMonthlyReviewData] = useState(null);
  const [loadingReview, setLoadingReview] = useState(true);

  // --- NOUVEAU : STATES POUR L'INBOX ---
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [resolvingIds, setResolvingIds] = useState(new Set()); // Pour gérer les loaders par ligne
  
  // State pour stocker les sélections de catégorie/sous-catégorie pour chaque pending transaction
  // Format: { [pendingId]: { categoryId: '', subcategoryId: '' } }
  const [pendingSelections, setPendingSelections] = useState({});
  // --- FIN NOUVEAU ---

  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [appliedParams, setAppliedParams] = useState(() => ({
    start: getInitialStartDate(),
    end: getInitialEndDate(),
  }));

  const [formStartDate, setFormStartDate] = useState(appliedParams.start);
  const [formEndDate, setFormEndDate] = useState(appliedParams.end);
  
  const formatCurrency = (amount) => {
    const safeAmount = typeof amount === 'number' ? amount : 0;
    const currencyCode = user?.currency || 'EUR';
    
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: currencyCode 
    }).format(safeAmount);
  };
  
  // Fetch stats principales
  useEffect(() => {
    fetchStats();
    fetchPendingTransactions(); // Rafraichit l'inbox quand on modifie les données
  }, [refreshKey, appliedParams]); 

  // Initial fetch (Revue, Catégories pour l'Inbox)
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingReview(true);
      try {
        const reviewRes = await getMonthlyReview(); 
        setMonthlyReviewData(reviewRes.data);

        // Récupérer les catégories pour les selects de l'Inbox
        const catsRes = await api.get('/api/categories');
        const subCatsRes = await api.get('/api/subcategories');
        setCategories(catsRes.data);
        setSubCategories(subCatsRes.data);

      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        setLoadingReview(false);
      }
    };

    fetchInitialData();
  }, []);


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

  // --- NOUVELLES FONCTIONS POUR L'INBOX ---
  const fetchPendingTransactions = async () => {
    setLoadingPending(true);
    try {
      const res = await getPendingTransactions();
      setPendingTransactions(res.data);
      
      // Initialiser le state des sélections si vide pour les nouvelles entrées
      const newSelections = { ...pendingSelections };
      res.data.forEach(t => {
        if (!newSelections[t.id]) {
          newSelections[t.id] = { categoryId: '', subcategoryId: '' };
        }
      });
      setPendingSelections(newSelections);

    } catch (err) {
      console.error('Error fetching pending transactions', err);
    } finally {
      setLoadingPending(false);
    }
  };

  const handlePendingSelectionChange = (id, field, value) => {
    setPendingSelections(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
        // Si on change la catégorie, on reset la sous-catégorie
        ...(field === 'categoryId' ? { subcategoryId: '' } : {})
      }
    }));
  };

  const handleResolvePending = async (pendingTx) => {
    const selection = pendingSelections[pendingTx.id];
    
    // Validation basique : forcer le choix d'une catégorie au minimum
    if (!selection || !selection.categoryId) {
      alert("Veuillez sélectionner une catégorie pour valider la transaction.");
      return;
    }

    setResolvingIds(prev => new Set(prev).add(pendingTx.id));

    try {
      await resolvePendingTransaction(pendingTx.id, {
        type: "Dépense", // Apple pay est généralement une dépense
        category_id: selection.categoryId,
        subcategory_id: selection.subcategoryId || null,
        description: pendingTx.merchant // Utilise le marchand comme description
      });
      
      // Rafraichir le dashboard entier
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Failed to resolve transaction', err);
      alert('Erreur lors de la validation.');
    } finally {
      setResolvingIds(prev => {
        const next = new Set(prev);
        next.delete(pendingTx.id);
        return next;
      });
    }
  };

  const handleRejectPending = async (id) => {
    if(window.confirm("Êtes-vous sûr de vouloir ignorer cette transaction en attente ?")) {
      setResolvingIds(prev => new Set(prev).add(id));
      try {
        await deletePendingTransaction(id);
        fetchPendingTransactions(); // Rafraichit juste l'inbox
      } catch (err) {
        console.error('Failed to delete pending transaction', err);
      } finally {
        setResolvingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  };
  // --- FIN FONCTIONS INBOX ---

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

  if (loading && !stats) {
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

  const budgets = stats?.budget_progress;
  const forecast = stats?.estimated_end_of_month_balance;
  const upcomingList = stats?.upcoming_transactions_list;
  const currentGlobalBalance = stats?.global_epargne_totale;
  const savingsGoals = stats?.savings_goals_progress;

  // Filtrer les catégories pour n'afficher que les dépenses dans l'Inbox Apple Pay
  const expenseCategories = categories.filter(c => c.type === 'Dépense');

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

      {/* --- NOUVEAU BLOC : INBOX TRANSACTIONS EN ATTENTE --- */}
      {pendingTransactions.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl shadow-md p-6">
          <div className="flex items-center space-x-3 mb-4 text-yellow-800">
            <Inbox className="h-6 w-6" />
            <h2 className="text-lg font-bold">À Classer ({pendingTransactions.length})</h2>
          </div>
          <p className="text-sm text-yellow-700 mb-4">Ces transactions ont été reçues automatiquement (ex: Apple Pay). Sélectionnez une catégorie pour les ajouter à votre budget.</p>
          
          <div className="space-y-3">
            {pendingTransactions.map(tx => {
              const isResolving = resolvingIds.has(tx.id);
              const selection = pendingSelections[tx.id] || { categoryId: '', subcategoryId: '' };
              const availableSubCats = subCategories.filter(sub => sub.category_id === selection.categoryId);

              return (
                <div key={tx.id} className="bg-white rounded-xl p-4 border border-yellow-300 flex flex-col md:flex-row items-center gap-4 shadow-sm">
                  {/* Info Transaction */}
                  <div className="flex-1 w-full flex items-center justify-between md:justify-start md:space-x-4">
                    <div>
                      <p className="font-semibold text-gray-900">{tx.merchant}</p>
                      <p className="text-xs text-gray-500">{format(new Date(tx.date), 'dd MMM yyyy HH:mm', { locale: fr })}</p>
                    </div>
                    <span className="font-bold text-red-600 ml-auto md:ml-0">
                      -{formatCurrency(tx.amount)}
                    </span>
                  </div>

                  {/* Formulaire de sélection */}
                  <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
                    <select
                      className="border border-gray-300 rounded-lg p-2 text-sm text-gray-700 focus:ring-primary-500 focus:border-primary-500"
                      value={selection.categoryId}
                      onChange={(e) => handlePendingSelectionChange(tx.id, 'categoryId', e.target.value)}
                      disabled={isResolving}
                    >
                      <option value="">Sélectionner catégorie...</option>
                      {expenseCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>

                    <select
                      className="border border-gray-300 rounded-lg p-2 text-sm text-gray-700 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
                      value={selection.subcategoryId}
                      onChange={(e) => handlePendingSelectionChange(tx.id, 'subcategoryId', e.target.value)}
                      disabled={!selection.categoryId || isResolving}
                    >
                      <option value="">Sous-catégorie (Optionnel)</option>
                      {availableSubCats.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2 w-full md:w-auto justify-end">
                    <button
                      onClick={() => handleResolvePending(tx)}
                      disabled={isResolving || !selection.categoryId}
                      className="p-2 bg-success-100 text-success-600 hover:bg-success-200 border border-success-200 rounded-lg transition-colors disabled:opacity-50 flex items-center"
                      title="Valider la transaction"
                    >
                      {isResolving ? <Loader className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => handleRejectPending(tx.id)}
                      disabled={isResolving}
                      className="p-2 bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50 flex items-center"
                      title="Ignorer et supprimer"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* --- FIN BLOC INBOX --- */}


      {/* Filtres */}
      <div className="bg-white rounded-2xl shadow-lg p-4 border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Revenus</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(stats?.revenus_total)}
              </p>
            </div>
            <div className="bg-success-100 rounded-full p-3">
              <TrendingUp className="h-8 w-8 text-success-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Dépenses</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(stats?.depenses_total)}
              </p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className={`bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow ${
          epargnePositive ? 'ring-2 ring-success-200' : 'ring-2 ring-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Épargne (Période)</p>
              <p className={`text-3xl font-bold ${epargnePositive ? 'text-success-600' : 'text-red-600'}`}>
                {formatCurrency(stats?.epargne_total)}
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

        <div className={`bg-white rounded-2xl shadow-lg p-6 border-2 ${
          globalEpargnePositive ? 'border-primary-300' : 'border-red-300'
        } hover:shadow-xl transition-shadow`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Épargne Globale</p>
              <p className={`text-3xl font-bold ${globalEpargnePositive ? 'text-primary-600' : 'text-red-600'}`}>
                {formatCurrency(stats?.global_epargne_totale)}
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


      {/* REVUE MENSUELLE */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Revue du Mois Précédent
          {monthlyReviewData && (
            <span className="text-lg font-normal text-primary-700 ml-2">
              ({monthlyReviewData.display_period})
            </span>
          )}
        </h2>
        
        {loadingReview ? (
          <div className="flex items-center justify-center h-48">
            <Loader className="h-8 w-8 animate-spin text-primary-600" />
            <p className="ml-3 text-gray-600">Chargement de la revue...</p>
          </div>
        ) : !monthlyReviewData ? (
          <div className="text-center text-gray-500 py-6 border-2 border-dashed border-gray-200 rounded-lg">
            <p>Données de la revue mensuelle non disponibles.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm font-medium text-gray-600">Épargné ce mois-là</p>
                <p className={`text-2xl font-bold ${monthlyReviewData.total_saved >= 0 ? 'text-success-600' : 'text-red-600'}`}>
                  {formatCurrency(monthlyReviewData.total_saved)}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm font-medium text-gray-600">Taux d'épargne</p>
                <p className={`text-2xl font-bold ${monthlyReviewData.savings_rate >= 10 ? 'text-success-600' : (monthlyReviewData.savings_rate > 0 ? 'text-yellow-600' : 'text-red-600')}`}>
                  {monthlyReviewData.savings_rate.toFixed(1)}%
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm font-medium text-gray-600">Plus grosse dépense</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(monthlyReviewData.biggest_expense?.amount || 0)}
                </p>
                <p className="text-xs text-gray-500 truncate mt-1" title={monthlyReviewData.biggest_expense?.description}>
                  {monthlyReviewData.biggest_expense?.description || 'N/A'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-success-700 mb-3 flex items-center">
                  <Award className="h-5 w-5 mr-2" />
                  Budgets Respectés
                </h3>
                {monthlyReviewData.respected_budgets.length > 0 ? (
                  <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {monthlyReviewData.respected_budgets.map((budget) => (
                      <li key={budget.category_name} className="flex justify-between items-center text-sm p-2 bg-success-50 rounded-md">
                        <span className="font-medium text-gray-800">{budget.category_name}</span>
                        <span className="text-success-600 font-semibold">
                          Reste: {formatCurrency(budget.difference)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic">Aucun budget respecté ce mois-là.</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-red-700 mb-3 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Budgets Dépassés
                </h3>
                {monthlyReviewData.exceeded_budgets.length > 0 ? (
                  <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {monthlyReviewData.exceeded_budgets.map((budget) => (
                      <li key={budget.category_name} className="flex justify-between items-center text-sm p-2 bg-red-50 rounded-md">
                        <span className="font-medium text-gray-800">{budget.category_name}</span>
                        <span className="text-red-600 font-semibold">
                          Dépassement: {formatCurrency(Math.abs(budget.difference))}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic">Félicitations ! Aucun budget dépassé.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PRÉVISIONS */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Prévisions pour la fin du mois</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Solde global actuel</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatCurrency(currentGlobalBalance)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Changements récurrents à venir</p>
              <p className={`text-2xl font-bold ${stats?.total_upcoming_change >= 0 ? 'text-success-600' : 'text-red-600'}`}>
                {stats?.total_upcoming_change >= 0 ? '+' : ''}
                {formatCurrency(stats?.total_upcoming_change)}
              </p>
            </div>
            <hr className="border-gray-200" />
            <div>
              <p className="text-sm font-medium text-primary-700">Solde estimé fin de mois</p>
              <p className={`text-3xl font-extrabold ${forecast >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
                {formatCurrency(forecast)}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Transactions à venir ce mois-ci</h3>
            {upcomingList && upcomingList.length > 0 ? (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {upcomingList.map((trans, index) => (
                  <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{trans.description}</p>
                      <p className="text-sm text-gray-500">
                        Prévu le {trans.day_of_month} du mois
                      </p>
                    </div>
                    <span className={`font-semibold ${trans.type === 'Revenu' ? 'text-success-600' : 'text-red-600'}`}>
                      {trans.type === 'Revenu' ? '+' : '-'}
                      {formatCurrency(trans.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-6 border-2 border-dashed border-gray-200 rounded-lg">
                <Repeat className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                <p className="font-medium">Aucune transaction récurrente à venir.</p>
                <p className="text-sm mt-1">
                  Les prévisions sont basées sur vos{' '}
                  <Link to="/settings" onClick={() => localStorage.setItem('lastSettingsTab', 'recurring')} className="font-semibold text-primary-600 hover:underline">
                    transactions récurrentes
                  </Link>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BUDGETS */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Suivi des Budgets ({displayPeriod})</h2>
        
        {budgets && budgets.length > 0 ? (
          <div className="space-y-6">
            {budgets.map((budget) => {
              const spent = budget.amount_spent;
              const amount = budget.amount_budgeted;
              const rawPercentage = (amount > 0) ? (spent / amount) * 100 : 0;
              const clampedPercentage = Math.min(rawPercentage, 100);

              let barColor = 'bg-success-600'; 
              if (rawPercentage > 95) {
                barColor = 'bg-red-600'; 
              } else if (rawPercentage > 75) {
                barColor = 'bg-yellow-500'; 
              }

              return (
                <div key={budget.id}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold text-gray-800">{budget.category_name}</span>
                    <span className="text-sm font-medium text-gray-600">
                      {formatCurrency(spent)} / {formatCurrency(amount)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-4 rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${clampedPercentage}%` }}
                    ></div>
                  </div>
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
          <div className="text-center text-gray-500 py-6 border-2 border-dashed border-gray-200 rounded-lg">
            <PiggyBank className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p className="font-medium">Aucun budget défini pour cette période.</p>
            <p className="text-sm mt-1">
              Vous pouvez ajouter des budgets mensuels dans les{' '}
              <Link to="/settings" onClick={() => localStorage.setItem('lastSettingsTab', 'budgets')} className="font-semibold text-primary-600 hover:underline">
                Paramètres
              </Link>.
            </p>
          </div>
        )}
      </div>

      {/* OBJECTIFS D'ÉPARGNE */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Objectifs d'Épargne (Global)</h2>
        
        {savingsGoals && savingsGoals.length > 0 ? (
          <div className="space-y-6">
            {savingsGoals.map((goal) => {
              const current = goal.current_amount;
              const target = goal.target_amount;
              const percentage = (target > 0) ? (current / target) * 100 : 0;
              const clampedPercentage = Math.min(percentage, 100);

              return (
                <div key={goal.id}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold text-gray-800">{goal.name}</span>
                    <span className="text-sm font-medium text-gray-600">
                      {formatCurrency(current)} / {formatCurrency(target)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-4 rounded-full bg-yellow-500 transition-all duration-500" 
                      style={{ width: `${clampedPercentage}%` }}
                    ></div>
                  </div>
                  <p className="text-right text-sm font-semibold text-gray-500 mt-1">
                    {percentage.toFixed(0)}% atteint
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-6 border-2 border-dashed border-gray-200 rounded-lg">
            <Target className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p className="font-medium">Aucun objectif d'épargne défini.</p>
            <p className="text-sm mt-1">
              Vous pouvez ajouter des cagnottes dans les{' '}
              <Link to="/settings" onClick={() => localStorage.setItem('lastSettingsTab', 'goals')} className="font-semibold text-primary-600 hover:underline">
                Paramètres
              </Link>.
            </p>
          </div>
        )}
      </div>

      {/* GRAPHIQUES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    formatter={(value, name) => [formatCurrency(value), name]}
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