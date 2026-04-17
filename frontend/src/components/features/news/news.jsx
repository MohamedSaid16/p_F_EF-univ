import { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import request, { resolveMediaUrl } from '../../../services/api';

// Bounce animation style
const bounceStyle = `
  @keyframes bounceIn {
    0% {
      opacity: 0;
      transform: scale(0.95) translateY(10px);
    }
    50% {
      opacity: 1;
      transform: scale(1.02);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  .bounce-in {
    animation: bounceIn 0.5s ease-out;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = bounceStyle;
  document.head.appendChild(styleSheet);
}

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

/**
 * SVG ICONS - Institutional minimal design per skill.md spec
 */
function IconChevron({ direction = 'left' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${direction === 'right' ? 'rotate-180' : ''}`} aria-hidden="true">
      <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="10" cy="5" r="1.5" fill="currentColor" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <circle cx="10" cy="15" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 2v16h10V7.5L12.5 2H5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12.5 2v5.5H15.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7" y1="13" x2="13" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * URGENT ANNOUNCEMENTS CAROUSEL
 * Full-width carousel where each announcement takes entire width and slides between items
 */
function UrgentAnnouncementsCarousel({ items }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + items.length) % items.length);
  };

  const current = items[currentIndex];

  return (
    <div className="mb-6 rounded-lg border border-edge bg-surface overflow-visible">
      {/* Header */}
      <div className="flex h-12 items-center gap-3 px-4 md:px-6 bg-danger text-white rounded-t-lg">
        <svg className="h-5 w-5 flex-shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-semibold">URGENT ANNOUNCEMENTS</span>
      </div>

      {/* Carousel Content */}
      <div className="relative min-h-32 p-4 md:p-6 px-14 md:px-20">
        {/* Current Announcement */}
        <div className="pr-12 md:pr-16 transition-opacity duration-300 ease-in-out">
          <div className="flex items-start gap-2 mb-2">
            <span className="rounded-full border border-edge-strong bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">URGENT</span>
            <span className="inline-flex h-2 w-2 rounded-full bg-danger animate-pulse flex-shrink-0 mt-1.5" />
          </div>
          <h2 className="text-lg font-bold text-ink mb-1 line-clamp-2">{getTitle(current)}</h2>
          <p className="text-xs text-ink-secondary mb-2">{getCategoryName(current)} • {formatDate(current?.datePublication || current?.createdAt)}</p>
          <p className="text-sm text-ink-secondary mb-3 line-clamp-2">{getContent(current)}</p>
          <a href={`/news#${current.id}`} className="inline-flex items-center text-xs font-semibold text-brand hover:text-brand-hover transition-colors">
            Read more →
          </a>
        </div>

        {/* Navigation - Positioned Outside */}
        <button
          onClick={goToPrev}
          className="absolute top-1/2 -left-6 -translate-y-1/2 rounded-full border border-edge bg-surface p-2 text-ink-secondary hover:bg-surface-100 transition-all duration-200"
          aria-label="Previous announcement"
        >
          <IconChevron direction="left" />
        </button>
        <button
          onClick={goToNext}
          className="absolute top-1/2 -right-6 -translate-y-1/2 rounded-full border border-edge bg-surface p-2 text-ink-secondary hover:bg-surface-100 transition-all duration-200"
          aria-label="Next announcement"
        >
          <IconChevron direction="right" />
        </button>
      </div>

      {/* Indicator Dots */}
      <div className="flex justify-center gap-2 pb-4">
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`h-2 w-2 rounded-full transition-all ${
              idx === currentIndex ? 'bg-brand w-6' : 'bg-edge hover:bg-edge-strong'
            }`}
            aria-label={`Go to announcement ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * SEAMLESS LIST ROW COMPONENT
 * Horizontal hierarchy: [Urgency Accent] → [Category Badge] → [Title & Snippet] → [Attachment] → [Date] → [Menu]
 */
function AnnouncementRow({ item, isAdmin, onEdit, onDelete, openMenuId, setOpenMenuId }) {
  const urgent = isImportantAnnouncement(item);
  const attachment = item?.documents?.[0];
  const attachmentUrl = attachment?.fichier ? resolveMediaUrl(attachment.fichier) : '';
  const dateValue = item?.datePublication || item?.createdAt;
  const displayDate = formatDate(dateValue);
  const authorName = `${item?.auteur?.prenom || ''} ${item?.auteur?.nom || ''}`.trim() || 'Unknown';

  return (
    <div className="group border-b border-edge-subtle bg-surface transition-colors duration-150 hover:bg-surface-200">
      <div className="flex items-stretch">
        {/* Left accent bar (3px) for urgency indicator */}
        <div className={`w-1 flex-shrink-0 transition-all duration-150 ${urgent ? 'bg-danger' : 'bg-brand/40'}`} />

        {/* Main content area */}
        <div className="flex-1 px-4 py-3.5 md:px-6 md:py-4">
          {/* Horizontal row layout */}
          <div className="flex flex-col gap-2">
            {/* Row 1: Header with badges and metadata */}
            <div className="flex items-start justify-between gap-3">
              {/* Left: Category badge + urgent indicator */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="rounded-full border border-edge bg-surface-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                  {getCategoryName(item)}
                </span>
                {urgent ? (
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-danger animate-pulse" title="Urgent" />
                ) : null}
              </div>

              {/* Right: Timestamp + Author + Menu */}
              <div className="flex items-center gap-2 gap-x-3 flex-shrink-0 text-xs text-ink-tertiary">
                <span className="whitespace-nowrap">{displayDate}</span>

                {/* Admin kebab menu */}
                {isAdmin ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-edge/50 bg-surface-200 text-ink-secondary transition-all duration-150 hover:border-edge-strong hover:bg-surface-300 hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
                      aria-label="Actions"
                    >
                      <IconMenu />
                    </button>

                    {/* Dropdown menu */}
                    {openMenuId === item.id ? (
                      <div className="absolute right-0 top-full mt-1 w-32 origin-top-right rounded-md border border-edge bg-surface shadow-card z-20">
                        <button
                          type="button"
                          onClick={() => {
                            onEdit(item);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left block px-3 py-2 text-xs font-medium text-ink-secondary transition-all duration-150 hover:bg-surface-200 hover:text-ink first:rounded-t-md"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(item.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left block px-3 py-2 text-xs font-medium text-danger transition-all duration-150 hover:bg-danger/10 last:rounded-b-md"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Row 2: Title (bold, high scannability) */}
            <h3 className="text-sm font-bold tracking-tight text-ink md:text-base line-clamp-1">
              {getTitle(item)}
            </h3>

            {/* Row 3: Content snippet */}
            <div className="flex items-start gap-2 flex-wrap">
              <p className="text-xs leading-5 text-ink-secondary line-clamp-2 flex-1">
                {getContent(item)}
              </p>
            </div>

            {/* Row 3b: Attachment link (prominent) */}
            {attachmentUrl ? (
              <div>
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand transition-all duration-150 hover:text-brand-hover hover:underline"
                  title={attachment?.nomDocument || 'Download'}
                >
                  <IconFile />
                  <span>View Attachment: {attachment?.nomDocument || 'Download'}</span>
                </a>
              </div>
            ) : null}

            {/* Row 4: Author metadata (muted) */}
            <p className="text-xs text-ink-tertiary">By {authorName}</p>
          </div>
        </div>
      </div>
    </div>
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
  const [openMenuId, setOpenMenuId] = useState(null);
  const filterRef = useRef(null);

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
      setOpenMenuId(null);
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

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-6 lg:px-8 lg:py-8">
      {/* ===== PAGE HEADER (COMPRESSED) ===== */}
      {/* Slim, elegant title bar with right-aligned CTA */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
            News & Announcements
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Stay informed with the latest updates from the university community
          </p>
        </div>

        {/* Right-aligned CTA button */}
        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-hover active:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-2 focus:ring-offset-canvas whitespace-nowrap h-fit"
          >
            + New Announcement
          </button>
        ) : null}
      </div>

      {/* ===== URGENT ANNOUNCEMENTS CAROUSEL ===== */}
      {annonces.filter(isImportantAnnouncement).length > 0 && (
        <UrgentAnnouncementsCarousel items={annonces.filter(isImportantAnnouncement)} />
      )}

      {/* ===== STICKY FILTER BAR ===== */}
      {/* Category navigation fixed at top while scrolling */}
      <div
        ref={filterRef}
        className="sticky top-0 z-40 -mx-4 bg-canvas px-4 py-3 shadow-sm md:-mx-6 md:px-6 lg:-mx-8 lg:px-8"
      >
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
          {categories.map((category) => (
            <button
              key={category.name}
              type="button"
              onClick={() => setActiveCategory(category.value)}
              className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand/30 ${
                activeCategory === category.value
                  ? 'border-brand bg-brand-light text-brand'
                  : 'border-edge bg-surface text-ink-secondary hover:bg-surface-100'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* ===== SEAMLESS LIST CONTAINER ===== */}
      {/* Monolithic container with no gaps between rows */}
      <div className="mt-6 rounded-lg border border-edge overflow-hidden bg-surface shadow-card">
        {loading ? (
          <div className="p-8 text-center md:p-12">
            <p className="text-sm font-medium text-ink-secondary">Loading announcements...</p>
          </div>
        ) : annonces.length === 0 ? (
          <div className="p-12 text-center md:p-16">
            <div className="mx-auto max-w-sm space-y-3">
              {/* Minimalist empty state */}
              <div className="flex justify-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-lg border border-edge-subtle bg-canvas">
                  <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-ink-tertiary">
                    <path d="M9 3h6v2H9V3zm0 16h6v2H9v-2z" fill="currentColor" />
                    <path d="M3 9v6h2V9H3zm16 0v6h2V9h-2z" fill="currentColor" />
                    <rect x="5" y="5" width="14" height="14" rx="1" ry="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-semibold text-ink">No announcements yet</p>
              <p className="text-xs text-ink-tertiary">When news is published, it will appear here. Check back later or try a different category.</p>
            </div>
          </div>
        ) : (
          <div>
            {annonces.map((item) => (
              <AnnouncementRow
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                onEdit={handleEdit}
                onDelete={handleDelete}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
            ))}
          </div>
        )}
      </div>

      {/* ===== CREATION/EDIT MODAL ===== */}
      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-edge bg-surface shadow-card bounce-in">
            {/* Modal header */}
            <div className="border-b border-edge-subtle px-6 py-5 md:px-8 md:py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">Administration</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">
                {editingAnnonce ? 'Edit Announcement' : 'New Announcement'}
              </h2>
            </div>

            {/* Modal form */}
            <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6 md:px-8 md:py-8">
              {/* Title field */}
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

              {/* Content field */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-secondary">Content</label>
                <textarea
                  placeholder="Content"
                  className={`${inputClassName} min-h-[180px] resize-y`}
                  value={formData.contenu}
                  onChange={(event) => setFormData((prev) => ({ ...prev, contenu: event.target.value }))}
                />
              </div>

              {/* File upload (new items only) */}
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

              {/* Category field */}
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

              {/* Priority field */}
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
                <p className="mt-1 text-xs text-ink-tertiary">Important and urgent items are featured prominently.</p>
              </div>

              {/* Form actions */}
              <div className="flex flex-col gap-3 border-t border-edge-subtle pt-5 sm:flex-row sm:justify-end">
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
