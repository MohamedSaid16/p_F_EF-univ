import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import NoteForm from './NoteForm';
import AttendanceButtons from './AttendanceButtons';

export default function StudentTable({ students, enseignementId, onDataChange }) {
  const { t } = useTranslation();
  const [editingStudent, setEditingStudent] = useState(null);

  if (!students || students.length === 0) {
    return <div className="text-center p-6 text-slate-500 bg-white dark:bg-slate-800 rounded-xl">{t('noStudents')}</div>;
  }

  const moduleConfig = students[0]?.moduleMetrics || { hasTd: false, hasTp: false };

  const handleExclusionOverride = async (etudiantId, currentOverrideState) => {
    try {
      await fetch(`/api/students/exclusion/${etudiantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enseignementId: parseInt(enseignementId),
          overridden: !currentOverrideState
        })
      });
      onDataChange();
    } catch (err) {
      console.error("Failed to toggle exclusion logic");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-control-border border-control-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-control-border border-control-border">
            <tr>
              <th className="px-6 py-4">{t('matricule')}</th>
              <th className="px-6 py-4">{t('studentName')}</th>
              <th className="px-6 py-4">{t('absences')}</th>
              <th className="px-6 py-4">{t('status')}</th>
              
              <th className="px-6 py-4 text-center">{t('examNote')}</th>
              {moduleConfig.hasTd && <th className="px-6 py-4 text-center">{t('tdNote')}</th>}
              {moduleConfig.hasTp && <th className="px-6 py-4 text-center">{t('tpNote')}</th>}
              
              <th className="px-6 py-4 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-medium">
            {students.map(student => {
              const notes = student.notes || {};
              const isExcludedAlert = student.status === 'Excluded';
              const isOverrideActive = student.status === 'Active (Override)';
              
              return (
                <React.Fragment key={student.id}>
                  <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${isExcludedAlert ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                    <td className="px-6 py-4 font-mono text-slate-500">{student.matricule || 'N/A'}</td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                      {student.nom} {student.prenom}
                    </td>
                    
                    {/* Absences Counter Column */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-400"></div> {student.absences.unjustified} {t('unjustified')}</span>
                        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-400"></div> {student.absences.justified} {t('justified')}</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs rounded-full font-bold flex items-center justify-center w-max ${
                        isExcludedAlert ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 
                        isOverrideActive ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30' : 
                        'bg-green-100 text-green-600 dark:bg-green-900/30'
                      }`}>
                        {t(isExcludedAlert ? 'excluded' : isOverrideActive ? 'excludedOverride' : 'active')}
                      </span>
                      
                      {/* Exclusion Toggle Button (for Teacher to manually forgive) */}
                      {(student.isAutomaticallyExcluded) && (
                        <button 
                          onClick={() => handleExclusionOverride(student.id, student.isOverridden)}
                          className="mt-2 text-[10px] uppercase font-bold text-blue-500 hover:text-blue-600 underline"
                        >
                          {student.isOverridden ? t('restoreExclusion') : t('overrideExclusion')}
                        </button>
                      )}
                    </td>

                    {/* Notes columns */}
                    <td className="px-6 py-4 text-center font-bold text-blue-600">{notes.note_exam !== undefined && notes.note_exam !== null ? notes.note_exam : '-'}</td>
                    {moduleConfig.hasTd && <td className="px-6 py-4 text-center font-bold text-slate-700 dark:text-slate-300">{notes.note_td !== undefined && notes.note_td !== null ? notes.note_td : '-'}</td>}
                    {moduleConfig.hasTp && <td className="px-6 py-4 text-center font-bold text-slate-700 dark:text-slate-300">{notes.note_tp !== undefined && notes.note_tp !== null ? notes.note_tp : '-'}</td>}

                    {/* Actions Column */}
                    <td className="px-6 py-4 text-right space-x-2 rtl:space-x-reverse min-w-[200px]">
                      <AttendanceButtons 
                        etudiantId={student.id} 
                        enseignementId={enseignementId} 
                        onAttendanceMarked={onDataChange} 
                      />
                      <button 
                        onClick={() => setEditingStudent(student.id === editingStudent ? null : student.id)}
                        className="p-2 ml-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-colors border border-control-border border-control-border shadow-sm"
                        title={t('editNotes')}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </td>
                  </tr>

                  {/* Inline Editor Form if editing this student */}
                  {editingStudent === student.id && (
                    <tr className="bg-blue-50/40 dark:bg-blue-900/10 border-b border-edge-strong border-edge-strong">
                      <td colSpan="100%" className="p-0">
                        <NoteForm 
                          student={student} 
                          enseignementId={enseignementId}
                          moduleConfig={moduleConfig}
                          onClose={() => setEditingStudent(null)} 
                          onSaved={() => {
                            setEditingStudent(null);
                            onDataChange();
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

