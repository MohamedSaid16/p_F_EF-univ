import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

export default function ProfileHeader({ profile }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  const defaultAvatar = "https://ui-avatars.com/api/?name=" + 
    (profile?.nom || 'Teacher') + "+" + (profile?.prenom || '');

  const handleLogout = async () => {
    await logout();
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-control-border border-control-border p-6 flex flex-col md:flex-row items-center justify-between transition-all duration-300 hover:shadow-md">
      
      <div className="flex items-center space-x-6 rtl:space-x-reverse">
        <div className="relative">
          <img 
            src={profile?.photo || defaultAvatar} 
            alt="Profile Avatar" 
            className="w-24 h-24 rounded-full object-cover border-4 border-edge-strong border-edge-strong"
          />
          <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
        </div>
        
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {profile?.nom} {profile?.prenom}
          </h1>
          <div className="flex items-center mt-1 space-x-3 rtl:space-x-reverse">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
              {profile?.grade || 'Professeur'}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {profile?.email}
            </span>
          </div>
          {profile?.bureau && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 flex items-center">
              <svg className="w-4 h-4 mr-1 rtl:ml-1 rtl:mr-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
              Bureau: {profile.bureau}
            </p>
          )}
        </div>
      </div>
      
      <div className="mt-6 md:mt-0 flex flex-col md:items-end gap-3">
        {/* Language Switcher */}
        <button 
          onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en')}
          className="flex items-center justify-center px-4 py-2 w-full md:w-auto text-sm font-medium transition-colors bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <svg className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
          {t('header.switchLang')}
        </button>

        {/* Secure Logout Feature */}
        <button 
          onClick={handleLogout}
          className="flex items-center justify-center px-4 py-2 w-full md:w-auto text-sm font-bold transition-colors bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 shadow-sm border border-edge-strong border-edge-strong"
        >
          <svg className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          {t('logout', { defaultValue: 'Logout' })}
        </button>
      </div>

    </div>
  );
}

