import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Upload, Loader, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';

// On garde cette logique au cas où, mais elle ne sera pas utilisée pour l'instant
const monthMap = {
  'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
  'juillet': 6, 'août': 7, 'aoūt': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
};
const normalizeString = (str) => (str || '').trim().toLowerCase();
// Fin de la logique non utilisée

function ImportTab() {
  const [file, setFile] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // --- NOUVEAU : État pour afficher les données de débogage ---
  const [csvDebugData, setCsvDebugData] = useState(null);
  // ---
  
  const [delimiter, setDelimiter] = useState(','); // Par défaut sur ',' pour ton nouvel export

  // On n'a plus besoin de charger les catégories pour ce test
  // useEffect(() => { ... }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
    setCsvDebugData(null); // Réinitialise le débogage
  };

  const handleYearChange = (e) => {
    setYear(e.target.value);
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier CSV.');
      return;
    }
    
    setLoading(true);
    setError('');
    setCsvDebugData(null);

    // --- MODIFICATION DE LA LOGIQUE DE PARSING ---
    Papa.parse(file, {
      delimiter: delimiter, // Utilise le délimiteur choisi
      skipEmptyLines: true,
      // Pas d'encodage spécifié, UTF-8 par défaut
      complete: async (results) => {
        setLoading(false);
        // Au lieu de traiter, on AFFICHE les 10 premières lignes
        const first10Rows = results.data.slice(0, 10);
        setCsvDebugData(JSON.stringify(first10Rows, null, 2));
      },
      error: (err) => {
        setError(`Erreur lors de la lecture du fichier : ${err.message}`);
        setLoading(false);
      },
    });
    // --- FIN DE LA MODIFICATION ---
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Importer depuis un CSV (Mode Débogage)</h3>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Année des données (YYYY)
          </label>
          <input
            type="number"
            value={year}
            onChange={handleYearChange}
            placeholder="Ex: 2024"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Séparateur du fichier CSV
          </label>
          <div className="flex gap-6">
            <label className="flex items-center">
              <input 
                type="radio" 
                value="," 
                checked={delimiter === ','} 
                onChange={() => setDelimiter(',')}
                className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Virgule (,) (Pour UTF-8)</span>
            </label>
            <label className="flex items-center">
              <input 
                type="radio" 
                value=";" 
                checked={delimiter === ';'} 
                onChange={() => setDelimiter(';')}
                className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Point-virgule (;) (Pour ISO)</span>
            </label>
          </div>
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
          <span>{loading ? 'Analyse...' : 'Lancer l\'analyse'}</span>
        </button>
      </div>
      
      {/* --- NOUVEAU BLOC DE DÉBOGAGE --- */}
      {csvDebugData && (
        <div className="space-y-2">
          <h4 className="font-semibold text-gray-800">Données lues depuis le CSV (10 premières lignes) :</h4>
          <pre className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto text-xs">
            {csvDebugData}
          </pre>
        </div>
      )}
      {/* --- FIN DU BLOC --- */}
    </div>
  );
}

// La fonction processCSV n'est pas utilisée dans cette version de débogage,
// mais on la garde pour plus tard.
function processCSV(data, appCategories, year) {
  const transactions = [];
  
  // 1. Trouver la ligne d'en-tête des mois (de manière plus robuste)
  const headerRowIndex = data.findIndex(row => 
    row.some(cell => normalizeString(cell) === 'janvier') && 
    row.some(cell => normalizeString(cell) === 'décembre')
  );
  
  if (headerRowIndex === -1) {
    throw new Error('Impossible de trouver la ligne d\'en-tête des mois (Janvier, Février...)');
  }
  
  const headerRow = data[headerRowIndex].map(cell => normalizeString(cell));
  const monthIndexes = {};
  for (let j = 0; j < headerRow.length; j++) {
    const monthJS = monthMap[headerRow[j]];
    if (monthJS !== undefined) {
      monthIndexes[monthJS] = j;
    }
  }

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
      const colIndex = monthIndexes[monthIndex];
      if (colIndex === undefined) continue;

      const amountStr = (row[colIndex] || '').replace(/€/g, '').replace(/\s/g, '').trim();
      const amount = parseFloat(amountStr.replace(',', '.'));

      if (!amountStr || isNaN(amount) || amount === 0) {
        continue; // Ignore les cellules vides ou à 0
      }
      
      const transactionDate = new Date(year, monthIndex, 15);
      
      transactions.push({
        date: transactionDate.toISOString(),
        amount: Math.abs(amount), 
        type: categoryInfo.type,
        description: `Import CSV - ${row[1].trim()}`,
        category_id: categoryInfo.id,
        subcategory_id: null,
      });
    }
  }
  
  return transactions;
}

export default ImportTab;