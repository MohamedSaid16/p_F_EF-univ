import { useState, useEffect, useCallback } from "react";
import {
  getConseils, createConseil as apiCreateConseil, finaliserConseil as apiFinaliserConseil,
  getDossiers, createDossier,
  getInfractions, getDecisions,
} from "./services/api";
import api from "./services/api";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA  — mirrors the real PostgreSQL schema (Groupe 2 tables)
//
// Tables used:
//   conseils_disciplinaires, membres_conseil,
//   dossiers_disciplinaires, infractions, decisions,
//   etudiants → users + promos → specialites → filieres,
//   enseignants → users + grades
// ─────────────────────────────────────────────────────────────────────────────

// ─── DATA NORMALIZERS ─────────────────────────────────────────────────────────
// Prisma returns camelCase nested objects — reshape to the display shape
// used by all UI components.

// Unwrap { success: true, data: [...] } response
export function unwrap(res) {
  return res?.data?.data ?? res?.data ?? [];
}

function hasRole(user, role) {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

function normalizeDossier(d) {
  if (!d) return null;
  const et = d.etudiant;
  const sp = et?.promo?.specialite;
  const fi = sp?.filiere;
  return {
    ...d,
    // keep snake_case aliases so existing JSX still works
    conseil_id:          d.conseilId    ?? d.conseil_id,
    etudiant_id:         d.etudiantId   ?? d.etudiant_id,
    infraction_id:       d.infractionId ?? d.infraction_id,
    decision_id:         d.decisionId   ?? d.decision_id,
    date_signal:         d.dateSignal   ?? d.date_signal,
    description_signal:  d.descriptionSignal ?? d.description_signal,
    remarque_decision:   d.remarqueDecision  ?? d.remarque_decision,
    date_decision:       d.dateDecision      ?? d.date_decision,
    etudiant: et ? {
      id:           et.id,
      matricule:    et.matricule || "—",
      moyenne:      et.moyenne,
      displayName:  `${et.user?.prenom || ""} ${et.user?.nom || ""}`.trim() || "—",
      displayField: fi?.nom  || "—",
      displayLevel: sp?.niveau || "—",
      promo:        { nom: et.promo?.nom || "—" },
    } : null,
    infraction: d.infraction ? {
      id:          d.infraction.id,
      nom:         d.infraction.nom,
      gravite:     d.infraction.gravite,
      description: d.infraction.description || "",
    } : null,
    decision: d.decision ? {
      id:              d.decision.id,
      nom:             d.decision.nom,
      niveau_sanction: d.decision.niveauSanction ?? d.decision.niveau_sanction,
    } : null,
    signalant: d.enseignantSignalantR ? {
      id:          d.enseignantSignalantR.id,
      displayName: `${d.enseignantSignalantR.user?.prenom || ""} ${d.enseignantSignalantR.user?.nom || ""}`.trim() || "—",
    } : null,
  };
}

function normalizeConseil(c) {
  if (!c) return null;
  return {
    ...c,
    // snake_case aliases
    date_reunion:        c.dateReunion        ?? c.date_reunion,
    annee_universitaire: c.anneeUniversitaire ?? c.annee_universitaire,
    membres: (c.membres || []).map(m => ({
      ...m,
      conseil_id:    m.conseilId    ?? m.conseil_id,
      enseignant_id: m.enseignantId ?? m.enseignant_id,
      enseignant: m.enseignant ? {
        id:           m.enseignant.id,
        displayName:  `${m.enseignant.user?.prenom || ""} ${m.enseignant.user?.nom || ""}`.trim() || "—",
        displayGrade: m.enseignant.grade?.nom || "—",
        bureau:       m.enseignant.bureau || "",
      } : {
        id: m.enseignantId,
        displayName: "—",
        displayGrade: "—",
        bureau: "",
      },
    })),
  };
}

function normalizeEnseignant(e) {
  if (!e) return null;
  return {
    ...e,
    displayName:  `${e.user?.prenom || e.prenom || ""} ${e.user?.nom || e.nom || ""}`.trim() || "—",
    displayGrade: e.grade?.nom || e.grade || "—",
    bureau:       e.bureau || "",
  };
}

// Builds grouped tree from Prisma etudiant rows
function buildStudentTreeFromAPI(etudiants = []) {
  const tree = {};
  etudiants.forEach(et => {
    const sp      = et.promo?.specialite;
    const filiere = sp?.filiere?.nom || "Autre";
    const spec    = sp?.nom || sp?.niveau || "Autre";
    const promo   = et.promo?.nom || "Autre";
    if (!tree[filiere])              tree[filiere] = {};
    if (!tree[filiere][spec])        tree[filiere][spec] = {};
    if (!tree[filiere][spec][promo]) tree[filiere][spec][promo] = [];
    tree[filiere][spec][promo].push({
      ...et,
      displayName: `${et.user?.prenom || et.prenom || ""} ${et.user?.nom || et.nom || ""}`.trim() || "—",
      matricule:   et.matricule || "",
      moyenne:     et.moyenne,
    });
  });
  return tree;
}

function getDossiersForConseil(conseil_id, dossiers = []) {
  return dossiers.filter(d => (d.conseilId ?? d.conseil_id) === conseil_id);
}

function getMembresForConseil(conseil_id, membres = []) {
  return membres.filter(m => (m.conseilId ?? m.conseil_id) === conseil_id);
}

// ─── STATUS CONFIG (mapped to DB enum values) ─────────────────────────────────
const DOSSIER_STATUS_CONFIG = {
  signale:        { label: "Signalé",        color: "#D97706", bg: "#FEF3C7", dot: "#D97706" },
  en_instruction: { label: "En instruction", color: "#DC2626", bg: "#FEE2E2", dot: "#DC2626" },
  jugement:       { label: "En jugement",    color: "#7C3AED", bg: "#EDE9FE", dot: "#7C3AED" },
  traite:         { label: "Traité",         color: "#059669", bg: "#ECFDF5", dot: "#059669" },
};
const CONSEIL_STATUS_CONFIG = {
  planifie: { label: "Planifié",  color: "#2563EB", bg: "#EFF6FF" },
  en_cours: { label: "En cours",  color: "#D97706", bg: "#FEF3C7" },
  termine:  { label: "Terminé",   color: "#059669", bg: "#ECFDF5" },
};
const GRAVITE_CONFIG = {
  faible:     { label: "Faible",     color: "#059669", bg: "#ECFDF5" },
  moyenne:    { label: "Moyenne",    color: "#D97706", bg: "#FEF3C7" },
  grave:      { label: "Grave",      color: "#DC2626", bg: "#FEE2E2" },
  tres_grave: { label: "Très grave", color: "#111827", bg: "#F3F4F6" },
};
const SANCTION_CONFIG = {
  avertissement: { label: "Avertissement", color: "#D97706" },
  blame:         { label: "Blâme",         color: "#DC2626" },
  suspension:    { label: "Suspension",    color: "#7C3AED" },
  exclusion:     { label: "Exclusion",     color: "#111827" },
};

// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────
function DossierBadge({ status }) {
  const cfg = DOSSIER_STATUS_CONFIG[status] || {};
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5,
      padding:"3px 10px", borderRadius:20, background:cfg.bg, color:cfg.color,
      fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:cfg.dot, flexShrink:0 }} />
      {cfg.label}
    </span>
  );
}
function ConseilBadge({ status }) {
  const cfg = CONSEIL_STATUS_CONFIG[status] || {};
  return <span style={{ padding:"3px 10px", borderRadius:20, background:cfg.bg,
    color:cfg.color, fontSize:11, fontWeight:700 }}>{cfg.label}</span>;
}
function GraviteBadge({ gravite }) {
  const cfg = GRAVITE_CONFIG[gravite] || {};
  return <span style={{ padding:"2px 9px", borderRadius:12, background:cfg.bg,
    color:cfg.color, fontSize:11, fontWeight:700 }}>{cfg.label}</span>;
}
function Avatar({ name, size = 32 }) {
  const initials = (name||"?").split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
  const colors = ["#1D4ED8","#7C3AED","#BE123C","#0F766E","#B45309","#1E40AF"];
  const color  = colors[(name||"").charCodeAt(0) % colors.length];
  return <div style={{ width:size, height:size, borderRadius:"50%", background:color,
    color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:size*0.35, fontWeight:700, flexShrink:0 }}>{initials}</div>;
}
function Card({ children, style={} }) {
  return <div style={{ background:"#fff", borderRadius:12, border:"1px solid #E2E8F0",
    boxShadow:"0 1px 4px rgba(0,0,0,.05)", ...style }}>{children}</div>;
}
function Button({ children, variant="primary", onClick, style={}, disabled=false }) {
  const styles = {
    primary:   { background:"#1D4ED8", color:"#fff",    border:"none" },
    secondary: { background:"#F1F5F9", color:"#334155", border:"1px solid #E2E8F0" },
    ghost:     { background:"transparent", color:"#64748B", border:"1px solid #E2E8F0" },
    danger:    { background:"#DC2626", color:"#fff",    border:"none" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ padding:"8px 16px",
    borderRadius:8, fontSize:13, fontWeight:600, cursor:disabled?"not-allowed":"pointer",
    display:"inline-flex", alignItems:"center", gap:6, transition:"all .15s",
    opacity:disabled?.5:1, ...styles[variant], ...style }}>{children}</button>;
}
function Input({ placeholder, value, onChange, style={} }) {
  return <input placeholder={placeholder} value={value} onChange={onChange}
    style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #E2E8F0",
      fontSize:13, outline:"none", background:"#F8FAFC", width:"100%", ...style }} />;
}
function Select({ value, onChange, options, style={} }) {
  return <select value={value} onChange={e=>onChange(e.target.value)}
    style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #E2E8F0",
      fontSize:13, background:"#F8FAFC", cursor:"pointer", ...style }}>
    {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
  </select>;
}
function SLabel({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8",
    textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>{children}</div>;
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard",   icon:"⊞", label:"Tableau de bord" },
  { id:"dossiers",    icon:"📋", label:"Dossiers" },
  { id:"conseils",    icon:"⚖",  label:"Conseils" },
  { id:"infractions", icon:"⚠",  label:"Infractions" },
  { id:"archives",    icon:"🗃",  label:"Archives" },
];
function Sidebar({ active, onNav, user }) {
  const displayName = user ? `${user.prenom || ""} ${user.nom || ""}`.trim() || user.email : "Utilisateur";
  const role = user?.roles?.[0] || "enseignant";
  return (
    <aside style={{ width:224, flexShrink:0, background:"#0F172A", display:"flex",
      flexDirection:"column", minHeight:"100vh", position:"sticky", top:0 }}>
      <div style={{ padding:"24px 20px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10,
            background:"linear-gradient(135deg,#3B82F6,#1D4ED8)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>⚖</div>
          <div>
            <div style={{ color:"#F8FAFC", fontSize:13, fontWeight:700, lineHeight:1.2 }}>Conseil</div>
            <div style={{ color:"#64748B", fontSize:10 }}>Disciplinaire</div>
          </div>
        </div>
      </div>
      <div style={{ height:1, background:"#1E293B", margin:"0 16px 16px" }} />
      <nav style={{ flex:1, padding:"0 10px" }}>
        {NAV.map(item=>(
          <button key={item.id} onClick={()=>onNav(item.id)} style={{ width:"100%",
            display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
            borderRadius:8, border:"none", background: active===item.id?"#1D4ED8":"transparent",
            color: active===item.id?"#fff":"#94A3B8", fontSize:13,
            fontWeight: active===item.id?600:500, cursor:"pointer",
            marginBottom:2, textAlign:"left", transition:"all .15s" }}>
            <span style={{ fontSize:15 }}>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding:"16px 20px", borderTop:"1px solid #1E293B" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Avatar name={displayName} size={32} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:"#F1F5F9", fontSize:12, fontWeight:600,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{displayName}</div>
            <div style={{ color:"#475569", fontSize:10, textTransform:"capitalize" }}>{role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── SHARED CONSEIL HELPERS (used by InlineConseilForm + ConseilsList) ────────
// PRESIDENT and enseignants/dossiers are passed as props from App shell (loaded from API)
let PRESIDENT = { id: null, displayName: "Chargement…", displayGrade: "", bureau: "" };

function buildStudentTree(etudiants = []) {
  return buildStudentTreeFromAPI(etudiants);
}

// ─── INLINE CONSEIL FORM  (shared by Dashboard quick-action) ─────────────────
function InlineConseilForm({ onSaved, onCancel, president, enseignants, etudiants }) {
  const MAX_MEMBERS = 3;
  const [form, setForm] = useState({
    date_reunion:"", heure:"", lieu:"", annee_universitaire:"2024-2025", description:"",
  });
  const [selectedMembers,  setSelectedMembers]  = useState([]);
  const [memberSearch,     setMemberSearch]      = useState("");
  const [selectedEtudiant, setSelectedEtudiant] = useState(null);
  const [etudiantSearch,   setEtudiantSearch]   = useState("");
  const [expandedFiliere,  setExpandedFiliere]  = useState("__all__");
  const [expandedSpec,     setExpandedSpec]     = useState("__all__");
  const [error,            setError]            = useState("");

  const pres        = president || PRESIDENT;
  const studentTree = buildStudentTree(etudiants || []);

  const allTeachers = (enseignants || [])
    .filter(e => e.id !== pres.id);

  const visibleTeachers = allTeachers.filter(e => {
    const q = memberSearch.toLowerCase();
    return e.displayName.toLowerCase().includes(q) ||
           (e.displayGrade||"").toLowerCase().includes(q) ||
           (e.bureau||"").toLowerCase().includes(q);
  });

  const addMember = (ens) => {
    if (selectedMembers.length >= MAX_MEMBERS) { setError("Maximum 3 membres additionnels autorisés."); return; }
    if (selectedMembers.find(m => m.enseignant_id === ens.id)) return;
    setSelectedMembers(prev => [...prev, { enseignant_id: ens.id, role: "membre", _ens: ens }]);
    setError("");
  };
  const removeMember = id => setSelectedMembers(prev => prev.filter(m => m.enseignant_id !== id));
  const updateRole = (id, role) => setSelectedMembers(prev => prev.map(m => m.enseignant_id === id ? {...m, role} : m));

  // Filtered student tree
  const q = etudiantSearch.toLowerCase();
  const filteredTree = {};
  Object.entries(studentTree).forEach(([fil, specs]) => {
    Object.entries(specs).forEach(([spec, promos]) => {
      Object.entries(promos).forEach(([promo, ets]) => {
        const matching = ets.filter(e => !q ||
          e.displayName.toLowerCase().includes(q) ||
          e.matricule.includes(q) ||
          promo.toLowerCase().includes(q) ||
          spec.toLowerCase().includes(q)
        );
        if (matching.length) {
          if (!filteredTree[fil])        filteredTree[fil] = {};
          if (!filteredTree[fil][spec])  filteredTree[fil][spec] = {};
          filteredTree[fil][spec][promo] = matching;
        }
      });
    });
  });

  const handleSave = async () => {
    if (!form.date_reunion || !form.heure || !form.lieu) {
      setError("Veuillez remplir la date, l'heure et le lieu.");
      return;
    }
    try {
      const res = await apiCreateConseil({
        ...form,
        president_id: pres.id,
        membres: selectedMembers.map(m => ({ enseignant_id: m.enseignant_id, role: m.role })),
      });
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'enregistrement.");
    }
  };

  return (
    <Card style={{ padding:24, marginBottom:24, border:"2px solid #3B82F6" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div style={{ fontSize:15, fontWeight:700, color:"#0F172A" }}>⚖ Planifier un nouveau conseil</div>
        <button onClick={onCancel} style={{ border:"none", background:"#F1F5F9", borderRadius:6,
          padding:"4px 10px", cursor:"pointer", fontSize:12, color:"#64748B" }}>✕ Annuler</button>
      </div>

      {/* Meeting fields */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:18 }}>
        <div><SLabel>Date de réunion *</SLabel>
          <input type="date" value={form.date_reunion} onChange={e=>setForm(f=>({...f,date_reunion:e.target.value}))}
            style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #E2E8F0", fontSize:13, background:"#F8FAFC", width:"100%" }} />
        </div>
        <div><SLabel>Heure *</SLabel>
          <input type="time" value={form.heure} onChange={e=>setForm(f=>({...f,heure:e.target.value}))}
            style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #E2E8F0", fontSize:13, background:"#F8FAFC", width:"100%" }} />
        </div>
        <div><SLabel>Année universitaire</SLabel>
          <Input value={form.annee_universitaire} onChange={e=>setForm(f=>({...f,annee_universitaire:e.target.value}))} />
        </div>
        <div style={{ gridColumn:"1/-1" }}><SLabel>Lieu *</SLabel>
          <Input placeholder="Ex : Salle C12, lien visio…" value={form.lieu} onChange={e=>setForm(f=>({...f,lieu:e.target.value}))} />
        </div>
        <div style={{ gridColumn:"1/-1" }}><SLabel>Description / Ordre du jour</SLabel>
          <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
            rows={2} placeholder="Points à traiter durant la session…"
            style={{ width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid #E2E8F0",
              fontSize:13, background:"#F8FAFC", resize:"vertical", fontFamily:"inherit" }} />
        </div>
      </div>

      {/* ── Student picker ────────────────────────────────────── */}
      <div style={{ border:"1px solid #E2E8F0", borderRadius:12, overflow:"hidden", marginBottom:16 }}>
        <div style={{ background:"#F8FAFC", padding:"12px 16px", borderBottom:"1px solid #E2E8F0",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>Étudiant concerné</div>
            <div style={{ fontSize:11, color:"#94A3B8", marginTop:1 }}>Groupés par filière → spécialité → promo</div>
          </div>
          {selectedEtudiant && (
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"#EFF6FF",
              border:"1px solid #BFDBFE", borderRadius:20, padding:"4px 12px" }}>
              <Avatar name={selectedEtudiant.displayName} size={20} />
              <span style={{ fontSize:12, fontWeight:600, color:"#1E40AF" }}>{selectedEtudiant.displayName}</span>
              <button onClick={()=>setSelectedEtudiant(null)}
                style={{ border:"none", background:"none", color:"#64748B", cursor:"pointer", fontSize:14, padding:0 }}>×</button>
            </div>
          )}
        </div>
        <div style={{ padding:14 }}>
          <Input placeholder="🔍  Rechercher étudiant, matricule, promo…" value={etudiantSearch}
            onChange={e=>{ setEtudiantSearch(e.target.value); setExpandedFiliere(null); setExpandedSpec(null); }}
            style={{ marginBottom:10 }} />
          <div style={{ maxHeight:240, overflowY:"auto" }}>
            {Object.entries(filteredTree).map(([filiere, specs]) => (
              <div key={filiere} style={{ marginBottom:4 }}>
                <div onClick={()=>{ setExpandedFiliere(expandedFiliere===filiere?null:filiere); setExpandedSpec("__all__"); }}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px",
                    background:"#F1F5F9", borderRadius:8, cursor:"pointer",
                    fontWeight:700, fontSize:12, color:"#334155", userSelect:"none" }}>
                  <span style={{ fontSize:10, color:"#94A3B8" }}>{expandedFiliere===filiere||expandedFiliere==="__all__"?"▼":"▶"}</span>
                  📚 {filiere}
                  <span style={{ marginLeft:"auto", background:"#E2E8F0", borderRadius:12,
                    padding:"1px 8px", fontSize:10, fontWeight:600, color:"#64748B" }}>
                    {Object.values(specs).flatMap(p=>Object.values(p)).flat().length} étudiant(s)
                  </span>
                </div>
                {(expandedFiliere===filiere || expandedFiliere==="__all__" || etudiantSearch.trim()) && (
                  <div style={{ paddingLeft:14, marginTop:4 }}>
                    {Object.entries(specs).map(([spec, promos]) => (
                      <div key={spec} style={{ marginBottom:4 }}>
                        <div onClick={()=>setExpandedSpec(expandedSpec===spec?null:spec)}
                          style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px",
                            background:"#F8FAFC", borderRadius:6, cursor:"pointer",
                            fontWeight:600, fontSize:11, color:"#475569", userSelect:"none" }}>
                          <span style={{ fontSize:9, color:"#94A3B8" }}>{expandedSpec===spec||expandedSpec==="__all__"?"▼":"▶"}</span>
                          🎓 {spec}
                        </div>
                        {(expandedSpec===spec || expandedSpec==="__all__" || etudiantSearch.trim()) && (
                          <div style={{ paddingLeft:14, marginTop:4 }}>
                            {Object.entries(promos).map(([promo, ets]) => (
                              <div key={promo} style={{ marginBottom:8 }}>
                                <div style={{ fontSize:10, fontWeight:700, color:"#94A3B8",
                                  textTransform:"uppercase", letterSpacing:".06em", padding:"4px 8px" }}>
                                  {promo}
                                </div>
                                {ets.map(et => {
                                  const isSel = selectedEtudiant?.id === et.id;
                                  return (
                                    <div key={et.id} onClick={()=>setSelectedEtudiant(isSel?null:et)}
                                      style={{ display:"flex", alignItems:"center", gap:10,
                                        padding:"8px 10px", borderRadius:8, cursor:"pointer",
                                        background: isSel?"#EFF6FF":"#fff",
                                        border:`1px solid ${isSel?"#BFDBFE":"#F1F5F9"}`,
                                        marginBottom:4 }}>
                                      <Avatar name={et.displayName} size={26} />
                                      <div style={{ flex:1 }}>
                                        <div style={{ fontSize:12, fontWeight:600, color:"#0F172A" }}>{et.displayName}</div>
                                        <div style={{ fontSize:10, color:"#94A3B8" }}>{et.matricule} · moy. {et.moyenne}</div>
                                      </div>
                                      <span style={{ fontSize:11, fontWeight:700, color: isSel?"#1D4ED8":"#94A3B8" }}>
                                        {isSel?"✓ Sélectionné":"Sélectionner"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {Object.keys(filteredTree).length===0 && (
              <div style={{ textAlign:"center", padding:20, color:"#94A3B8", fontSize:13 }}>Aucun étudiant trouvé</div>
            )}
          </div>
        </div>
      </div>

      {/* Council composition */}
      <div style={{ border:"1px solid #E2E8F0", borderRadius:12, overflow:"hidden", marginBottom:16 }}>
        <div style={{ background:"#F8FAFC", padding:"12px 16px", borderBottom:"1px solid #E2E8F0",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>Composition du conseil</div>
            <div style={{ fontSize:11, color:"#94A3B8", marginTop:1 }}>Président fixe + jusqu'à <strong>3 membres</strong> additionnels</div>
          </div>
          <div style={{ background: selectedMembers.length>=MAX_MEMBERS?"#FEE2E2":"#EFF6FF",
            color: selectedMembers.length>=MAX_MEMBERS?"#DC2626":"#1D4ED8",
            borderRadius:20, padding:"3px 12px", fontSize:12, fontWeight:700 }}>
            {selectedMembers.length} / {MAX_MEMBERS} membres
          </div>
        </div>
        <div style={{ padding:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, background:"#F0FDF4",
            border:"1px solid #BBF7D0", borderRadius:10, padding:"10px 14px", marginBottom:14 }}>
            <Avatar name={pres.displayName} size={34} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>{pres.displayName}</div>
              <div style={{ fontSize:11, color:"#64748B" }}>{pres.displayGrade} · Bureau {pres.bureau}</div>
            </div>
            <span style={{ background:"#DCFCE7", color:"#166534", borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700 }}>Président</span>
          </div>
          {selectedMembers.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
              {selectedMembers.map(m => (
                <div key={m.enseignant_id} style={{ display:"flex", alignItems:"center", gap:10,
                  background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:10, padding:"8px 12px" }}>
                  <Avatar name={m._ens.displayName} size={28} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"#0F172A" }}>{m._ens.displayName}</div>
                    <div style={{ fontSize:11, color:"#94A3B8" }}>{m._ens.displayGrade}</div>
                  </div>
                  <select value={m.role} onChange={e=>updateRole(m.enseignant_id, e.target.value)}
                    style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #E2E8F0", fontSize:12, background:"#fff", cursor:"pointer" }}>
                    <option value="membre">Membre</option>
                    <option value="rapporteur">Rapporteur</option>
                  </select>
                  <button onClick={()=>removeMember(m.enseignant_id)}
                    style={{ border:"none", background:"#FEE2E2", color:"#DC2626", borderRadius:6,
                      width:26, height:26, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                </div>
              ))}
            </div>
          )}
          {selectedMembers.length < MAX_MEMBERS ? (
            <div>
              <SLabel>Enseignants disponibles ({MAX_MEMBERS - selectedMembers.length} place(s))</SLabel>
              <Input placeholder="🔍  Filtrer par nom, grade ou bureau…" value={memberSearch}
                onChange={e=>setMemberSearch(e.target.value)} style={{ marginBottom:10 }} />
              <div style={{ border:"1px solid #E2E8F0", borderRadius:8, overflow:"hidden", maxHeight:200, overflowY:"auto" }}>
                {visibleTeachers.filter(e=>!selectedMembers.find(m=>m.enseignant_id===e.id)).map((e,i)=>(
                  <div key={e.id} onClick={()=>addMember(e)}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", cursor:"pointer",
                      borderTop: i>0?"1px solid #F1F5F9":"none", background:"#fff" }}
                    onMouseEnter={el=>el.currentTarget.style.background="#EFF6FF"}
                    onMouseLeave={el=>el.currentTarget.style.background="#fff"}>
                    <Avatar name={e.displayName} size={30} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{e.displayName}</div>
                      <div style={{ fontSize:11, color:"#94A3B8" }}>{e.displayGrade} · Bureau {e.bureau}</div>
                    </div>
                    <span style={{ fontSize:11, color:"#1D4ED8", fontWeight:700, background:"#EFF6FF", borderRadius:6, padding:"3px 8px" }}>+ Ajouter</span>
                  </div>
                ))}
                {visibleTeachers.filter(e=>!selectedMembers.find(m=>m.enseignant_id===e.id)).length===0 && (
                  <div style={{ padding:"14px 16px", color:"#94A3B8", fontSize:13, textAlign:"center" }}>Aucun enseignant disponible</div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background:"#FEF9C3", border:"1px solid #FDE047", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#854D0E" }}>
              ⚠ Limite atteinte — 3 membres additionnels maximum.
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background:"#FEE2E2", border:"1px solid #FECACA", borderRadius:8,
          padding:"10px 14px", marginBottom:14, fontSize:12, color:"#DC2626" }}>⚠ {error}</div>
      )}
      <Button onClick={handleSave} style={{ width:"100%", justifyContent:"center", padding:"10px" }}>
        💾 Enregistrer le conseil
      </Button>
    </Card>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ dossiers, conseils, enseignants, etudiants, president, onNav, onViewConseil, onConseilCreated, canCreateConseil }) {
  const [showConseilForm, setShowConseilForm] = useState(false);
  const [savedBanner,     setSavedBanner]     = useState(false);

  const stats = [
    { label:"Dossiers signalés",  value:dossiers.filter(d=>d.status==="signale").length,       color:"#D97706", icon:"⚠" },
    { label:"En instruction",     value:dossiers.filter(d=>d.status==="en_instruction").length, color:"#DC2626", icon:"🔍" },
    { label:"Conseils planifiés", value:conseils.filter(c=>c.status==="planifie").length,       color:"#2563EB", icon:"📅" },
    { label:"Dossiers traités",   value:dossiers.filter(d=>d.status==="traite").length,         color:"#059669", icon:"✓" },
  ];
  const recent = [...dossiers].sort((a,b)=>new Date(b.date_signal)-new Date(a.date_signal)).slice(0,5);

  const handleSaved = () => {
    setShowConseilForm(false);
    setSavedBanner(true);
    setTimeout(()=>setSavedBanner(false), 4000);
    onConseilCreated?.();
  };

  return (
    <div>
      <div style={{ marginBottom:28, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"#0F172A", marginBottom:4 }}>Tableau de bord</h1>
          <p style={{ color:"#64748B", fontSize:14 }}>Module Conseil Disciplinaire — vue d'ensemble</p>
        </div>
        {canCreateConseil ? (
          !showConseilForm && (
            <Button onClick={()=>setShowConseilForm(true)}>＋ Nouveau conseil</Button>
          )
        ) : (
          <div style={{ color:"#64748B", fontSize:12, alignSelf:"center" }}>
            Seuls les administrateurs et présidents peuvent planifier un conseil.
          </div>
        )}
      </div>

      {savedBanner && (
        <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10,
          padding:"12px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18 }}>✅</span>
          <span style={{ fontSize:13, color:"#065F46", fontWeight:600 }}>Conseil planifié avec succès !</span>
        </div>
      )}

      {showConseilForm && (
        <InlineConseilForm
          onSaved={handleSaved}
          onCancel={()=>setShowConseilForm(false)}
          president={president}
          enseignants={enseignants}
          etudiants={etudiants}
        />
      )}

      {/* KPI cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
        {stats.map((s,i)=>(
          <Card key={i} style={{ padding:"20px 24px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600,
                  textTransform:"uppercase", letterSpacing:".05em", marginBottom:6 }}>{s.label}</div>
                <div style={{ fontSize:32, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
              </div>
              <div style={{ width:40, height:40, borderRadius:10, background:s.color+"18",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{s.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:20 }}>
        <Card style={{ padding:20 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#0F172A", marginBottom:14 }}>Actions rapides</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {canCreateConseil ? (
              <Button onClick={()=>setShowConseilForm(true)} style={{ justifyContent:"center" }}>＋ Nouveau conseil</Button>
            ) : (
              <div style={{ padding:"12px 0", color:"#64748B", fontSize:12, textAlign:"center" }}>
                Seuls les administrateurs et présidents peuvent planifier un conseil.
              </div>
            )}
            <Button variant="secondary" onClick={()=>onNav("dossiers")} style={{ justifyContent:"center" }}>📋 Dossiers disciplinaires</Button>
            <Button variant="secondary" onClick={()=>onNav("archives")} style={{ justifyContent:"center" }}>🗃 Archives</Button>
          </div>
        </Card>
        <Card>
          <div style={{ padding:"16px 20px", borderBottom:"1px solid #F1F5F9",
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>Dossiers récents</div>
            <Button variant="ghost" onClick={()=>onNav("dossiers")} style={{ fontSize:12, padding:"4px 10px" }}>Voir tout →</Button>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["Étudiant","Infraction","Date signal","Statut"].map(h=>(
                  <th key={h} style={{ padding:"10px 16px", textAlign:"left", color:"#94A3B8",
                    fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:".05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map(d=>(
                <tr key={d.id} style={{ borderTop:"1px solid #F1F5F9", cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"11px 16px", fontWeight:600 }}>{d.etudiant?.displayName}</td>
                  <td style={{ padding:"11px 16px", color:"#64748B", fontSize:12 }}>{d.infraction?.nom}</td>
                  <td style={{ padding:"11px 16px", color:"#94A3B8", fontSize:12 }}>{new Date(d.date_signal).toLocaleDateString("fr-FR")}</td>
                  <td style={{ padding:"11px 16px" }}><DossierBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─── DOSSIER DETAIL PANEL ─────────────────────────────────────────────────────
function DossierDetail({ dossier, onClose, membres: allMembres, conseils: allConseils }) {
  const conseil = dossier.conseil_id
    ? (allConseils || []).find(c => c.id === dossier.conseil_id)
    : null;
  const membres = dossier.conseil_id
    ? (allMembres || []).filter(m => m.conseil_id === dossier.conseil_id)
    : [];
  const decObj = dossier.decision || null;

  const Row = ({ label, value, children }) => (
    <div style={{ display:"flex", gap:8, padding:"10px 0", borderBottom:"1px solid #F1F5F9", alignItems:"flex-start" }}>
      <div style={{ width:160, flexShrink:0, fontSize:11, fontWeight:700, color:"#94A3B8",
        textTransform:"uppercase", letterSpacing:".04em", paddingTop:2 }}>{label}</div>
      <div style={{ flex:1, fontSize:13, color:"#0F172A" }}>{children || value || "—"}</div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", justifyContent:"flex-end" }}>
      {/* backdrop */}
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(15,23,42,.35)" }} />

      {/* slide-in panel */}
      <div style={{ position:"relative", width:520, maxWidth:"92vw", background:"#fff",
        height:"100%", overflowY:"auto", boxShadow:"-8px 0 32px rgba(0,0,0,.12)",
        display:"flex", flexDirection:"column" }}>

        {/* Panel header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #E2E8F0",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          position:"sticky", top:0, background:"#fff", zIndex:10 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:"#0F172A" }}>
              Dossier #{dossier.id}
            </div>
            <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>dossiers_disciplinaires</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <DossierBadge status={dossier.status} />
            <button onClick={onClose} style={{ border:"none", background:"#F1F5F9",
              borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:16,
              display:"flex", alignItems:"center", justifyContent:"center", color:"#64748B" }}>✕</button>
          </div>
        </div>

        <div style={{ padding:"20px 24px", flex:1 }}>

          {/* Student block */}
          <div style={{ display:"flex", alignItems:"center", gap:14, padding:"16px",
            background:"#F8FAFC", borderRadius:12, marginBottom:20 }}>
            <Avatar name={dossier.etudiant?.displayName} size={48} />
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:"#0F172A", marginBottom:2 }}>
                {dossier.etudiant?.displayName}
              </div>
              <div style={{ fontSize:12, color:"#64748B" }}>
                Matricule : <strong>{dossier.etudiant?.matricule}</strong>
              </div>
              <div style={{ fontSize:12, color:"#64748B" }}>
                {dossier.etudiant?.displayField} · {dossier.etudiant?.displayLevel} · {dossier.etudiant?.promo?.nom}
              </div>
              <div style={{ fontSize:12, color:"#64748B" }}>
                Moyenne : <strong>{dossier.etudiant?.moyenne ?? "—"}</strong>
              </div>
            </div>
          </div>

          {/* Infraction block */}
          <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A",
            borderRadius:10, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#92400E" }}>
                {dossier.infraction?.nom}
              </div>
              <GraviteBadge gravite={dossier.infraction?.gravite} />
            </div>
            <div style={{ fontSize:12, color:"#B45309", marginBottom:4 }}>{dossier.infraction?.description}</div>
            <div style={{ fontSize:12, color:"#78350F" }}>
              Signalé par <strong>{dossier.signalant?.displayName || "—"}</strong> le {new Date(dossier.date_signal).toLocaleDateString("fr-FR")}
            </div>
            {dossier.description_signal && (
              <div style={{ marginTop:8, fontSize:12, color:"#92400E", fontStyle:"italic",
                borderTop:"1px solid #FDE68A", paddingTop:8 }}>
                "{dossier.description_signal}"
              </div>
            )}
          </div>

          {/* All fields */}
          <div>
            <Row label="Statut"><DossierBadge status={dossier.status} /></Row>
            <Row label="Date signal" value={new Date(dossier.date_signal).toLocaleDateString("fr-FR", {year:"numeric",month:"long",day:"numeric"})} />
            <Row label="Infraction" value={dossier.infraction?.nom} />
            <Row label="Gravité"><GraviteBadge gravite={dossier.infraction?.gravite} /></Row>
            <Row label="Signalé par" value={dossier.signalant?.displayName} />

            {/* Decision */}
            <Row label="Décision">
              {decObj
                ? <span style={{ fontWeight:600 }}>{decObj.nom}
                    <span style={{ marginLeft:8, fontSize:11, color:"#64748B" }}>
                      ({SANCTION_CONFIG[decObj.niveau_sanction]?.label})
                    </span>
                  </span>
                : <span style={{ color:"#94A3B8", fontStyle:"italic" }}>En attente</span>
              }
            </Row>

            {dossier.remarque_decision && (
              <Row label="Remarque" value={dossier.remarque_decision} />
            )}
            {dossier.date_decision && (
              <Row label="Date décision" value={new Date(dossier.date_decision).toLocaleDateString("fr-FR")} />
            )}
          </div>

          {/* Linked conseil block */}
          {conseil ? (
            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#94A3B8",
                textTransform:"uppercase", letterSpacing:".06em", marginBottom:10 }}>
                Conseil associé
              </div>
              <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE",
                borderRadius:10, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ fontWeight:700, color:"#1E40AF", fontSize:14 }}>
                    Conseil #{conseil.id}
                  </div>
                  <ConseilBadge status={conseil.status} />
                </div>
                <div style={{ fontSize:12, color:"#3B82F6" }}>
                  {new Date(conseil.date_reunion).toLocaleDateString("fr-FR",
                    {weekday:"long",year:"numeric",month:"long",day:"numeric"})}
                  {" · "}{conseil.heure} · {conseil.lieu}
                </div>
                {membres.length > 0 && (
                  <div style={{ marginTop:10, display:"flex", gap:4, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:"#94A3B8", marginRight:4 }}>Membres :</span>
                    {membres.map(m=><Avatar key={m.id} name={m.enseignant.displayName} size={22} />)}
                  </div>
                )}
                <div style={{ marginTop:10, fontSize:12, color:"#1D4ED8" }}>
                  ⚠ L'étudiant est choisi pour ce conseil et recevra une alerte.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop:20, background:"#F8FAFC", border:"1px solid #E2E8F0",
              borderRadius:10, padding:"12px 16px", fontSize:12, color:"#94A3B8", textAlign:"center" }}>
              Ce dossier n'est pas encore assigné à un conseil.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DossierCreate({ onCreated, etudiants, infractions }) {
  const [selectedEtudiant, setSelectedEtudiant] = useState(null);
  const [etudiantSearch, setEtudiantSearch] = useState("");
  const [expandedFiliere, setExpandedFiliere] = useState("__all__");
  const [expandedSpec, setExpandedSpec] = useState("__all__");
  const [descriptionSignal, setDescriptionSignal] = useState("");
  const [dateSignal, setDateSignal] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const studentTree = buildStudentTree(etudiants || []);
  const defaultInfractionId = infractions?.[0]?.id;

  const filteredTree = {};
  const q = etudiantSearch.toLowerCase();
  Object.entries(studentTree).forEach(([fil, specs]) => {
    Object.entries(specs).forEach(([spec, promos]) => {
      Object.entries(promos).forEach(([promo, ets]) => {
        const matching = ets.filter(e =>
          !q ||
          e.displayName.toLowerCase().includes(q) ||
          e.matricule.includes(q) ||
          promo.toLowerCase().includes(q) ||
          spec.toLowerCase().includes(q)
        );
        if (matching.length) {
          if (!filteredTree[fil]) filteredTree[fil] = {};
          if (!filteredTree[fil][spec]) filteredTree[fil][spec] = {};
          filteredTree[fil][spec][promo] = matching;
        }
      });
    });
  });

  const handleSave = async () => {
    if (!selectedEtudiant || !descriptionSignal) {
      setError("Veuillez sélectionner un étudiant et décrire le signalement.");
      return;
    }
    if (!defaultInfractionId) {
      setError("Aucune infraction de base disponible pour l'enregistrement.");
      return;
    }

    try {
      await createDossier({
        etudiantId: Number(selectedEtudiant.id),
        infractionId: Number(defaultInfractionId),
        descriptionSignal,
        dateSignal,
      });
      setSaved(true);
      setError("");
      setSelectedEtudiant(null);
      setDescriptionSignal("");
      setDateSignal(new Date().toISOString().slice(0, 10));
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Erreur lors de la création du signalement.");
    }
  };

  return (
    <Card style={{ padding:24, marginBottom:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:"#0F172A" }}>Signaler un étudiant</div>
          <div style={{ fontSize:12, color:"#64748B", marginTop:4 }}>
            Sélectionnez un étudiant par niveau, filière, spécialité et promo, puis décrivez la raison du signalement.
          </div>
        </div>
        <span style={{ color:"#64748B", fontSize:12 }}>{saved ? "Signalement enregistré" : ""}</span>
      </div>

      <div style={{ border:"1px solid #E2E8F0", borderRadius:12, overflow:"hidden", marginBottom:18 }}>
        <div style={{ background:"#F8FAFC", padding:"12px 16px", borderBottom:"1px solid #E2E8F0",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>Étudiant concerné *</div>
            <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>Groupés par filière → spécialité → promo</div>
          </div>
          {selectedEtudiant && (
            <div style={{ display:"flex", alignItems:"center", gap:8,
              background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:20, padding:"4px 12px" }}>
              <Avatar name={selectedEtudiant.displayName} size={20} />
              <span style={{ fontSize:12, fontWeight:600, color:"#1E40AF" }}>{selectedEtudiant.displayName}</span>
              <button onClick={()=>setSelectedEtudiant(null)}
                style={{ border:"none", background:"none", color:"#64748B", cursor:"pointer", fontSize:14, padding:0, lineHeight:1 }}>×</button>
            </div>
          )}
        </div>
        <div style={{ padding:14 }}>
          <Input placeholder="🔍  Rechercher étudiant, matricule, promo…" value={etudiantSearch}
            onChange={e => { setEtudiantSearch(e.target.value); setExpandedFiliere(null); setExpandedSpec(null); }}
            style={{ marginBottom:10 }} />
          <div style={{ maxHeight:260, overflowY:"auto" }}>
            {Object.entries(filteredTree).map(([filiere, specs]) => (
              <div key={filiere} style={{ marginBottom:4 }}>
                <div onClick={()=>{ setExpandedFiliere(expandedFiliere===filiere?null:filiere); setExpandedSpec("__all__"); }}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:"#F1F5F9",
                    borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:12, color:"#334155", userSelect:"none" }}>
                  <span style={{ fontSize:10, color:"#94A3B8" }}>
                    {expandedFiliere===filiere||expandedFiliere==="__all__" ? "▼" : "▶"}
                  </span>
                  📚 {filiere}
                  <span style={{ marginLeft:"auto", background:"#E2E8F0", borderRadius:12, padding:"1px 8px",
                    fontSize:10, fontWeight:600, color:"#64748B" }}>
                    {Object.values(specs).flatMap(p=>Object.values(p)).flat().length} étudiant(s)
                  </span>
                </div>
                {(expandedFiliere===filiere || expandedFiliere==="__all__" || etudiantSearch.trim()) && (
                  <div style={{ paddingLeft:14, marginTop:4 }}>
                    {Object.entries(specs).map(([spec, promos]) => (
                      <div key={spec} style={{ marginBottom:4 }}>
                        <div onClick={()=>setExpandedSpec(expandedSpec===spec?null:spec)}
                          style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px",
                            background:"#F8FAFC", borderRadius:6, cursor:"pointer", fontWeight:600,
                            fontSize:11, color:"#475569", userSelect:"none" }}>
                          <span style={{ fontSize:9, color:"#94A3B8" }}>
                            {expandedSpec===spec||expandedSpec==="__all__" ? "▼" : "▶"}
                          </span>
                          🎓 {spec}
                        </div>
                        {(expandedSpec===spec || expandedSpec==="__all__" || etudiantSearch.trim()) && (
                          <div style={{ paddingLeft:14, marginTop:4 }}>
                            {Object.entries(promos).map(([promo, ets]) => (
                              <div key={promo} style={{ marginBottom:8 }}>
                                <div style={{ fontSize:10, fontWeight:700, color:"#94A3B8",
                                  textTransform:"uppercase", letterSpacing:" .06em", padding:"4px 8px", marginBottom:4 }}>
                                  {promo}
                                </div>
                                {ets.map(et => {
                                  const isSel = selectedEtudiant?.id === et.id;
                                  return (
                                    <div key={et.id}
                                      onClick={()=>setSelectedEtudiant(isSel ? null : et)}
                                      style={{ display:"flex", alignItems:"center", gap:10,
                                        padding:"8px 10px", borderRadius:8, cursor:"pointer",
                                        background: isSel ? "#EFF6FF" : "#fff",
                                        border:`1px solid ${isSel ? "#BFDBFE" : "#F1F5F9"}`,
                                        marginBottom:4 }}>
                                      <Avatar name={et.displayName} size={26} />
                                      <div style={{ flex:1 }}>
                                        <div style={{ fontSize:12, fontWeight:600, color:"#0F172A" }}>{et.displayName}</div>
                                        <div style={{ fontSize:10, color:"#94A3B8" }}>{et.matricule} · moy. {et.moyenne}</div>
                                      </div>
                                      {isSel ? (
                                        <span style={{ fontSize:11, color:"#1D4ED8", fontWeight:700 }}>✓ Sélectionné</span>
                                      ) : (
                                        <span style={{ fontSize:11, color:"#94A3B8" }}>Sélectionner</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {Object.keys(filteredTree).length === 0 && (
              <div style={{ textAlign:"center", padding:20, color:"#94A3B8", fontSize:13 }}>
                Aucun étudiant trouvé
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom:18 }}>
        <SLabel>Description du signalement *</SLabel>
        <textarea value={descriptionSignal} onChange={e => setDescriptionSignal(e.target.value)}
          rows={4} placeholder="Pourquoi signalez-vous cet étudiant ?"
          style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #E2E8F0",
            background:"#fff", fontSize:13, resize:"vertical", fontFamily:"inherit" }} />
      </div>

      <div style={{ display:"flex", gap:14, marginBottom:18 }}>
        <div style={{ flex:1 }}>
          <SLabel>Date du signalement</SLabel>
          <input type="date" value={dateSignal}
            onChange={e => setDateSignal(e.target.value)}
            style={{ width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid #E2E8F0", background:"#F8FAFC" }} />
        </div>
      </div>

      {error && (
        <div style={{ marginBottom:16, color:"#B91C1C", fontSize:13 }}>{error}</div>
      )}
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <Button onClick={handleSave} style={{ padding:"12px 24px" }}>Enregistrer le signalement</Button>
      </div>
    </Card>
  );
}

// ─── DOSSIERS LIST ────────────────────────────────────────────────────────────
function DossiersList({ dossiers, conseils, membres, onNav, canCreateDossier, etudiants, infractions, onCreated }) {
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("all");
  const [filterGravite, setFilterGravite] = useState("all");
  const [selected,      setSelected]      = useState([]);
  const [viewDossier,   setViewDossier]   = useState(null);   // ← drives "Voir →"
  const [showCreate,    setShowCreate]    = useState(false);

  const enriched = dossiers;

  const filtered = enriched.filter(d => {
    const q     = search.toLowerCase();
    const matchQ = d.etudiant?.displayName.toLowerCase().includes(q)
      || d.etudiant?.matricule?.includes(q)
      || d.infraction?.nom.toLowerCase().includes(q);
    return matchQ
      && (filterStatus  === "all" || d.status             === filterStatus)
      && (filterGravite === "all" || d.infraction?.gravite === filterGravite);
  });

  const toggle    = id => setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const toggleAll = ()  => setSelected(selected.length===filtered.length?[]:filtered.map(d=>d.id));

  return (
    <>
      {/* Detail side-panel */}
      {viewDossier && (
        <DossierDetail dossier={viewDossier} membres={membres} conseils={conseils} onClose={()=>setViewDossier(null)} />
      )}

      <div>
        <div style={{ marginBottom:24, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:"#0F172A", marginBottom:4 }}>Dossiers disciplinaires</h1>
            <p style={{ color:"#64748B", fontSize:14 }}>{dossiers.length} dossier(s) — table : dossiers_disciplinaires</p>
            {canCreateDossier && (
              <div style={{ marginTop:8, fontSize:12, color:"#475569" }}>
                Les enseignants peuvent signaler un dossier ici. Un administrateur planifie ensuite le conseil.
              </div>
            )}
          </div>
          {canCreateDossier && (
            <Button onClick={() => setShowCreate(prev => !prev)}>
              {showCreate ? "× Fermer" : "＋ Nouveau dossier"}
            </Button>
          )}
        </div>

        {showCreate && canCreateDossier && (
          <DossierCreate
            etudiants={etudiants}
            infractions={infractions}
            onCreated={() => { setShowCreate(false); onCreated?.(); }}
          />
        )}

        {selected.length > 0 && (
          <div style={{ background:"#1D4ED8", color:"#fff", borderRadius:10,
            padding:"12px 20px", marginBottom:16, display:"flex",
            alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, fontWeight:600 }}>{selected.length} dossier(s) sélectionné(s)</span>
            <Button variant="secondary" onClick={()=>onNav("conseils")}
              style={{ background:"#fff", color:"#1D4ED8", fontSize:12 }}>
              ⚖ Affecter à un conseil
            </Button>
          </div>
        )}

        <Card style={{ padding:16, marginBottom:16 }}>
          <div style={{ display:"flex", gap:12 }}>
            <Input placeholder="🔍  Étudiant, matricule, infraction…" value={search} onChange={e=>setSearch(e.target.value)} />
            <Select value={filterStatus} onChange={setFilterStatus} style={{ minWidth:170 }} options={[
              { value:"all",            label:"Tous les statuts" },
              { value:"signale",        label:"Signalé" },
              { value:"en_instruction", label:"En instruction" },
              { value:"jugement",       label:"En jugement" },
              { value:"traite",         label:"Traité" },
            ]} />
            <Select value={filterGravite} onChange={setFilterGravite} style={{ minWidth:150 }} options={[
              { value:"all",       label:"Toute gravité" },
              { value:"faible",    label:"Faible" },
              { value:"moyenne",   label:"Moyenne" },
              { value:"grave",     label:"Grave" },
              { value:"tres_grave",label:"Très grave" },
            ]} />
          </div>
        </Card>

        <Card style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#F8FAFC", borderBottom:"1px solid #E2E8F0" }}>
                <th style={{ padding:"12px 14px", width:40 }}>
                  <input type="checkbox"
                    checked={selected.length===filtered.length && filtered.length>0}
                    onChange={toggleAll} />
                </th>
                {["#","Étudiant","Matricule","Filière / Niv.","Infraction","Gravité","Signalé par","Date signal","Statut","Action"].map(h=>(
                  <th key={h} style={{ padding:"12px 14px", textAlign:"left", color:"#94A3B8",
                    fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:".05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d,i)=>(
                <tr key={d.id} style={{ borderTop:i>0?"1px solid #F1F5F9":"none" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"12px 14px" }}>
                    <input type="checkbox" checked={selected.includes(d.id)} onChange={()=>toggle(d.id)} />
                  </td>
                  <td style={{ padding:"12px 14px", color:"#94A3B8", fontSize:11, fontFamily:"monospace" }}>{d.id}</td>
                  <td style={{ padding:"12px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <Avatar name={d.etudiant?.displayName} size={28} />
                      <span style={{ fontWeight:600, color:"#0F172A" }}>{d.etudiant?.displayName}</span>
                    </div>
                  </td>
                  <td style={{ padding:"12px 14px", color:"#64748B", fontSize:12, fontFamily:"monospace" }}>{d.etudiant?.matricule}</td>
                  <td style={{ padding:"12px 14px", color:"#64748B", fontSize:12 }}>
                    {d.etudiant?.displayField}
                    <span style={{ marginLeft:5, background:"#F1F5F9", borderRadius:5,
                      padding:"1px 6px", fontSize:10, fontWeight:700 }}>{d.etudiant?.displayLevel}</span>
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:12 }}>{d.infraction?.nom}</td>
                  <td style={{ padding:"12px 14px" }}><GraviteBadge gravite={d.infraction?.gravite} /></td>
                  <td style={{ padding:"12px 14px", color:"#64748B", fontSize:12 }}>{d.signalant?.displayName || "—"}</td>
                  <td style={{ padding:"12px 14px", color:"#94A3B8", fontSize:12 }}>{new Date(d.date_signal).toLocaleDateString("fr-FR")}</td>
                  <td style={{ padding:"12px 14px" }}><DossierBadge status={d.status} /></td>
                  <td style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:6 }}>
                    {d.conseil_id && (
                      <span style={{ fontSize:11, color:"#1D4ED8", fontWeight:700 }}>
                        ⚠ Choisi pour le conseil #{d.conseil_id}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => setViewDossier(d)}
                      style={{ fontSize:11, padding:"4px 10px", alignSelf:"flex-start" }}>
                      Voir →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && (
            <div style={{ textAlign:"center", padding:40, color:"#94A3B8" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
              <div>Aucun dossier trouvé</div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

// ─── CONSEILS LIST + CREATE ───────────────────────────────────────────────────
function ConseilsList({ conseils, dossiers, membres, enseignants, etudiants, president, onViewConseil, onConseilCreated, canCreateConseil }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({
    date_reunion: "", heure: "", lieu: "",
    annee_universitaire: "2024-2025", description: "",
  });

  const [selectedPresidentId, setSelectedPresidentId] = useState(president?.id || PRESIDENT.id);
  const [selectedMembers,  setSelectedMembers]  = useState([]);
  const [memberSearch,     setMemberSearch]      = useState("");
  const [selectedReportIds, setSelectedReportIds] = useState([]);
  const [reportSearch,     setReportSearch]       = useState("");
  const [error,            setError]            = useState("");
  const [saved,            setSaved]            = useState(false);

  const pres = president || PRESIDENT;
  const MAX_MEMBERS = 3;
  const pendingReports = (dossiers || []).filter(d => d.status === "signale" && !d.conseil_id);
  const selectedPresident = (enseignants || []).find(e => e.id === Number(selectedPresidentId)) || pres;
  const selectedReports = pendingReports.filter(d => selectedReportIds.includes(d.id));
  const reporterIds = selectedReports.map(d => d.signalant?.id).filter(Boolean);

  const availableTeachers = (enseignants || [])
    .filter(e => e.id !== Number(selectedPresidentId))
    .filter(e =>
      e.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (e.displayGrade||"").toLowerCase().includes(memberSearch.toLowerCase())
    );

  const handleSetPresident = (id) => {
    setSelectedPresidentId(id);
    setSelectedMembers(prev => prev.filter(m => m.enseignant_id !== Number(id)));
  };

  const addMember = (ens) => {
    if (selectedMembers.length >= MAX_MEMBERS) {
      setError("Maximum 3 membres additionnels autorisés (limite DB : membres_conseil).");
      return;
    }
    if (selectedMembers.find(m => m.enseignant_id === ens.id)) return;
    setSelectedMembers(prev => [...prev, { enseignant_id: ens.id, role: "membre", _ens: ens }]);
    setMemberSearch("");
    setError("");
  };

  const removeMember = (id) =>
    setSelectedMembers(prev => prev.filter(m => m.enseignant_id !== id));

  const updateRole = (id, role) =>
    setSelectedMembers(prev =>
      prev.map(m => m.enseignant_id === id ? { ...m, role } : m)
    );

  const filteredReports = pendingReports.filter(d => {
    const q = reportSearch.toLowerCase();
    return !q ||
      d.etudiant?.displayName?.toLowerCase().includes(q) ||
      d.etudiant?.matricule?.toLowerCase().includes(q) ||
      d.signalant?.displayName?.toLowerCase().includes(q) ||
      (d.description_signal || "").toLowerCase().includes(q);
  });

  const handleSave = async () => {
    if (!form.date_reunion || !form.heure || !form.lieu) {
      setError("Veuillez remplir la date, l'heure et le lieu.");
      return;
    }
    if (!selectedReportIds.length) {
      setError("Veuillez sélectionner au moins un signalement pour le conseil.");
      return;
    }
    try {
      await apiCreateConseil({
        ...form,
        dossierIds: selectedReportIds,
        membres: selectedMembers.map(m => ({ enseignantId: m.enseignant_id, role: m.role })),
      });
      onConseilCreated();
      setSaved(true);
      setShowForm(false);
      setSelectedMembers([]);
      setSelectedReportIds([]);
      setReportSearch("");
      setForm({ date_reunion:"", heure:"", lieu:"", annee_universitaire:"2024-2025", description:"" });
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'enregistrement.");
    }
  };

  return (
    <div>
      <div style={{ marginBottom:24, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"#0F172A", marginBottom:4 }}>Conseils disciplinaires</h1>
          <p style={{ color:"#64748B", fontSize:14 }}>conseils_disciplinaires + membres_conseil</p>
        </div>
        {canCreateConseil ? (
          <Button onClick={()=>{ setShowForm(v=>!v); setError(""); setSaved(false); }}>＋ Nouveau conseil</Button>
        ) : (
          <div style={{ color:"#64748B", fontSize:12, alignSelf:"center" }}>
            Seuls les administrateurs et présidents peuvent créer un conseil.
          </div>
        )}
      </div>

      {saved && (
        <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10,
          padding:"12px 20px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18 }}>✅</span>
          <span style={{ fontSize:13, color:"#065F46", fontWeight:600 }}>Conseil planifié avec succès.</span>
        </div>
      )}

      {showForm && (
        <Card style={{ padding:24, marginBottom:24 }}>
          <div style={{ fontSize:15, fontWeight:700, color:"#0F172A", marginBottom:18 }}>
            Planifier un nouveau conseil
          </div>

          {/* ── Meeting details ─────────────────────────────── */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:20 }}>
            <div><SLabel>Date de réunion *</SLabel>
              <input type="date" value={form.date_reunion}
                onChange={e=>setForm(f=>({...f,date_reunion:e.target.value}))}
                style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #E2E8F0",
                  fontSize:13, background:"#F8FAFC", width:"100%" }} />
            </div>
            <div><SLabel>Heure *</SLabel>
              <input type="time" value={form.heure}
                onChange={e=>setForm(f=>({...f,heure:e.target.value}))}
                style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #E2E8F0",
                  fontSize:13, background:"#F8FAFC", width:"100%" }} />
            </div>
            <div><SLabel>Année universitaire</SLabel>
              <Input value={form.annee_universitaire}
                onChange={e=>setForm(f=>({...f,annee_universitaire:e.target.value}))} />
            </div>
            <div style={{ gridColumn:"1/-1" }}><SLabel>Lieu *</SLabel>
              <Input placeholder="Ex : Salle C12, lien visio…" value={form.lieu}
                onChange={e=>setForm(f=>({...f,lieu:e.target.value}))} />
            </div>
            <div style={{ gridColumn:"1/-1" }}><SLabel>Description / Ordre du jour</SLabel>
              <textarea value={form.description}
                onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                rows={3} placeholder="Motifs et points à traiter…"
                style={{ width:"100%", padding:"8px 12px", borderRadius:8,
                  border:"1px solid #E2E8F0", fontSize:13, background:"#F8FAFC",
                  resize:"vertical", fontFamily:"inherit" }} />
            </div>
          </div>

          {/* ── Student picker ──────────────────────────────── */}
          <div style={{ border:"1px solid #E2E8F0", borderRadius:12, overflow:"hidden", marginBottom:20 }}>
            <div style={{ background:"#F8FAFC", padding:"12px 16px",
              borderBottom:"1px solid #E2E8F0", display:"flex",
              justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>Étudiant concerné</div>
                <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>
                  Groupés par filière → spécialité → promo
                </div>
              </div>
              {selectedEtudiant && (
                <div style={{ display:"flex", alignItems:"center", gap:8,
                  background:"#EFF6FF", border:"1px solid #BFDBFE",
                  borderRadius:20, padding:"4px 12px" }}>
                  <Avatar name={selectedEtudiant.displayName} size={20} />
                  <span style={{ fontSize:12, fontWeight:600, color:"#1E40AF" }}>
                    {selectedEtudiant.displayName}
                  </span>
                  <button onClick={()=>setSelectedEtudiant(null)}
                    style={{ border:"none", background:"none", color:"#64748B",
                      cursor:"pointer", fontSize:14, padding:0, lineHeight:1 }}>×</button>
                </div>
              )}
            </div>

            <div style={{ padding:14 }}>
              <Input
                placeholder="🔍  Rechercher étudiant, matricule, promo…"
                value={etudiantSearch}
                onChange={e=>{ setEtudiantSearch(e.target.value); setExpandedFiliere(null); setExpandedSpec(null); }}
                style={{ marginBottom:10 }}
              />
              <div style={{ maxHeight:260, overflowY:"auto" }}>
                {Object.entries(filteredTree).map(([filiere, specs]) => (
                  <div key={filiere} style={{ marginBottom:4 }}>
                    {/* Filière header */}
                    <div onClick={()=>{ setExpandedFiliere(expandedFiliere===filiere?null:filiere); setExpandedSpec("__all__"); }}
                      style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px",
                        background:"#F1F5F9", borderRadius:8, cursor:"pointer",
                        fontWeight:700, fontSize:12, color:"#334155",
                        userSelect:"none" }}>
                      <span style={{ fontSize:10, color:"#94A3B8" }}>
                        {expandedFiliere===filiere||expandedFiliere==="__all__" ? "▼" : "▶"}
                      </span>
                      📚 {filiere}
                      <span style={{ marginLeft:"auto", background:"#E2E8F0",
                        borderRadius:12, padding:"1px 8px", fontSize:10, fontWeight:600, color:"#64748B" }}>
                        {Object.values(specs).flatMap(p=>Object.values(p)).flat().length} étudiant(s)
                      </span>
                    </div>

                    {(expandedFiliere===filiere || expandedFiliere==="__all__" || etudiantSearch.trim()) && (
                      <div style={{ paddingLeft:14, marginTop:4 }}>
                        {Object.entries(specs).map(([spec, promos]) => (
                          <div key={spec} style={{ marginBottom:4 }}>
                            <div onClick={()=>setExpandedSpec(expandedSpec===spec?null:spec)}
                              style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px",
                                background:"#F8FAFC", borderRadius:6, cursor:"pointer",
                                fontWeight:600, fontSize:11, color:"#475569", userSelect:"none" }}>
                              <span style={{ fontSize:9, color:"#94A3B8" }}>
                                {expandedSpec===spec||expandedSpec==="__all__" ? "▼" : "▶"}
                              </span>
                              🎓 {spec}
                            </div>

                            {(expandedSpec===spec || expandedSpec==="__all__" || etudiantSearch.trim()) && (
                              <div style={{ paddingLeft:14, marginTop:4 }}>
                                {Object.entries(promos).map(([promo, ets]) => (
                                  <div key={promo} style={{ marginBottom:8 }}>
                                    {/* Promo label */}
                                    <div style={{ fontSize:10, fontWeight:700, color:"#94A3B8",
                                      textTransform:"uppercase", letterSpacing:".06em",
                                      padding:"4px 8px", marginBottom:4 }}>
                                      {promo}
                                    </div>
                                    {/* Student rows */}
                                    {ets.map(et => {
                                      const isSel = selectedEtudiant?.id === et.id;
                                      return (
                                        <div key={et.id}
                                          onClick={()=>setSelectedEtudiant(isSel ? null : et)}
                                          style={{ display:"flex", alignItems:"center", gap:10,
                                            padding:"8px 10px", borderRadius:8, cursor:"pointer",
                                            background: isSel ? "#EFF6FF" : "#fff",
                                            border: `1px solid ${isSel ? "#BFDBFE" : "#F1F5F9"}`,
                                            marginBottom:4, transition:"all .1s" }}>
                                          <Avatar name={et.displayName} size={26} />
                                          <div style={{ flex:1 }}>
                                            <div style={{ fontSize:12, fontWeight:600, color:"#0F172A" }}>
                                              {et.displayName}
                                            </div>
                                            <div style={{ fontSize:10, color:"#94A3B8" }}>
                                              {et.matricule} · moy. {et.moyenne}
                                            </div>
                                          </div>
                                          {isSel
                                            ? <span style={{ fontSize:11, color:"#1D4ED8", fontWeight:700 }}>✓ Sélectionné</span>
                                            : <span style={{ fontSize:11, color:"#94A3B8" }}>Sélectionner</span>
                                          }
                                        </div>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {Object.keys(filteredTree).length === 0 && (
                  <div style={{ textAlign:"center", padding:20, color:"#94A3B8", fontSize:13 }}>
                    Aucun étudiant trouvé
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Council composition ──────────────────────────── */}
          <div style={{ border:"1px solid #E2E8F0", borderRadius:12, overflow:"hidden", marginBottom:20 }}>
            <div style={{ background:"#F8FAFC", padding:"12px 16px",
              borderBottom:"1px solid #E2E8F0", display:"flex",
              justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>
                  Composition du conseil — membres_conseil
                </div>
                <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>
                  Président fixe + jusqu'à <strong>3 enseignants</strong> additionnels
                </div>
              </div>
              <div style={{
                background: selectedMembers.length >= MAX_MEMBERS ? "#FEE2E2" : "#EFF6FF",
                color:      selectedMembers.length >= MAX_MEMBERS ? "#DC2626" : "#1D4ED8",
                borderRadius: 20, padding:"3px 12px", fontSize:12, fontWeight:700,
              }}>
                {selectedMembers.length} / {MAX_MEMBERS} membres
              </div>
            </div>

            <div style={{ padding:16 }}>
              {/* President row — always fixed */}
              <div style={{ display:"flex", alignItems:"center", gap:12,
                background:"#F0FDF4", border:"1px solid #BBF7D0",
                borderRadius:10, padding:"12px 16px", marginBottom:14 }}>
                <Avatar name={pres.displayName} size={36} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>{pres.displayName}</div>
                  <div style={{ fontSize:11, color:"#64748B" }}>{pres.displayGrade}</div>
                </div>
                <span style={{ background:"#DCFCE7", color:"#166534",
                  borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700 }}>
                  Président
                </span>
                <span style={{ fontSize:10, color:"#94A3B8" }}>president_id (FK)</span>
              </div>

              {/* Selected members chips */}
              {selectedMembers.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                  {selectedMembers.map((m) => (
                    <div key={m.enseignant_id} style={{ display:"flex", alignItems:"center",
                      gap:12, background:"#F8FAFC", border:"1px solid #E2E8F0",
                      borderRadius:10, padding:"10px 14px" }}>
                      <Avatar name={m._ens.displayName} size={30} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{m._ens.displayName}</div>
                        <div style={{ fontSize:11, color:"#64748B" }}>{m._ens.displayGrade}</div>
                      </div>
                      <select value={m.role}
                        onChange={e => updateRole(m.enseignant_id, e.target.value)}
                        style={{ padding:"5px 10px", borderRadius:8,
                          border:"1px solid #E2E8F0", fontSize:12,
                          background:"#fff", cursor:"pointer", color:"#334155" }}>
                        <option value="membre">Membre</option>
                        <option value="rapporteur">Rapporteur</option>
                      </select>
                      <button onClick={() => removeMember(m.enseignant_id)}
                        style={{ border:"none", background:"#FEE2E2", color:"#DC2626",
                          borderRadius:6, width:28, height:28, cursor:"pointer",
                          fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Teacher search & add */}
              {selectedMembers.length < MAX_MEMBERS ? (
                <div>
                  <SLabel>Ajouter un enseignant ({MAX_MEMBERS - selectedMembers.length} place(s) restante(s))</SLabel>
                  <Input
                    placeholder="🔍  Rechercher par nom ou grade…"
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    style={{ marginBottom:8 }}
                  />
                  <div style={{ border:"1px solid #E2E8F0", borderRadius:8,
                    overflow:"hidden", maxHeight:200, overflowY:"auto" }}>
                    {availableTeachers
                      .filter(e => !selectedMembers.find(m => m.enseignant_id === e.id))
                      .map((e, i) => (
                        <div key={e.id}
                          onClick={() => addMember(e)}
                          style={{ display:"flex", alignItems:"center", gap:10,
                            padding:"10px 14px", cursor:"pointer",
                            borderTop: i > 0 ? "1px solid #F1F5F9" : "none",
                            background:"#fff" }}
                          onMouseEnter={el => el.currentTarget.style.background = "#EFF6FF"}
                          onMouseLeave={el => el.currentTarget.style.background = "#fff"}>
                          <Avatar name={e.displayName} size={28} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{e.displayName}</div>
                            <div style={{ fontSize:11, color:"#94A3B8" }}>{e.displayGrade} · Bureau {e.bureau}</div>
                          </div>
                          <span style={{ fontSize:11, color:"#1D4ED8", fontWeight:600 }}>+ Ajouter</span>
                        </div>
                      ))
                    }
                    {availableTeachers.filter(e => !selectedMembers.find(m => m.enseignant_id === e.id)).length === 0 && (
                      <div style={{ padding:"12px 14px", color:"#94A3B8", fontSize:13 }}>
                        Aucun enseignant disponible
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ background:"#FEF9C3", border:"1px solid #FDE047",
                  borderRadius:8, padding:"10px 14px", fontSize:12, color:"#854D0E", fontWeight:500 }}>
                  ⚠ Limite atteinte — 3 membres additionnels maximum par conseil.
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{ background:"#FEE2E2", border:"1px solid #FECACA",
              borderRadius:8, padding:"10px 14px", marginBottom:14,
              fontSize:12, color:"#DC2626", fontWeight:500 }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <Button onClick={handleSave}>💾 Enregistrer le conseil</Button>
            <Button variant="ghost" onClick={()=>{ setShowForm(false); setError(""); setSelectedMembers([]); setSelectedEtudiant(null); }}>
              Annuler
            </Button>
          </div>
        </Card>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {[...conseils].sort((a,b)=>new Date(b.date_reunion)-new Date(a.date_reunion)).map(c=>{
          const membresC = (membres||[]).filter(m => m.conseil_id === c.id);
          const doss     = getDossiersForConseil(c.id, dossiers);
          const pres     = membresC.find(m=>m.role==="president");
          const strip    = c.status==="termine"?"#059669":c.status==="en_cours"?"#D97706":"#2563EB";
          return (
            <Card key={c.id} style={{ padding:0, overflow:"hidden" }}>
              <div style={{ display:"flex" }}>
                <div style={{ width:5, background:strip, flexShrink:0 }} />
                <div style={{ flex:1, padding:"18px 20px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between",
                    alignItems:"flex-start", marginBottom:12 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                        <span style={{ fontWeight:700, color:"#0F172A", fontSize:15 }}>
                          Conseil #{c.id} — {new Date(c.date_reunion).toLocaleDateString("fr-FR",
                            {weekday:"long",year:"numeric",month:"long",day:"numeric"})}
                        </span>
                        <ConseilBadge status={c.status} />
                      </div>
                      <div style={{ fontSize:12, color:"#64748B" }}>{c.heure} · {c.lieu} · {c.annee_universitaire}</div>
                    </div>
                    <Button variant="ghost" onClick={()=>onViewConseil(c.id)} style={{ fontSize:12, padding:"5px 12px" }}>Ouvrir →</Button>
                  </div>
                  <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
                    <div>
                      <SLabel>Président</SLabel>
                      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:13 }}>
                        <Avatar name={pres?.enseignant?.displayName||"?"} size={22} />
                        <span>{pres?.enseignant?.displayName||"—"}</span>
                      </div>
                    </div>
                    <div>
                      <SLabel>Membres ({membresC.length})</SLabel>
                      <div style={{ display:"flex", gap:3 }}>
                        {membresC.slice(0,4).map(m=><Avatar key={m.id} name={m.enseignant?.displayName||"?"} size={22} />)}
                      </div>
                    </div>
                    <div>
                      <SLabel>Dossiers associés</SLabel>
                      <span style={{ fontSize:13, fontWeight:700, color:"#1D4ED8" }}>{doss.length}</span>
                    </div>
                    {c.description && (
                      <div style={{ flex:1 }}>
                        <SLabel>Description</SLabel>
                        <span style={{ fontSize:12, color:"#64748B" }}>{c.description}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {conseils.length === 0 && (
          <div style={{ textAlign:"center", padding:48, color:"#94A3B8" }}>
            <div style={{ fontSize:36, marginBottom:8 }}>⚖</div>
            <div>Aucun conseil. Créez-en un avec le bouton ci-dessus.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CONSEIL DETAIL ───────────────────────────────────────────────────────────
function ConseilDetail({ conseil, dossiers, decisions, getMembres, onBack, onFinalize }) {
  const membres = getMembres ? getMembres(conseil.id) : getMembresForConseil(conseil.id);
  const doss    = getDossiersForConseil(conseil.id, dossiers);

  const [drafts,    setDrafts]    = useState(Object.fromEntries(doss.map(d=>[d.id,{
    decision_id:       String(d.decision_id||""),
    remarque_decision: d.remarque_decision||"",
    status:            d.status,
  }])));
  const [finalized, setFinalized] = useState(conseil.status==="termine");
  const [notes,     setNotes]     = useState(conseil.description||"");
  const [selectedAssign, setSelectedAssign] = useState([]);
  const [assignError,   setAssignError]   = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const pendingDossiers = dossiers.filter(d => !d.conseil_id);
  const president = membres.find(m => m.role === "president")?.enseignant;
  const reporterConflict = pendingDossiers.some(d => d.signalant?.id === president?.id);

  const handleAssignPending = async () => {
    if (selectedAssign.length === 0) {
      setAssignError("Sélectionnez au moins un dossier à assigner.");
      return;
    }
    try {
      setAssignLoading(true);
      await Promise.all(selectedAssign.map(id => api.updateDossier(id, {
        conseilId: conseil.id,
        status: "en_instruction",
      })));
      setAssignError("");
      setSelectedAssign([]);
      onFinalize && onFinalize(conseil.id, drafts);
    } catch (err) {
      setAssignError(err.response?.data?.error?.message || "Erreur lors de l'assignation des dossiers.");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleToggleAssign = id =>
    setSelectedAssign(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAssignAll = () =>
    setSelectedAssign(pendingDossiers.map(d => d.id));

  const handleClearAssign = () =>
    setSelectedAssign([]);

  const handleFinalize = async () => {
    try {
      await apiFinaliserConseil(conseil.id, drafts);
      setFinalized(true);
      onFinalize && onFinalize(conseil.id, drafts);
    } catch (err) {
      alert(err.response?.data?.error || "Erreur lors de la finalisation.");
    }
  };

  return (
    <div>
      <div style={{ marginBottom:24, display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onBack} style={{ border:"none", background:"#F1F5F9",
          borderRadius:8, padding:"8px 12px", cursor:"pointer", fontSize:13, color:"#64748B" }}>← Retour</button>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, color:"#0F172A" }}>Conseil #{conseil.id}</h1>
          <p style={{ color:"#64748B", fontSize:13 }}>
            {new Date(conseil.date_reunion).toLocaleDateString("fr-FR",
              {weekday:"long",year:"numeric",month:"long",day:"numeric"})}
            {" · "}{conseil.heure}{" · "}{conseil.lieu}
          </p>
        </div>
        <div style={{ marginLeft:"auto" }}><ConseilBadge status={finalized?"termine":conseil.status} /></div>
      </div>

      {/* membres_conseil */}
      <Card style={{ padding:20, marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#0F172A", marginBottom:4 }}>Composition du conseil</div>
        <div style={{ fontSize:11, color:"#94A3B8", marginBottom:12 }}>Table : membres_conseil (conseil_id, enseignant_id, role)</div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          {membres.map(m=>(
            <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10,
              padding:"10px 14px", borderRadius:10,
              background: m.role==="president"?"#F0FDF4":"#F8FAFC",
              border:`1px solid ${m.role==="president"?"#BBF7D0":"#E2E8F0"}` }}>
              <Avatar name={m.enseignant.displayName} size={32} />
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{m.enseignant.displayName}</div>
                <div style={{ fontSize:10, color:"#94A3B8" }}>{m.enseignant.displayGrade}</div>
                <div style={{ fontSize:10, fontWeight:700, textTransform:"capitalize",
                  color:m.role==="president"?"#065F46":"#64748B" }}>{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {pendingDossiers.length > 0 && !finalized && (
        <Card style={{ padding:20, marginBottom:20, background: "#EFF6FF" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>Dossiers en attente</div>
              <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>
                Affectez ces dossiers au conseil pour passer de <strong>Signalé</strong> à <strong>En instruction</strong>.
              </div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <Button variant="ghost" onClick={handleAssignAll} disabled={selectedAssign.length === pendingDossiers.length}>
                Tout sélectionner
              </Button>
              <Button variant="secondary" onClick={handleClearAssign} disabled={selectedAssign.length===0}>
                Effacer
              </Button>
            </div>
          </div>
          {reporterConflict && (
            <div style={{ marginBottom:14, color:"#B45309", fontSize:12 }}>
              ⚠ Un des dossiers en attente a été signalé par le président du conseil. Vérifiez la composition ou changez le président si nécessaire.
            </div>
          )}
          <div style={{ maxHeight:220, overflowY:"auto", borderRadius:12, border:"1px solid #CBD5E1", background:"#fff" }}>
            {pendingDossiers.map(d => (
              <label key={d.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderBottom:"1px solid #E2E8F0", cursor:"pointer" }}>
                <input type="checkbox" checked={selectedAssign.includes(d.id)} onChange={() => handleToggleAssign(d.id)} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{d.etudiant?.displayName}</div>
                  <div style={{ fontSize:12, color:"#64748B" }}>{d.infraction?.nom} · {new Date(d.date_signal).toLocaleDateString("fr-FR")}</div>
                </div>
                <DossierBadge status={d.status} />
              </label>
            ))}
          </div>
          {assignError && (
            <div style={{ marginTop:14, color:"#B91C1C", fontSize:12 }}>{assignError}</div>
          )}
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:14 }}>
            <Button disabled={selectedAssign.length===0 || assignLoading} onClick={handleAssignPending}>
              {assignLoading ? "Assignation…" : "Affecter au conseil"}
            </Button>
          </div>
        </Card>
      )}

      {/* dossiers_disciplinaires */}
      {doss.length===0 && (
        <Card style={{ padding:32, textAlign:"center", color:"#94A3B8" }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
          <div>Aucun dossier associé à ce conseil.</div>
        </Card>
      )}

      {doss.map(d=>(
        <Card key={d.id} style={{ padding:20, marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14,
            paddingBottom:12, borderBottom:"1px solid #F1F5F9" }}>
            <Avatar name={d.etudiant?.displayName} size={36} />
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, color:"#0F172A", fontSize:15 }}>{d.etudiant?.displayName}</div>
              <div style={{ fontSize:12, color:"#94A3B8" }}>
                Matricule : {d.etudiant?.matricule} · {d.etudiant?.displayField} {d.etudiant?.displayLevel}
                {" · "}{d.etudiant?.promo?.nom}
              </div>
            </div>
            <DossierBadge status={drafts[d.id]?.status||d.status} />
          </div>

          {/* Infraction info */}
          <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A",
            borderRadius:8, padding:"10px 14px", marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"#92400E", marginBottom:2 }}>
                  {d.infraction?.nom}
                </div>
                <div style={{ fontSize:11, color:"#B45309" }}>{d.infraction?.description}</div>
                <div style={{ fontSize:11, color:"#78350F", marginTop:2 }}>
                  Signalé par <strong>{d.signalant?.displayName||"—"}</strong> le {new Date(d.date_signal).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <GraviteBadge gravite={d.infraction?.gravite} />
            </div>
            {d.description_signal && (
              <div style={{ fontSize:11, color:"#92400E", marginTop:8, fontStyle:"italic",
                borderTop:"1px solid #FDE68A", paddingTop:8 }}>"{d.description_signal}"</div>
            )}
          </div>

          {/* Decision entry — maps to decisions table FK + remarque_decision */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <SLabel>Décision (decisions.id)</SLabel>
              <Select value={drafts[d.id]?.decision_id||""}
                onChange={v=>setDrafts(p=>({...p,[d.id]:{...p[d.id],decision_id:v}}))}
                options={[
                  {value:"",label:"Choisir une décision…"},
                  ...( decisions || []).map(dec=>({
                    value:String(dec.id),
                    label:`${dec.nom} — ${SANCTION_CONFIG[dec.niveau_sanction]?.label||dec.niveau_sanction}`,
                  }))
                ]} style={{ width:"100%" }} />
            </div>
            <div>
              <SLabel>Statut du dossier</SLabel>
              <Select value={drafts[d.id]?.status||""}
                onChange={v=>setDrafts(p=>({...p,[d.id]:{...p[d.id],status:v}}))}
                options={[
                  {value:"signale",        label:"Signalé"},
                  {value:"en_instruction", label:"En instruction"},
                  {value:"jugement",       label:"En jugement"},
                  {value:"traite",         label:"Traité"},
                ]} style={{ width:"100%" }} />
            </div>
          </div>
          <div>
            <SLabel>Remarque décision (remarque_decision)</SLabel>
            <textarea value={drafts[d.id]?.remarque_decision||""}
              onChange={e=>setDrafts(p=>({...p,[d.id]:{...p[d.id],remarque_decision:e.target.value}}))}
              placeholder="Motifs et détails…" rows={3} disabled={finalized}
              style={{ width:"100%", padding:"8px 12px", borderRadius:8,
                border:"1px solid #E2E8F0", fontSize:13,
                background:finalized?"#F8FAFC":"#fff",
                resize:"vertical", fontFamily:"inherit" }} />
          </div>
        </Card>
      ))}

      <Card style={{ padding:20, marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#0F172A", marginBottom:10 }}>Procès-verbal / Notes de séance</div>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)}
          placeholder="Résumé des délibérations…" rows={4} disabled={finalized}
          style={{ width:"100%", padding:"8px 12px", borderRadius:8,
            border:"1px solid #E2E8F0", fontSize:13,
            background:finalized?"#F8FAFC":"#fff",
            resize:"vertical", fontFamily:"inherit" }} />
      </Card>

      {!finalized
        ? <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <Button onClick={handleFinalize} style={{ padding:"12px 24px", fontSize:14 }}>
              ✓ Finaliser et mettre à jour les dossiers
            </Button>
          </div>
        : <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10,
            padding:"14px 20px", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <span style={{ fontSize:13, color:"#065F46", fontWeight:600 }}>
              Conseil terminé — décisions enregistrées.
            </span>
          </div>
      }
    </div>
  );
}

// ─── INFRACTIONS (reference tables) ──────────────────────────────────────────
function InfractionsList({ infractions = [], decisions = [] }) {
  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:"#0F172A", marginBottom:4 }}>Infractions & Décisions</h1>
        <p style={{ color:"#64748B", fontSize:14 }}>Tables de référence : infractions, decisions</p>
      </div>
      <Card style={{ marginBottom:24 }}>
        <div style={{ padding:"14px 20px", borderBottom:"1px solid #F1F5F9", fontSize:13, fontWeight:700, color:"#0F172A" }}>
          infractions
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:"#F8FAFC", borderBottom:"1px solid #E2E8F0" }}>
              {["id","nom","description","gravite"].map(h=>(
                <th key={h} style={{ padding:"11px 16px", textAlign:"left", color:"#94A3B8",
                  fontWeight:600, fontSize:11, fontFamily:"monospace" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {infractions.map((inf,i)=>(
              <tr key={inf.id} style={{ borderTop:i>0?"1px solid #F1F5F9":"none" }}
                onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{ padding:"12px 16px", fontFamily:"monospace", color:"#94A3B8" }}>{inf.id}</td>
                <td style={{ padding:"12px 16px", fontWeight:600, color:"#0F172A" }}>{inf.nom}</td>
                <td style={{ padding:"12px 16px", color:"#64748B", fontSize:12 }}>{inf.description}</td>
                <td style={{ padding:"12px 16px" }}><GraviteBadge gravite={inf.gravite} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <div style={{ padding:"14px 20px", borderBottom:"1px solid #F1F5F9", fontSize:13, fontWeight:700, color:"#0F172A" }}>
          decisions
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:"#F8FAFC", borderBottom:"1px solid #E2E8F0" }}>
              {["id","nom","niveau_sanction"].map(h=>(
                <th key={h} style={{ padding:"11px 16px", textAlign:"left", color:"#94A3B8",
                  fontWeight:600, fontSize:11, fontFamily:"monospace" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {decisions.map((d,i)=>(
              <tr key={d.id} style={{ borderTop:i>0?"1px solid #F1F5F9":"none" }}
                onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{ padding:"12px 16px", fontFamily:"monospace", color:"#94A3B8" }}>{d.id}</td>
                <td style={{ padding:"12px 16px", fontWeight:600, color:"#0F172A" }}>{d.nom}</td>
                <td style={{ padding:"12px 16px" }}>
                  <span style={{ padding:"3px 10px", borderRadius:12, fontSize:11, fontWeight:700,
                    color:SANCTION_CONFIG[d.niveau_sanction]?.color||"#64748B", background:"#F1F5F9" }}>
                    {SANCTION_CONFIG[d.niveau_sanction]?.label||d.niveau_sanction}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── ARCHIVES ─────────────────────────────────────────────────────────────────
function Archives({ conseils, dossiers, membres, onViewConseil }) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [search,       setSearch]       = useState("");

  const filtered = conseils.filter(c=>{
    const matchS = filterStatus==="all" || c.status===filterStatus;
    const matchQ = search==="" || (c.lieu||"").toLowerCase().includes(search.toLowerCase()) || String(c.id).includes(search);
    return matchS && matchQ;
  }).sort((a,b)=>new Date(b.date_reunion)-new Date(a.date_reunion));

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:"#0F172A", marginBottom:4 }}>Archives</h1>
        <p style={{ color:"#64748B", fontSize:14 }}>Historique complet des conseils disciplinaires</p>
      </div>
      <Card style={{ padding:16, marginBottom:16 }}>
        <div style={{ display:"flex", gap:12 }}>
          <Input placeholder="🔍  ID, lieu…" value={search} onChange={e=>setSearch(e.target.value)} />
          <Select value={filterStatus} onChange={setFilterStatus} style={{ minWidth:170 }} options={[
            {value:"all",      label:"Tous"},
            {value:"planifie", label:"Planifié"},
            {value:"en_cours", label:"En cours"},
            {value:"termine",  label:"Terminé"},
          ]} />
        </div>
      </Card>
      <Card>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:"#F8FAFC", borderBottom:"1px solid #E2E8F0" }}>
              {["#","Date","Heure","Lieu","Année univ.","Dossiers","Membres","Statut","Action"].map(h=>(
                <th key={h} style={{ padding:"12px 14px", textAlign:"left", color:"#94A3B8",
                  fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:".05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c,i)=>{
              const membresC = (membres||[]).filter(m => m.conseil_id === c.id);
              const doss    = getDossiersForConseil(c.id, dossiers);
              return (
                <tr key={c.id} style={{ borderTop:i>0?"1px solid #F1F5F9":"none" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{ padding:"13px 14px", fontFamily:"monospace", color:"#94A3B8", fontSize:11 }}>{c.id}</td>
                  <td style={{ padding:"13px 14px", fontWeight:600 }}>{new Date(c.date_reunion).toLocaleDateString("fr-FR")}</td>
                  <td style={{ padding:"13px 14px", color:"#64748B" }}>{c.heure}</td>
                  <td style={{ padding:"13px 14px", color:"#64748B" }}>{c.lieu}</td>
                  <td style={{ padding:"13px 14px", color:"#64748B" }}>{c.annee_universitaire}</td>
                  <td style={{ padding:"13px 14px", fontWeight:700, color:"#1D4ED8" }}>{doss.length}</td>
                  <td style={{ padding:"13px 14px" }}>
                    <div style={{ display:"flex", gap:3 }}>
                      {membresC.slice(0,3).map(m=><Avatar key={m.id} name={m.enseignant?.displayName||"?"} size={22} />)}
                      {membresC.length>3 && <div style={{ width:22, height:22, borderRadius:"50%",
                        background:"#E2E8F0", display:"flex", alignItems:"center",
                        justifyContent:"center", fontSize:9, color:"#64748B" }}>+{membresC.length-3}</div>}
                    </div>
                  </td>
                  <td style={{ padding:"13px 14px" }}><ConseilBadge status={c.status} /></td>
                  <td style={{ padding:"13px 14px" }}>
                    <Button variant="ghost" onClick={()=>onViewConseil(c.id)} style={{ fontSize:11, padding:"4px 10px" }}>Voir →</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0 && (
          <div style={{ textAlign:"center", padding:40, color:"#94A3B8" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🗃</div>
            <div>Aucun conseil trouvé</div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,        setScreen]        = useState("dashboard");
  const [viewConseilId, setViewConseilId] = useState(null);

  const [conseils,     setConseils]     = useState([]);
  const [dossiers,     setDossiers]     = useState([]);
  const [membres,      setMembres]      = useState([]);
  const [infractions,  setInfractions]  = useState([]);
  const [decisions,    setDecisions]    = useState([]);
  const [enseignants,  setEnseignants]  = useState([]);
  const [etudiants,    setEtudiants]    = useState([]);
  const [president,    setPresident]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // Read logged-in user from localStorage (set by their login system)
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const canCreateConseil = hasRole(currentUser, "admin") || hasRole(currentUser, "president_conseil");
  const canCreateDossier = canCreateConseil || hasRole(currentUser, "enseignant");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, dRes, iRes, decRes] = await Promise.all([
        getConseils(),
        getDossiers(),
        getInfractions(),
        getDecisions(),
      ]);

      const normalizedConseils = (cRes.data?.data || cRes.data || []).map(normalizeConseil);
      setConseils(normalizedConseils);

      const allMembres = normalizedConseils.flatMap(c =>
        (c.membres || []).map(m => ({ ...m, conseil_id: m.conseilId ?? c.id }))
      );
      setMembres(allMembres);

      setDossiers((dRes.data?.data || dRes.data || []).map(normalizeDossier));
      setInfractions(iRes.data?.data || iRes.data || []);
      setDecisions((decRes.data?.data || decRes.data || []).map(d => ({
        ...d,
        niveau_sanction: d.niveauSanction ?? d.niveau_sanction,
      })));

      // Enseignants + etudiants — optional, from other groups' endpoints
      const [ensRes, etRes] = await Promise.allSettled([
        api.get("/enseignants"),
        api.get("/etudiants"),
      ]);

      const ensRaw = ensRes.status === "fulfilled" ? (ensRes.value.data?.data || ensRes.value.data || []) : [];
      const etRaw  = etRes.status  === "fulfilled" ? (etRes.value.data?.data  || etRes.value.data  || []) : [];

      const ens = ensRaw.map(normalizeEnseignant);
      setEnseignants(ens);
      setEtudiants(etRaw);

      const presEns = ens.find(e => (e.userId ?? e.user_id) === currentUser.id) || ens[0] || PRESIDENT;
      setPresident(presEns);
      PRESIDENT = presEns;

    } catch (err) {
      console.error("Erreur chargement:", err);
      if (err.code === "ERR_NETWORK" || err.message?.includes("Network Error")) {
        setError("Impossible de contacter le serveur.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleViewConseil  = id => { setViewConseilId(id); setScreen("conseil-detail"); };
  const handleConseilCreated = () => loadAll();
  const handleFinalize       = () => loadAll();
  const getMembres = (conseil_id) => membres.filter(m => m.conseil_id === conseil_id);
  const currentConseil = conseils.find(c => c.id === viewConseilId);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      minHeight:"100vh", background:"#F8FAFC", fontFamily:"'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ textAlign:"center", color:"#64748B" }}>
        <div style={{ fontSize:40, marginBottom:16 }}>⚖</div>
        <div style={{ fontSize:16, fontWeight:600 }}>Chargement des données…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      minHeight:"100vh", background:"#F8FAFC", fontFamily:"'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ textAlign:"center", maxWidth:420 }}>
        <div style={{ fontSize:40, marginBottom:16 }}>⚠</div>
        <div style={{ fontSize:15, fontWeight:600, color:"#DC2626", marginBottom:12 }}>{error}</div>
        <button onClick={loadAll} style={{ padding:"10px 24px", background:"#1D4ED8",
          color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:14 }}>
          Réessayer
        </button>
      </div>
    </div>
  );

  const renderScreen = () => {
    if (screen === "conseil-detail" && currentConseil)
      return <ConseilDetail
        conseil={currentConseil} dossiers={dossiers}
        decisions={decisions} getMembres={getMembres}
        onBack={() => setScreen("archives")} onFinalize={handleFinalize}
      />;
    switch (screen) {
      case "dashboard":
        return <Dashboard
          dossiers={dossiers} conseils={conseils}
          enseignants={enseignants} etudiants={etudiants} president={president}
          onNav={setScreen} onViewConseil={handleViewConseil}
          onConseilCreated={handleConseilCreated} canCreateConseil={canCreateConseil}
        />;
      case "dossiers":
        return <DossiersList
          dossiers={dossiers} conseils={conseils} membres={membres} onNav={setScreen}
          canCreateDossier={canCreateDossier} etudiants={etudiants} infractions={infractions}
          onCreated={handleConseilCreated}
        />;
      case "conseils":
        return <ConseilsList
          conseils={conseils} dossiers={dossiers} membres={membres}
          enseignants={enseignants} etudiants={etudiants} president={president}
          onViewConseil={handleViewConseil} onConseilCreated={handleConseilCreated}
          canCreateConseil={canCreateConseil}
        />;
      case "infractions":
        return <InfractionsList infractions={infractions} decisions={decisions} />;
      case "archives":
        return <Archives conseils={conseils} dossiers={dossiers} membres={membres} onViewConseil={handleViewConseil} />;
      default: return null;
    }
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#F8FAFC",
      fontFamily:"'Segoe UI', system-ui, sans-serif" }}>
      <Sidebar active={screen} onNav={setScreen} user={currentUser} />
      <main style={{ flex:1, padding:"32px 36px", overflowY:"auto" }}>{renderScreen()}</main>
    </div>
  );
}
