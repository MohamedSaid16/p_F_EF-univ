import React from 'react';
import { useTranslation } from 'react-i18next';

export default function DataTables({ data }) {
  const { t } = useTranslation();

  return (
    <div className="mt-8 space-y-8">
      
      {/* 1. Enseignements Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-control-border border-control-border overflow-hidden">
        <div className="p-6 border-b border-control-border border-control-border">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {t('tables.enseignements')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-6 py-4">{t('tables.columns.module')}</th>
                <th className="px-6 py-4">{t('tables.columns.promo')}</th>
                <th className="px-6 py-4">{t('tables.columns.type')}</th>
                <th className="px-6 py-4">{t('tables.columns.year')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.enseignements?.length > 0 ? (
                data.enseignements.map((enseign, idx) => (
                  <tr key={idx} className="bg-white border-b dark:bg-slate-800 border-control-border hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                      {enseign.module?.nom || `Module #${enseign.id}`} <span className="text-slate-400">({enseign.module?.code || 'N/A'})</span>
                    </td>
                    <td className="px-6 py-4">{enseign.promo?.nom || 'Promo non assignee'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-semibold rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 uppercase">
                        {enseign.type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">{enseign.annee_universitaire}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                    No assignments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. PFE Sujets Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-control-border border-control-border overflow-hidden">
        <div className="p-6 border-b border-control-border border-control-border">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {t('tables.pfe')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-6 py-4">{t('tables.columns.title')}</th>
                <th className="px-6 py-4">{t('tables.columns.promo')}</th>
                <th className="px-6 py-4">{t('tables.columns.status')}</th>
                <th className="px-6 py-4">{t('tables.columns.year')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.pfeSujets?.length > 0 ? (
                data.pfeSujets.map((pfe, idx) => {
                  const statusInfo = {
                    propose: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                    valide: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                    affecte: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                    termine: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                  };
                  const sColor = statusInfo[pfe.status] || 'bg-gray-100 text-gray-800';

                  return (
                    <tr key={idx} className="bg-white border-b dark:bg-slate-800 border-control-border hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                        {pfe.titre}
                      </td>
                      <td className="px-6 py-4">{pfe.promo?.nom}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${sColor}`}>
                          {t(`tables.status.${pfe.status || 'propose'}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4">{pfe.annee_universitaire}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                    No PFE Subjects found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

