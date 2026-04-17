import React, { useEffect, useMemo, useState } from 'react';
import request from '../services/api';

export default function StudentSpecialiteChoicePage({ role = 'student' }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [campagnes, setCampagnes] = useState([]);
  const [options, setOptions] = useState([]);
  const [choices, setChoices] = useState([]);

  const [selectedCampagneId, setSelectedCampagneId] = useState('');
  const [selectedSpecialiteIds, setSelectedSpecialiteIds] = useState([]);
  const canUseStudentApis = role === 'student';

  const selectedCampagne = useMemo(
    () => campagnes.find((campagne) => String(campagne.id) === String(selectedCampagneId)),
    [campagnes, selectedCampagneId]
  );
  const campaignSelectionEnabled = campagnes.length > 0;

  useEffect(() => {
    if (!canUseStudentApis) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [optionsRes, choicesRes] = await Promise.all([
          request('/api/v1/student/specialite-options'),
          request('/api/v1/student/my-choices'),
        ]);

        if (cancelled) {
          return;
        }

        const payload = optionsRes?.data || {};
        const loadedCampagnes = payload.campagnes || [];

        setCampagnes(loadedCampagnes);
        setOptions(payload.options || []);
        setChoices(choicesRes?.data || []);

        if (loadedCampagnes.length > 0) {
          setSelectedCampagneId(String(loadedCampagnes[0].id));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load specialite options');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [canUseStudentApis]);

  if (!canUseStudentApis) {
    return (
      <div className="space-y-4 max-w-5xl min-w-0">
        <h1 className="text-xl font-bold text-ink tracking-tight">Choose Specialite</h1>
        <div className="rounded-lg border border-edge bg-surface p-6 shadow-card">
          <p className="text-sm text-ink-secondary">This page is available for student and delegate accounts only.</p>
        </div>
      </div>
    );
  }

  const toggleChoice = (specialiteId) => {
    setSelectedSpecialiteIds((prev) => {
      if (prev.includes(specialiteId)) {
        return prev.filter((id) => id !== specialiteId);
      }

      if (prev.length >= 5) {
        return prev;
      }

      return [...prev, specialiteId];
    });
  };

  const saveChoices = async () => {
    setSuccess('');
    setError('');

    if (!selectedCampagneId) {
      setError('Please select a campagne first.');
      return;
    }

    if (!selectedSpecialiteIds.length) {
      setError('Select at least one specialite.');
      return;
    }

    setSaving(true);
    try {
      await request('/api/v1/student/choose-specialite', {
        method: 'POST',
        body: JSON.stringify({
          campagneId: Number(selectedCampagneId),
          specialiteIds: selectedSpecialiteIds,
        }),
      });

      const choicesRes = await request('/api/v1/student/my-choices');
      setChoices(choicesRes?.data || []);
      setSelectedSpecialiteIds([]);
      setSuccess('Your specialite choices were saved successfully.');
    } catch (err) {
      setError(err?.message || 'Failed to save choices');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl min-w-0">
      <div>
        <h1 className="text-xl font-bold text-ink tracking-tight">Choose Specialite</h1>
        <p className="mt-1 text-sm text-ink-tertiary">Rank your specialite preferences for the active affectation campaign.</p>
      </div>

      {loading && <div className="rounded-lg border border-edge bg-surface p-6 text-sm text-ink-secondary">Loading options...</div>}

      {!loading && error && (
        <div className="rounded-lg border border-edge-strong bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {!loading && success && (
        <div className="rounded-lg border border-edge-strong bg-success/5 px-4 py-3 text-sm text-success">{success}</div>
      )}

      {!loading && (
        <>
          {!campaignSelectionEnabled && (
            <div className="rounded-lg border border-edge-strong bg-warning/5 px-4 py-3 text-sm text-warning">
              Specialty choice is currently disabled. It will be available when the admin opens the end-of-year campaign.
            </div>
          )}

          <div className="rounded-lg border border-edge bg-surface p-5 shadow-card space-y-4">
            <label className="block text-sm font-medium text-ink-secondary">Campaign</label>
            <select
              value={selectedCampagneId}
              onChange={(event) => setSelectedCampagneId(event.target.value)}
              disabled={!campaignSelectionEnabled}
              className="w-full max-w-lg rounded-md border border-edge bg-canvas px-3 py-2.5 text-sm text-ink"
            >
              <option value="">Select campaign...</option>
              {campagnes.map((campagne) => (
                <option key={campagne.id} value={campagne.id}>
                  {campagne.nom} ({campagne.anneeUniversitaire})
                </option>
              ))}
            </select>

            {selectedCampagne && (
              <p className="text-xs text-ink-muted">
                Open from {new Date(selectedCampagne.dateDebut).toLocaleDateString()} to {new Date(selectedCampagne.dateFin).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-edge bg-surface p-5 shadow-card">
            <h2 className="text-base font-semibold text-ink">Available Specialites</h2>
            <p className="mt-1 text-xs text-ink-muted">You can pick up to 5 choices.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {!campaignSelectionEnabled && (
                <p className="text-sm text-ink-tertiary">No active campaign at this time.</p>
              )}
              {options.map((option) => {
                const selected = selectedSpecialiteIds.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleChoice(option.id)}
                    disabled={!campaignSelectionEnabled}
                    className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      selected
                        ? 'border-brand bg-brand/5 text-brand'
                        : 'border-edge bg-canvas text-ink hover:border-edge-strong'
                    }`}
                  >
                    <p className="font-medium">{option.nom}</p>
                    <p className="mt-1 text-xs opacity-80">Niveau: {option.niveau || 'N/A'}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-ink-muted">Selected: {selectedSpecialiteIds.length}/5</p>
              <button
                type="button"
                onClick={saveChoices}
                disabled={saving || !campaignSelectionEnabled || !selectedSpecialiteIds.length || !selectedCampagneId}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Choices'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-edge bg-surface p-5 shadow-card overflow-x-auto">
            <h2 className="text-base font-semibold text-ink">My Submitted Choices</h2>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-edge-subtle">
                  <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">Campaign</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">Specialite</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-ink-muted uppercase tracking-wider">Order</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-ink-muted uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge-subtle">
                {choices.map((choice) => (
                  <tr key={choice.id}>
                    <td className="px-3 py-2">{choice.campagne?.nom || '-'}</td>
                    <td className="px-3 py-2">{choice.specialite?.nom || '-'}</td>
                    <td className="px-3 py-2 text-center">{choice.ordre}</td>
                    <td className="px-3 py-2 text-center">{choice.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

