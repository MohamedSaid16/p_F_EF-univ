import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import request, { resolveMediaUrl } from '../../../services/api';

const categories = [
  { name: 'All', value: '' },
  { name: 'Administrative', value: 'Administrative' },
  { name: 'Academic', value: 'Academic' },
  { name: 'Events', value: 'Events' },
  { name: 'Research', value: 'Research' },
  { name: 'Student Life', value: 'Student Life' },
];

const ANNOUNCEMENT_PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'Important' },
  { value: 'urgent', label: 'Urgent' },
];

const resolveDisplayText = (ar, en, fallback = '') => {
  if (typeof en === 'string' && en.trim()) return en.trim();
  if (typeof ar === 'string' && ar.trim()) return ar.trim();
  return fallback;
};

const normalizePriority = (item) => String(item?.priority ?? item?.priorite ?? '').toLowerCase();
const isImportantAnnouncement = (item) => ['urgent', 'urgente', 'high', 'haute'].includes(normalizePriority(item));

const getCategoryName = (item) => resolveDisplayText(item?.type?.nom_ar, item?.type?.nom_en, 'General');
const getTitle = (item) => resolveDisplayText(item?.titre_ar, item?.titre_en, 'Untitled announcement');
const getContent = (item) => resolveDisplayText(item?.contenu_ar, item?.contenu_en, '');

const priorityLabel = (item) => {
  const priority = normalizePriority(item);
  if (priority === 'urgent' || priority === 'urgente') return 'Urgent';
  if (priority === 'high' || priority === 'haute') return 'Important';
  if (priority === 'low' || priority === 'basse') return 'Low';
  return 'Standard';
};

const priorityBadgeClass = (item) => {
  const priority = normalizePriority(item);
  if (priority === 'urgent' || priority === 'urgente') return 'border-edge-strong bg-danger/10 text-danger';
  if (priority === 'high' || priority === 'haute') return 'border-edge-strong bg-brand-light text-brand';
  return 'border-edge bg-surface text-ink-secondary';
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const inputClassName = 'w-full rounded-md border border-control-border bg-control-bg px-3 py-2.5 text-sm text-ink outline-none transition-all duration-150 placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50';

function IconChevron({ direction = 'left' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${direction === 'right' ? 'rotate-180' : ''}`} aria-hidden="true">
      <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function News() {
  const { user } = useAuth();
  const isAdmin = useMemo(() => Array.isArray(user?.roles) && user.roles.includes('admin'), [user]);

  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAnnonce, setEditingAnnonce] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [formData, setFormData] = useState({
    titre: '',
    contenu: '',
    typeAnnonce: 'Administrative',
    priority: 'normal',
  });

  const fetchAnnonces = async (typeAnnonce = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeAnnonce) {
        params.set('typeAnnonce', typeAnnonce);
      }

      const queryString = params.toString();
      const endpoint = queryString ? `/api/v1/annonces?${queryString}` : '/api/v1/annonces';
      const response = await request(endpoint);
      setAnnonces(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      console.error(error);
      setAnnonces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnonces(activeCategory);
  }, [activeCategory]);

  const importantAnnouncements = useMemo(() => {
    return annonces
      .filter((item) => isImportantAnnouncement(item))
      .sort((left, right) => {
        const leftWeight = normalizePriority(left) === 'urgent' || normalizePriority(left) === 'urgente' ? 2 : 1;
        const rightWeight = normalizePriority(right) === 'urgent' || normalizePriority(right) === 'urgente' ? 2 : 1;
        if (rightWeight !== leftWeight) {
          return rightWeight - leftWeight;
        }

        const leftDate = new Date(left?.datePublication || left?.createdAt || 0).getTime();
        const rightDate = new Date(right?.datePublication || right?.createdAt || 0).getTime();
        return rightDate - leftDate;
      })
      .slice(0, 6);
  }, [annonces]);

  const featuredAnnouncement = importantAnnouncements[slideIndex] || importantAnnouncements[0] || null;

  useEffect(() => {
    if (importantAnnouncements.length < 2) {
      setSlideIndex(0);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setSlideIndex((previous) => (previous + 1) % importantAnnouncements.length);
    }, 6500);

    return () => window.clearInterval(interval);
  }, [importantAnnouncements.length]);

  useEffect(() => {
    if (slideIndex >= importantAnnouncements.length) {
      setSlideIndex(0);
    }
  }, [importantAnnouncements.length, slideIndex]);

  const resetForm = () => {
    setEditingAnnonce(null);
    setSelectedFile(null);
    setFormData({
      titre: '',
      contenu: '',
      typeAnnonce: 'Administrative',
      priority: 'normal',
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.titre.trim() || !formData.contenu.trim()) {
      window.alert('Title and content are required.');
      return;
    }

    try {
      if (editingAnnonce) {
        await request(`/api/v1/annonces/${editingAnnonce.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        const payload = new FormData();
        payload.append('titre', formData.titre);
        payload.append('contenu', formData.contenu);
        payload.append('typeAnnonce', formData.typeAnnonce);
        payload.append('priority', formData.priority);
        if (selectedFile) {
          payload.append('file', selectedFile);
        }

        await request('/api/v1/annonces', {
          method: 'POST',
          body: payload,
        });
      }

      setShowModal(false);
      resetForm();
      await fetchAnnonces(activeCategory);
    } catch (error) {
      console.error(error);
      window.alert(error?.message || 'Operation failed.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) {
      return;
    }

    try {
      await request(`/api/v1/annonces/${Number(id)}`, { method: 'DELETE' });
      await fetchAnnonces(activeCategory);
    } catch (error) {
      console.error(error);
      window.alert(error?.message || 'Delete failed.');
    }
  };

  const handleEdit = (item) => {
    setEditingAnnonce(item);
    setSelectedFile(null);
    setFormData({
      titre: getTitle(item),
      contenu: getContent(item),
      typeAnnonce: getCategoryName(item),
      priority: normalizePriority(item) || 'normal',
    });
    setShowModal(true);
  };

  const currentSlide = featuredAnnouncement;
  const currentAttachment = currentSlide?.documents?.[0];

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-6 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
      <section className="relative overflow-hidden rounded-lg border border-edge bg-surface shadow-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(220,38,38,0.12),transparent_28%)]" />
        <div className="relative flex flex-col gap-6 px-6 py-8 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-10">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-edge-strong bg-brand-light px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-brand">
              <span className="inline-flex h-2 w-2 rounded-full bg-brand" />
              Announcements
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">News & Announcements</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary md:text-base">
                Institutional updates, academic notices, events, and service alerts in one calm, readable feed.
              </p>
            </div>
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-hover active:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-canvas"
            >
              + New Announcement
            </button>
          ) : null}
        </div>
      </section>

      {featuredAnnouncement ? (
        <section className="overflow-hidden rounded-lg border border-edge bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-edge-subtle px-5 py-4 md:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-danger">Important announcements</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">Urgent bulletin carousel</h2>
            </div>

            {importantAnnouncements.length > 1 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSlideIndex((previous) => (previous - 1 + importantAnnouncements.length) % importantAnnouncements.length)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-canvas text-ink-secondary transition-all duration-150 hover:border-edge-strong hover:bg-brand-light hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-canvas"
                  aria-label="Previous important announcement"
                >
                  <IconChevron />
                </button>
                <button
                  type="button"
                  onClick={() => setSlideIndex((previous) => (previous + 1) % importantAnnouncements.length)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-canvas text-ink-secondary transition-all duration-150 hover:border-edge-strong hover:bg-brand-light hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-canvas"
                  aria-label="Next important announcement"
                >
                  <IconChevron direction="right" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative min-h-[320px] overflow-hidden bg-surface">

              <div className="relative flex h-full flex-col justify-between gap-6 p-6 md:p-8">
                <div className="max-w-3xl space-y-4">
                  <h3 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">{getTitle(currentSlide)}</h3>
                  <p className="max-w-2xl text-sm leading-6 text-ink-secondary md:text-base">
                    {getContent(currentSlide) || 'Priority announcement highlighted for immediate visibility across the university community.'}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {currentAttachment?.fichier ? (
                    <a
                      href={resolveMediaUrl(currentAttachment.fichier)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md border border-edge-strong bg-brand-light px-3 py-2.5 text-sm font-medium text-brand transition-all duration-150 hover:bg-brand/15 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    >
                      Open uploaded document
                    </a>
                  ) : (
                    <p className="text-sm text-ink-secondary">No document attached to this announcement.</p>
                  )}

                  {importantAnnouncements.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {importantAnnouncements.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSlideIndex(index)}
                          className={`h-2.5 rounded-full transition-all duration-150 ${
                            slideIndex === index ? 'w-8 bg-brand' : 'w-2.5 bg-surface-300 hover:bg-brand/40'
                          }`}
                          aria-label={`Show important announcement ${index + 1}`}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-edge bg-surface p-4 pt-6 shadow-card md:p-6 md:pt-6">
        <div className="flex flex-col gap-4 pt-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Browse</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">All announcements</h2>
            <p className="mt-2 text-sm text-ink-secondary">Filter by category to focus on the news that matters to you.</p>
          </div>

          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 lg:justify-end">
            {categories.map((category) => (
              <button
                key={category.name}
                type="button"
                onClick={() => setActiveCategory(category.value)}
                className={`shrink-0 whitespace-nowrap rounded-md border px-4 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-canvas ${
                  activeCategory === category.value
                    ? 'border-edge-strong bg-brand-light text-brand'
                    : 'border-edge bg-surface text-ink-secondary hover:bg-surface-200 hover:text-ink'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-lg border border-edge bg-surface p-10 text-center shadow-card">
          <p className="text-sm font-medium text-ink-secondary">Loading announcements...</p>
        </div>
      ) : annonces.length === 0 ? (
        <div className="rounded-lg border border-edge bg-surface p-10 text-center shadow-card">
          <p className="text-sm font-medium text-ink">No announcements found</p>
          <p className="mt-2 text-sm text-ink-secondary">Try another category or create a new announcement if you have admin access.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {annonces.map((item) => {
            const attachment = item?.documents?.[0];
            const dateValue = item?.datePublication || item?.createdAt;
            const displayDate = formatDate(dateValue);
            const urgent = isImportantAnnouncement(item);
            const attachmentUrl = attachment?.fichier ? resolveMediaUrl(attachment.fichier) : '';

            return (
              <article key={item.id} className="group overflow-hidden rounded-lg border border-edge bg-surface shadow-card transition-all duration-200">
                <div className={`h-1 ${urgent ? 'bg-danger' : 'bg-brand'}`} />
                <div className="p-5 md:p-6">
                  <div className="flex flex-col gap-3 border-b border-edge-subtle pb-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityBadgeClass(item)}`}>
                        {priorityLabel(item)}
                      </span>
                      <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                        {getCategoryName(item)}
                      </span>
                    </div>
                    <span className="text-xs text-ink-tertiary">{displayDate}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <h3 className="text-lg font-semibold tracking-tight text-ink md:text-xl">{getTitle(item)}</h3>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-ink-secondary">
                      {getContent(item)}
                    </p>
                  </div>

                  {attachmentUrl ? (
                    <div className="mt-4 rounded-md border border-edge-subtle bg-canvas p-3">
                      <a
                        href={attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-brand transition-all duration-150 hover:text-brand-hover"
                      >
                        View attachment
                      </a>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge-subtle pt-4 text-sm text-ink-tertiary">
                    <span>
                      By {item?.auteur?.prenom || ''} {item?.auteur?.nom || ''}
                    </span>
                    {urgent ? <span className="font-medium text-danger">Priority item</span> : null}
                  </div>

                  {isAdmin ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="inline-flex items-center justify-center rounded-md border border-edge bg-surface px-4 py-2.5 text-sm font-medium text-ink-secondary transition-all duration-150 hover:bg-surface-200 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-canvas"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="inline-flex items-center justify-center rounded-md bg-danger px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-danger/30 focus:ring-offset-2 focus:ring-offset-canvas"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-edge bg-surface shadow-card">
            <div className="border-b border-edge-subtle px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Administration</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">
                {editingAnnonce ? 'Edit Announcement' : 'New Announcement'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-secondary">Title</label>
                <input
                  type="text"
                  placeholder="Title"
                  className={inputClassName}
                  value={formData.titre}
                  onChange={(event) => setFormData((prev) => ({ ...prev, titre: event.target.value }))}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-secondary">Content</label>
                <textarea
                  placeholder="Content"
                  className={`${inputClassName} min-h-[180px] resize-y`}
                  value={formData.contenu}
                  onChange={(event) => setFormData((prev) => ({ ...prev, contenu: event.target.value }))}
                />
              </div>

              {!editingAnnonce ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-secondary">Attach File (optional)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    className="block w-full rounded-md border border-control-border bg-control-bg px-3 py-2 text-sm text-ink-secondary file:mr-3 file:rounded-md file:border file:border-edge file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-secondary hover:file:bg-surface-200 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-secondary">Category</label>
                <select
                  className={inputClassName}
                  value={formData.typeAnnonce}
                  onChange={(event) => setFormData((prev) => ({ ...prev, typeAnnonce: event.target.value }))}
                >
                  {categories.slice(1).map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-secondary">
                  Priority <span className="text-danger">*</span>
                </label>
                <select
                  className={inputClassName}
                  value={formData.priority}
                  onChange={(event) => setFormData((prev) => ({ ...prev, priority: event.target.value }))}
                >
                  {ANNOUNCEMENT_PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-ink-tertiary">Urgent and important items are shown in the news page urgent slider.</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="inline-flex items-center justify-center rounded-md border border-edge bg-surface px-4 py-2.5 text-sm font-medium text-ink-secondary transition-all duration-150 hover:bg-surface-200 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-canvas"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-hover active:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-canvas"
                >
                  {editingAnnonce ? 'Update' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
