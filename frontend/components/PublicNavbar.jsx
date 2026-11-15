import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function PublicNavbar({ currentPage, onNavigate }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'courses', label: 'Courses' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleNav = (id) => {
    setMobileOpen(false);
    onNavigate(id);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          onClick={() => handleNav('home')}
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
        >
          Ezana Academy
        </button>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-7">
          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
                  active
                    ? 'text-blue-700 border-blue-700'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Right Actions (Login & Get Started, or Dashboard when authenticated) */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {user ? (
            <>
              <button
                onClick={() => handleNav('dashboard')}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {user.role} Dashboard
              </button>
              <button
                onClick={() => {
                  logout();
                  handleNav('home');
                }}
                className="px-3.5 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleNav('login')}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Login
              </button>
              <button
                onClick={() => handleNav('register')}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Get Started
              </button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                currentPage === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
            {user ? (
              <>
                <button
                  onClick={() => handleNav('dashboard')}
                  className="w-full py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg"
                >
                  Open {user.role} Dashboard
                </button>
                <button
                  onClick={() => {
                    logout();
                    handleNav('home');
                  }}
                  className="w-full py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleNav('login')}
                  className="w-full py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg"
                >
                  Login
                </button>
                <button
                  onClick={() => handleNav('register')}
                  className="w-full py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
