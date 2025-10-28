import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, Settings, Lock, Menu, X } from 'lucide-react';

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Tableau de Bord', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Transactions', href: '/transactions', icon: Receipt },
    { name: 'Paramètres', href: '/settings', icon: Settings },
  ];

  const handleLock = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/access-code');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-success-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="bg-gradient-to-r from-primary-600 to-success-600 text-white rounded-lg p-2">
                  <LayoutDashboard className="h-6 w-6" />
                </div>
                <span className="ml-3 text-xl font-bold bg-gradient-to-r from-primary-600 to-success-600 bg-clip-text text-transparent">
                  Budget Tracker
                </span>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:ml-8 md:flex md:space-x-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary-100 text-primary-700 shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Lock Button Desktop */}
            <div className="hidden md:flex md:items-center">
              <button
                onClick={handleLock}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                title="Verrouiller l'application"
              >
                <Lock className="h-4 w-4 mr-2" />
                Verrouiller
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-2 rounded-lg text-base font-medium ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </Link>
                );
              })}
              <div className="border-t border-gray-200 my-2"></div>
              <button
                onClick={() => {
                  handleLock();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-2 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-100"
              >
                <Lock className="h-5 w-5 mr-3" />
                Verrouiller
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

export default Layout;
