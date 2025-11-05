import React, { useState } from 'react';
// 1. Ajout de l'icône 'Target'
import { Settings as SettingsIcon, Tag, FolderTree, Repeat, Upload, Shield, PiggyBank, Target } from 'lucide-react';
import CategoriesTab from '../components/settings/CategoriesTab';
import SubCategoriesTab from '../components/settings/SubCategoriesTab';
import RecurringTransactionsTab from '../components/settings/RecurringTransactionsTab';
import ImportTab from '../components/settings/ImportTab';
import SecurityTab from '../components/settings/SecurityTab'; 
import BudgetsTab from '../components/settings/BudgetsTab';
// 2. Import du nouveau composant
import SavingsGoalsTab from '../components/settings/SavingsGoalsTab';

function Settings() {
  const [activeTab, setActiveTab] = useState('categories');

  const tabs = [
    { id: 'categories', name: 'Catégories', icon: Tag },
    { id: 'subcategories', name: 'Sous-Catégories', icon: FolderTree },
    { id: 'budgets', name: 'Budgets', icon: PiggyBank },
    // 3. Ajout du nouvel onglet "Objectifs"
    { id: 'goals', name: 'Objectifs', icon: Target },
    { id: 'recurring', name: 'Transactions Récurrentes', icon: Repeat },
    { id: 'import', name: 'Importer', icon: Upload },
    { id: 'security', name: 'Sécurité', icon: Shield }, 
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-3 mb-2">
          <div className="bg-gradient-to-r from-primary-600 to-success-600 text-white rounded-lg p-2">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        </div>
        {/* 4. Mise à jour de la description */}
        <p className="text-gray-600">Gérez vos catégories, budgets, objectifs, importations et sécurité</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1 px-4 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="hidden sm:inline">{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'categories' && <CategoriesTab />}
          {activeTab === 'subcategories' && <SubCategoriesTab />}
          {activeTab === 'budgets' && <BudgetsTab />}
          {/* 5. Rendu du nouveau composant */}
          {activeTab === 'goals' && <SavingsGoalsTab />}
          {activeTab === 'recurring' && <RecurringTransactionsTab />}
          {activeTab === 'import' && <ImportTab />}
          {activeTab === 'security' && <SecurityTab />} 
        </div>
      </div>
    </div>
  );
}

export default Settings;