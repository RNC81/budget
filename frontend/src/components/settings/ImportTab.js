import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Upload, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';

// Fait correspondre les mois du CSV aux numéros (base 0 pour JS Date)
// Gère "Août" (2024) et "Aoūt" (2025) et "Aout" (sans accent)
const monthMap = {
  'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
  'juillet': 6, 'août': 7, 'aoūt': 7, 'aout': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
};

// Fonction pour nettoyer les noms (utilisée pour les mois et les catégories)
const normalizeString = (str) => (str || '').trim().toLowerCase();

function ImportTab() {
  const [file, setFile] = useState(null);
  // On initialise en string pour être sûr, mais la nouvelle validation gère les deux
  const [year, setYear] = useState(new Date().getFullYear().toString()); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [categories, setCategories] = useState([]);

  // Charge les catégories de l'application pour faire la correspondance
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/api/categories');
        setCategories(response.data);
      } catch (err) {
        setError('Impossible de charger les catégories. Veuillez actualiser.');
      }
    };
    fetchCategories();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
    setSuccess('');
  };

  const handleYearChange = (e) => {
    setYear(e.target.value);
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier CSV.');
      return;
    }

    // --- CORRECTION DU BUG DE VALIDATION ---
    // On utilise une regex pour vérifier que 'year' est bien composé de 4 chiffres.
    // Cela fonctionne que 'year' soit un nombre (2025) ou une chaîne ("2025").
    if (!/^\d{4}$/.test(year)) {
      setError('Veuillez entrer une année valide à 4 chiffres (ex: 2025).');
      return;
    }
    // --- FIN DE LA CORRECTION ---

    if (categories.length === 0) {
      setError('Les catégories ne sont pas encore chargées. Réessayez dans un instant.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    Papa.parse(file, {
      delimiter: ";", // Force le point-virgule
      encoding: "ISO-8859-1", // Force la lecture des accents type "Excel Français"
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const transactionsToUpload = processCSV(results.data, categories, parseInt(year));
          
          if (transactionsToUpload.length === 0) {
            setError('Aucune transaction valide trouvée dans le fichier. Vérifiez le format ou les noms de catégories.');
            setLoading(false);
            return;
          }

          // Envoie les transactions au backend
          const response = await api.post('/api/transactions/bulk', {
            transactions: transactionsToUpload,
          });

          setSuccess(response.data.message || 'Importation réussie !');
          setFile(null);
          // Réinitialise le champ 'file' dans le DOM pour pouvoir re-télécharger le même fichier
          if(document.querySelector('input[type="file"]')) {
            document.querySelector('input[type="file"]').value = '';
          }
        } catch (err) {
          setError(err.message || 'Une erreur est survenue lors du traitement ou de l\'envoi.');
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setError(`Erreur lors de la lecture du fichier : ${err.message}`);
        setLoading(false);
      },
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Importer depuis un CSV</h3>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-success-50 border border-success-200 rounded-lg p-4 flex items-start space-x-3">
          <CheckCircle className="h-5 w-5 text-success-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-success-600">{success}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Année des données (YYYY)
          </label>
          <input
            type="number" // On garde "number" pour le clavier mobile, la validation gère le reste
            value={year}
            onChange={handleYearChange}
            placeholder="Ex: 2025"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fichier CSV (format "Mon Budget XXXX")
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary-50 file:text-primary-700
                      hover:file:bg-primary-100"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !file}
          className="w-full bg-gradient-to-r from-primary-600 to-success-600 text-white px-4 py-3 rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {loading ? (
            <Loader className="h-5 w-5 animate-spin" />
          ) : (
            <Upload className="h-5 w-5" />
          )}
          <span>{loading ? 'Traitement...' : 'Lancer l\'importation'}</span>
        </button>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg border">
        <h4 className="font-semibold text-gray-800">Instructions :</h4>
        <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
          <li>Le script s'attend à un fichier CSV avec **point-virgule (;) comme séparateur**.</li>
          <li>L'année doit être correctement renseignée.</li>
          <li>Les noms des catégories dans le CSV (colonne B) doivent **exactement** correspondre aux noms de vos catégories dans l'application (pense aux espaces ou aux `/` !).</li>
          <li>Les lignes "Total" et les lignes vides seront ignorées.</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Traite les données parsées du CSV pour les transformer en transactions
 * @param {Array} data - Données de PapaParse (Array d'Arrays)
 * @param {Array} appCategories - Liste des catégories de l'app (venant de /api/categories)
 * @param {number} year - L'année sélectionnée par l'utilisateur
 * @returns {Array} - Une liste d'objets TransactionCreate
 */
function processCSV(data, appCategories, year) {
  const transactions = [];
  
  // --- LOGIQUE DE DÉTECTION D'EN-TÊTE AMÉLIORÉE ---
  let headerRowIndex = -1;
  let headerRow = [];
  const monthIndexes = {}; // Va stocker { 0: 2, 1: 3, ... } (moisJS: indexColonne)

  for (let i = 0; i < data.length; i++) {
    const row = data[i].map(normalizeString);
    if (row.includes('janvier') && row.includes('décembre')) {
      headerRowIndex = i;
      headerRow = row;
      // On mappe les index de colonnes pour chaque mois
      for (let j = 0; j < row.length; j++) {
        const monthJS = monthMap[row[j]];
        if (monthJS !== undefined) {
          monthIndexes[monthJS] = j; // ex: monthIndexes[0] = 2 (colonne 'Janvier' est à l'index 2)
        }
      }
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Impossible de trouver la ligne d\'en-tête des mois (Janvier, Février...)');
  }
  // --- FIN DE LA LOGIQUE D'EN-TÊTE ---


  // 2. Trouver la section des Revenus (en se basant sur "Salaire" ou "Total des revenus")
  const revenueStartIndex = data.findIndex(row => normalizeString(row[1]) === 'salaire');
  const revenueEndIndex = data.findIndex(row => normalizeString(row[1]) === 'total des revenus');
  
  // 3. Trouver la section des Dépenses (en se basant sur "Alimentation" ou "Total des dépenses")
  const expenseStartIndex = data.findIndex(row => normalizeString(row[1]).startsWith('alimentation'));
  const expenseEndIndex = data.findIndex(row => normalizeString(row[1]) === 'total des dépenses');

  if (revenueStartIndex === -1 || expenseStartIndex === -1) {
    throw new Error('Impossible de trouver les sections "Salaire" ou "Alimentation".');
  }

  // 4. Créer un mappage Nom de Catégorie -> ID & Type
  const categoryMap = {};
  appCategories.forEach(cat => {
    categoryMap[normalizeString(cat.name)] = {
      id: cat.id,
      type: cat.type,
    };
  });

  // 5. Parcourir les lignes de données (revenus et dépenses)
  const dataRows = [
    ...data.slice(revenueStartIndex, revenueEndIndex > -1 ? revenueEndIndex : data.length),
    ...data.slice(expenseStartIndex, expenseEndIndex > -1 ? expenseEndIndex : data.length)
  ];

  for (const row of dataRows) {
    const categoryName = normalizeString(row[1]);
    
    // Ignore les lignes vides ou les totaux
    if (!categoryName || categoryName.includes('total')) {
      continue;
    }

    const categoryInfo = categoryMap[categoryName];
    
    if (!categoryInfo) {
      console.warn(`Catégorie ignorée (non trouvée dans l'app) : "${row[1].trim()}"`);
      continue;
    }

    // 6. Parcourir les 12 mois
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      // Trouve la colonne correspondante (ex: colonne 2 pour mois 0)
      const colIndex = monthIndexes[monthIndex];
      if (colIndex === undefined) continue; // Mois non trouvé dans l'en-tête ?

      // --- Logique de nettoyage des montants améliorée ---
      // Enlève "€", enlève les espaces (ex: "1 677,01 €")
      const amountStr = (row[colIndex] || '').replace(/€/g, '').replace(/\s/g, '').trim();
      // Remplace la virgule décimale par un point
      const amount = parseFloat(amountStr.replace(',', '.'));

      if (!amountStr || isNaN(amount) || amount === 0) {
        continue; // Ignore les cellules vides ou à 0
      }
      
      // On met le 15 du mois par défaut pour éviter les pbs de fuseaux horaires
      const transactionDate = new Date(year, monthIndex, 15);
      
      transactions.push({
        date: transactionDate.toISOString(),
        amount: Math.abs(amount), // Assure que le montant est positif
        type: categoryInfo.type, // "Revenu" ou "Dépense"
        description: `Import CSV - ${row[1].trim()}`,
        category_id: categoryInfo.id,
        subcategory_id: null,
      });
    }
  }
  
  return transactions;
}

export default ImportTab;