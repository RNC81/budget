import React, { useState, useEffect } from 'react';
import api, { parsePdfTransactions, bulkCreateTransactions } from '../../api';
import { 
  Upload, 
  Loader, 
  AlertCircle, 
  CheckCircle, 
  FileText, 
  Table, 
  Trash2, 
  Check, 
  ChevronRight,
  Info
} from 'lucide-react';
import Papa from 'papaparse';

// --- LOGIQUE CSV EXISTANTE (INCHANGÉE) ---
const monthMap = {
  'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
  'juillet': 6, 'août': 7, 'aoūt': 7, 'aout': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11
};

const normalizeString = (str) => (str || '').trim().toLowerCase();

function ImportTab() {
  const [activeTab, setActiveTab] = useState('csv'); // 'csv' ou 'pdf'
  
  // États communs
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // États CSV
  const [csvFile, setCsvFile] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  // États PDF
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPreview, setPdfPreview] = useState([]); // Liste des transactions extraites

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/categories');
      setCategories(response.data);
    } catch (err) {
      setError('Impossible de charger les catégories.');
    }
  };

  // --- LOGIQUE CSV (EXISTANTE) ---
  const handleCsvSubmit = async () => {
    if (!csvFile) {
      setError('Veuillez sélectionner un fichier CSV.');
      return;
    }
    if (!/^\d{4}$/.test(year)) {
      setError('Veuillez entrer une année valide à 4 chiffres (ex: 2025).');
      return;
    }
    if (categories.length === 0) {
      setError('Les catégories ne sont pas encore chargées.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    Papa.parse(csvFile, {
      delimiter: ";",
      encoding: "ISO-8859-1",
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const transactionsToUpload = processCSV(results.data, categories, parseInt(year));
          if (transactionsToUpload.length === 0) {
            throw new Error('Aucune transaction valide trouvée.');
          }
          const response = await api.post('/api/transactions/bulk', {
            transactions: transactionsToUpload,
          });
          setSuccess(response.data.message || 'Importation CSV réussie !');
          setCsvFile(null);
          if(document.querySelector('input[type="file"]')) document.querySelector('input[type="file"]').value = '';
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setError(`Erreur lecture : ${err.message}`);
        setLoading(false);
      },
    });
  };

  // --- NOUVELLE LOGIQUE PDF (IDÉE 5) ---
  const handlePdfAnalyze = async () => {
    if (!pdfFile) {
      setError('Veuillez sélectionner un fichier PDF.');
      return;
    }
    setLoading(true);
    setError('');
    setPdfPreview([]);

    try {
      const response = await parsePdfTransactions(pdfFile);
      // On ajoute un ID temporaire pour la gestion de la liste en local
      const dataWithTempIds = response.data.map(t => ({
        ...t,
        tempId: uuidv4_fallback(),
        category_id: '' // L'utilisateur devra choisir
      }));
      setPdfPreview(dataWithTempIds);
      if (dataWithTempIds.length === 0) {
        setError("Aucune transaction n'a été détectée dans ce PDF.");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'analyse du PDF.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePdfRow = (tempId) => {
    setPdfPreview(prev => prev.filter(t => t.tempId !== tempId));
  };

  const handleUpdatePdfRow = (tempId, field, value) => {
    setPdfPreview(prev => prev.map(t => 
      t.tempId === tempId ? { ...t, [field]: value } : t
    ));
  };

  const handleFinalPdfImport = async () => {
    setLoading(true);
    setError('');
    try {
      // On prépare les données (suppression des IDs temporaires)
      const transactions = pdfPreview.map(({ tempId, ...rest }) => ({
        ...rest,
        category_id: rest.category_id || null
      }));

      await bulkCreateTransactions(transactions);
      setSuccess(`${transactions.length} transactions importées avec succès !`);
      setPdfPreview([]);
      setPdfFile(null);
    } catch (err) {
      setError("Erreur lors de l'importation finale.");
    } finally {
      setLoading(false);
    }
  };

  const uuidv4_fallback = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  return (
    <div className="space-y-6">
      {/* Sélecteur d'onglet */}
      <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => { setActiveTab('csv'); setError(''); setSuccess(''); }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'csv' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Table className="h-4 w-4" />
          <span>Format CSV "Mon Budget"</span>
        </button>
        <button
          onClick={() => { setActiveTab('pdf'); setError(''); setSuccess(''); }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'pdf' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Relevé Bancaire PDF</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 animate-in fade-in zoom-in-95">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-success-50 border border-success-200 rounded-xl p-4 flex items-start space-x-3 animate-in fade-in zoom-in-95">
          <CheckCircle className="h-5 w-5 text-success-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-success-600 font-medium">{success}</p>
        </div>
      )}

      {/* CONTENU CSV */}
      {activeTab === 'csv' && (
        <div className="space-y-4 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Année des données</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Fichier CSV</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files[0])}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 transition-all"
              />
            </div>
          </div>
          <button
            onClick={handleCsvSubmit}
            disabled={loading || !csvFile}
            className="w-full bg-gradient-to-r from-primary-600 to-success-600 text-white px-4 py-4 rounded-xl font-bold hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? <Loader className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span>{loading ? 'Traitement en cours...' : 'Importer le budget annuel'}</span>
          </button>
        </div>
      )}

      {/* CONTENU PDF */}
      {activeTab === 'pdf' && (
        <div className="space-y-6">
          {!pdfPreview.length ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
              <div className="bg-primary-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto">
                <FileText className="h-8 w-8 text-primary-600" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-900">Analyse de relevé bancaire</h4>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">Téléchargez votre PDF pour extraire automatiquement les transactions.</p>
              </div>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files[0])}
                className="hidden"
                id="pdf-upload"
              />
              <label
                htmlFor="pdf-upload"
                className="inline-block px-6 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 font-bold hover:border-primary-500 hover:text-primary-600 cursor-pointer transition-all"
              >
                {pdfFile ? pdfFile.name : "Choisir un fichier PDF"}
              </label>
              {pdfFile && (
                <button
                  onClick={handlePdfAnalyze}
                  disabled={loading}
                  className="block w-full bg-primary-600 text-white px-4 py-4 rounded-xl font-bold hover:bg-primary-700 transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? <Loader className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
                  <span>Lancer l'analyse</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xl animate-in slide-in-from-bottom-4">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <h4 className="font-bold text-gray-900 flex items-center">
                  <Check className="h-5 w-5 text-success-600 mr-2" />
                  {pdfPreview.length} transactions détectées
                </h4>
                <div className="flex space-x-2">
                   <button 
                    onClick={() => setPdfPreview([])}
                    className="text-sm font-bold text-gray-500 hover:text-red-600 px-3 py-1"
                  >
                    Annuler
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white sticky top-0 shadow-sm">
                    <tr>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">Date</th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">Description</th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">Montant</th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase">Catégorie</th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pdfPreview.map((t) => (
                      <tr key={t.tempId} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-sm font-medium text-gray-900">
                          {new Date(t.date).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <input 
                            type="text"
                            value={t.description}
                            onChange={(e) => handleUpdatePdfRow(t.tempId, 'description', e.target.value)}
                            className="bg-transparent border-none focus:ring-1 focus:ring-primary-500 rounded p-1 w-full text-sm"
                          />
                        </td>
                        <td className={`p-4 text-sm font-bold ${t.type === 'Revenu' ? 'text-success-600' : 'text-red-600'}`}>
                          {t.type === 'Revenu' ? '+' : '-'}{t.amount.toFixed(2)}€
                        </td>
                        <td className="p-4">
                          <select
                            value={t.category_id}
                            onChange={(e) => handleUpdatePdfRow(t.tempId, 'category_id', e.target.value)}
                            className="text-xs p-2 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 outline-none w-full"
                          >
                            <option value="">Sélectionner...</option>
                            {categories.filter(c => c.type === t.type).map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => handleRemovePdfRow(t.tempId)} className="text-gray-400 hover:text-red-600 p-1">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <button
                  onClick={handleFinalPdfImport}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-primary-600 to-success-600 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? <Loader className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                  <span>Valider et importer en base de données</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions communes */}
      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-3">
        <h4 className="font-bold text-gray-800 flex items-center">
          <Info className="h-4 w-4 mr-2 text-primary-600" />
          Instructions d'importation
        </h4>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-600">
          <li className="flex items-center"><ChevronRight className="h-3 w-3 mr-2 text-primary-400" /> CSV : Séparateur point-virgule (;) requis.</li>
          <li className="flex items-center"><ChevronRight className="h-3 w-3 mr-2 text-primary-400" /> PDF : Formats de dates FR (JJ/MM/AAAA) supportés.</li>
          <li className="flex items-center"><ChevronRight className="h-3 w-3 mr-2 text-primary-400" /> Les noms des catégories doivent correspondre exactement.</li>
          <li className="flex items-center"><ChevronRight className="h-3 w-3 mr-2 text-primary-400" /> Vérifiez toujours la preview avant de valider l'import PDF.</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Traite les données parsées du CSV (Format Spécifique "Mon Budget")
 */
function processCSV(data, appCategories, year) {
  const transactions = [];
  let headerRowIndex = -1;
  const monthIndexes = {};

  for (let i = 0; i < data.length; i++) {
    const row = data[i].map(normalizeString);
    if (row.includes('janvier') && row.includes('décembre')) {
      headerRowIndex = i;
      for (let j = 0; j < row.length; j++) {
        const monthJS = monthMap[row[j]];
        if (monthJS !== undefined) monthIndexes[monthJS] = j;
      }
      break;
    }
  }

  if (headerRowIndex === -1) throw new Error('En-tête des mois introuvable.');

  const revenueStartIndex = data.findIndex(row => normalizeString(row[1]) === 'salaire');
  const revenueEndIndex = data.findIndex(row => normalizeString(row[1]) === 'total des revenus');
  const expenseStartIndex = data.findIndex(row => normalizeString(row[1]).startsWith('alimentation'));
  const expenseEndIndex = data.findIndex(row => normalizeString(row[1]) === 'total des dépenses');

  if (revenueStartIndex === -1 || expenseStartIndex === -1) throw new Error('Sections Salaire ou Alimentation introuvables.');

  const categoryMap = {};
  appCategories.forEach(cat => {
    categoryMap[normalizeString(cat.name)] = { id: cat.id, type: cat.type };
  });

  const dataRows = [
    ...data.slice(revenueStartIndex, revenueEndIndex > -1 ? revenueEndIndex : data.length),
    ...data.slice(expenseStartIndex, expenseEndIndex > -1 ? expenseEndIndex : data.length)
  ];

  for (const row of dataRows) {
    const categoryName = normalizeString(row[1]);
    if (!categoryName || categoryName.includes('total')) continue;

    const categoryInfo = categoryMap[categoryName];
    if (!categoryInfo) continue;

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const colIndex = monthIndexes[monthIndex];
      if (colIndex === undefined) continue;

      const amountStr = (row[colIndex] || '').replace(/€/g, '').replace(/\s/g, '').trim();
      const amount = parseFloat(amountStr.replace(',', '.'));

      if (!amountStr || isNaN(amount) || amount === 0) continue;
      
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