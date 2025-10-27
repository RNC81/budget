import React, { useState } from 'react';
import { Settings as SettingsIcon, Tag, FolderTree, Repeat } from 'lucide-react';
import CategoriesTab from '../components/settings/CategoriesTab';
import SubCategoriesTab from '../components/settings/SubCategoriesTab';
import RecurringTransactionsTab from '../components/settings/RecurringTransactionsTab';

function Settings() {
  const [activeTab, setActiveTab] = useState('categories');

  const tabs = [
    { id: 'categories', name: 'Catégories', icon: Tag },
    { id: 'subcategories', name: 'Sous-Catégories', icon: FolderTree },
    { id: 'recurring', name: 'Transactions Récurrentes', icon: Repeat },
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
        <p className="text-gray-600">Gérez vos catégories et transactions récurrentes</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1 px-4" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
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
          {activeTab === 'recurring' && <RecurringTransactionsTab />}
        </div>
      </div>
    </div>
  );
}

export default Settings;
