# Styling Audit Report — Frontend Pages vs Design Rules

**Generated:** March 31, 2026  
**Audited by:** Copilot  
**Scope:** Frontend pages integrated from other groups

---

## Summary

Multiple pages violate the design system defined in `rules.md`. Issues range from incorrect border radius values, disallowed background colors, and deprecated styling patterns. Below is a detailed breakdown with specific violations and recommendations.

---

## Critical Issues

### 1. **Incorrect Border Radius** (`rounded-xl` instead of `rounded-lg` or `rounded-md`)

**Rule Violation:** Per `rules.md`, card radius should be `rounded-lg` (8px), inputs should be `rounded-md` (6px), not `rounded-xl` (16px).

**Affected Pages:**

| File | Violations | Fix |
|------|------------|-----|
| `StudentDashboard.jsx` | Line 379: `rounded-xl` on input button | Change to `rounded-md` |
| `RegisterPage.jsx` | Line 187: `rounded-xl` on card | Change to `rounded-lg` |
| `NotificationsPage.jsx` | Lines 125, 137: `rounded-xl` on buttons | Change to `rounded-md` |
| `MessagesPage.jsx` | Lines 224, 234, 254, 284, 293: `rounded-xl` on inputs/buttons | Change to `rounded-md` or `rounded-lg` per context |
| `DocumentsPage.jsx` | Line 99: `rounded-xl` on input | Change to `rounded-md` |
| `CaseDetailPage.jsx` | Lines 364, 422: `rounded-xl` on modal cards | Change to `rounded-lg` |
| `AIAssistantPage.jsx` | Line 66: `rounded-2xl` on button | Change to `rounded-md` |

**Example Fix:**
```jsx
// ❌ WRONG
<input className="rounded-xl border border-edge bg-canvas px-3 py-2" />

// ✅ CORRECT
<input className="rounded-md border border-edge bg-canvas px-3 py-2.5" />
```

---

### 2. **Disallowed Background Colors** (`bg-blue-50`, `bg-slate`, etc. instead of design tokens)

**Rule Violation:** Per `rules.md` → Avoid section: "random hex values — everything maps to a primitive" and "generic Tailwind grays — use token names".

**Affected Pages:**

| File | Issue | Fix |
|------|-------|-----|
| `SuperAdmin/Users.jsx` | Line 68: `bg-blue-50` + `border-blue-200` | Use design tokens for brand info state |
| `StudentDashboard.jsx` | Lines 22, 30, 213, 251: `bg-blue-50` repeated | Use `bg-brand-light` (from design system) or reserved color token |
| `StudentDashboard.jsx` | Lines 366, 379: `hover:bg-blue-50` | Use `hover:bg-surface-200` (inset well) or brand-light |
| `StudentDisciplinaryView.jsx` | Lines 34, 106, 167, 205: `bg-blue-50` + `dark:bg-blue-950/40` | Create a design token or use `bg-brand-light` |
| `SettingsPage.jsx` | Lines 162: `bg-blue-50` badge | Use `bg-brand-light` |

**Root Issue:** These pages use hardcoded Tailwind colors instead of design system tokens.

**Example Fix:**
```jsx
// ❌ WRONG (hardcoded Tailwind)
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">

// ✅ CORRECT (design tokens)
<div className="bg-brand-light border border-brand/20 rounded-lg p-4">
```

---

### 3. **Incorrect Border Radius on Large Elements** (`rounded-2xl` instead of `rounded-xl` or `rounded-lg`)

**Rule Violation:** Per `rules.md`, only modals use `rounded-xl` (12px). Cards use `rounded-lg` (8px). The scale is: inputs/buttons = `rounded-md` (6px), cards = `rounded-lg` (8px), modals = `rounded-xl` (12px).

**Affected Pages:**

| File | Line(s) | Element | Fix |
|------|---------|---------|-----|
| `SupportPage.jsx` | 6, 15, 24 | Cards | Change `rounded-2xl` to `rounded-lg` |
| `NotificationsPage.jsx` | 106 | Container | Change `rounded-2xl` to `rounded-lg` |
| `MessagesPage.jsx` | 324, 359 | Message bubbles | Change `rounded-2xl` to `rounded-lg` |
| `DocumentsPage.jsx` | 112, 139 | Cards | Change `rounded-2xl` to `rounded-lg` |
| `TeacherDashboard.jsx` | 59 | Alert box | Change `rounded-2xl` to `rounded-lg` |
| `AIAssistantPage.jsx` | 81, 88, 100, 106 | Chat bubbles & container | Change `rounded-2xl` to `rounded-lg` |

**Example Fix:**
```jsx
// ❌ WRONG
<div className="rounded-2xl border border-edge bg-surface p-6">

// ✅ CORRECT
<div className="rounded-lg border border-edge bg-surface p-6">
```

---

### 4. **Disallowed Input Background Colors** (`bg-canvas` instead of `bg-control-bg`)

**Rule Violation:** Per `rules.md` → Input pattern: "Background: `bg-control-bg` (inset, darker than surface)".

**Affected Pages:**

| File | Line(s) | Context | Fix |
|------|---------|---------|-----|
| `AdminAcademicAssignmentsPage.jsx` | Line 6 | Input class definition | Change `bg-canvas` to `bg-control-bg` |
| `StudentSpecialiteChoicePage.jsx` | 162 | Input field | Change `bg-canvas` to `bg-control-bg` |
| `StudentDashboard.jsx` | 379 | Input button | Change `bg-canvas` to `bg-surface` (secondary button) |
| `MessagesPage.jsx` | Multiple (247, 254, 274, 284) | Input fields | Change `bg-canvas` to `bg-control-bg` |
| `DocumentsPage.jsx` | 99 | Input field | Change `bg-canvas` to `bg-control-bg` |
| `AIAssistantPage.jsx` | 81, 88, 100, 106 | Input containers | Evaluate context—may need `bg-surface` or specific state color |

**Root Cause:** Pages confuse the global canvas background with the input background.

**Example Fix:**
```jsx
// ❌ WRONG
<input className="bg-canvas border border-edge px-3 py-2.5" />

// ✅ CORRECT
<input className="bg-control-bg border border-control-border px-3 py-2.5" />
```

---

### 5. **Semantic Color Misuse** (Using `bg-blue-50` / `border-blue-200` for non-error/warning/success states)

**Rule Violation:** Per `rules.md` → "Decorative color — color must mean something (brand, semantic, or emphasis)".

**Affected Pages:**

| File | Lines | Issue | Should Be |
|------|-------|-------|-----------|
| `StudentDisciplinaryView.jsx` | 34, 106, 167, 205 | `bg-blue-50 dark:bg-blue-950/40` info boxes | Use `bg-brand-light` or `bg-surface-200` |
| `StudentDashboard.jsx` | Multiple | `bg-blue-50` badge backgrounds | Use `bg-brand-light` |
| `SettingsPage.jsx` | 162 | `bg-blue-50` status badge | Use `bg-brand-light` |
| `SuperAdmin/Users.jsx` | 68 | `bg-blue-50` info box | Create proper semantic token or use `bg-brand-light` |

**Root Issue:** Hardcoded blue colors don't integrate with the design system's semantic meaning.

---

### 6. **Inconsistent Typography Usage**

**Rule Violation:** Per `rules.md` → "Size-only typography hierarchy — always combine size + weight + tracking".

**Issues Found:**

- Some pages mix `font-semibold` (600) with `text-sm` for subheadings (should be `text-base font-semibold`)
- Labels inconsistently use `font-medium` + `text-sm` (correct per rules)
- Captions missing `text-xs` or `tracking-wider` in some contexts

---

## Medium Priority Issues

### 7. **Mixed Shadow Patterns**

**Found:** Inconsistent use of shadows across similar elements.

- `SupportPage.jsx`: Uses `shadow-card` consistently ✅
- `MessagesPage.jsx`: Uses `shadow-sm` on some items (should standardize)
- `DocumentsPage.jsx`: Uses `shadow-sm` instead of `shadow-card`

**Fix:** Use `shadow-card` for all elevated cards, `shadow-soft` for hover states if needed.

---

### 8. **Placeholder & Focus States**

**Issue:** Some inputs missing proper focus styling.

- Missing `focus:ring-2 focus:ring-brand/30 focus:border-brand` patterns
- Placeholder text not using `text-ink-muted` consistently

---

## Low Priority Issues

### 9. **Spacing Consistency**

**Minor:** Some sections use `p-5` instead of the `4px`-aligned values (`p-6` = 24px, `p-4` = 16px).

- `StudentNotesPage.jsx` Line 49: `p-5` should be `p-6`
- A few cards use `p-4` where `p-6` is standard per card pattern

---

## Automated Fix Strategy

To systematically fix these issues:

1. **Global Input Classes**: Update all pages using `inputClass` variable to replace `bg-canvas` with `bg-control-bg`
2. **Border Radius Replacement**: 
   - `rounded-2xl` → `rounded-lg` (cards/containers)
   - `rounded-xl` → `rounded-md` (buttons) or `rounded-lg` (cards)
3. **Color Token Replacement**:
   - `bg-blue-50` → `bg-brand-light`
   - `bg-slate-*` → use design tokens
4. **Verification**: Cross-reference all buttons, inputs, cards against the patterns in `rules.md`

---

## Files to Fix (Priority Order)

**High Priority (Critical violations):**
1. `AdminAcademicAssignmentsPage.jsx` — Input class, border radius
2. `StudentDashboard.jsx` — Multiple bg-blue-50, rounded-xl, spacing
3. `MessagesPage.jsx` — Many rounded-xi violations, input bg colors
4. `DocumentsPage.jsx` — Border radius, input colors
5. `StudentDisciplinaryView.jsx` — bg-blue-50 semantic color issues
6. `AIAssistantPage.jsx` — rounded-2xl, bg colors

**Medium Priority:**
7. `RegisterPage.jsx` — Card border radius
8. `NotificationsPage.jsx` — Border radius, button styling
9. `CaseDetailPage.jsx` — Modal border radius
10. `SupportPage.jsx` — Border radius (minor)
11. `SettingsPage.jsx` — Color tokens
12. `SuperAdmin/Users.jsx` — Color semantics

---

## Design System Token Reference

**Border Radius:**
- Inputs, buttons: `rounded-md` (6px)
- Cards, panels: `rounded-lg` (8px)
- Modals, large containers: `rounded-xl` (12px)
- Avatars: `rounded-full`

**Background Colors:**
- Inputs: `bg-control-bg` (inset/darker)
- Input borders: `border-control-border`
- Cards: `bg-surface` (white/elevated)
- Global canvas: `bg-canvas` (page background, #f8f9fb)
- Inset wells: `bg-surface-200`
- Brand highlights: `bg-brand-light` (for info/active states)

**Shadows:**
- Cards: `shadow-card` (0 2px 8px...)
- Soft hover: `shadow-soft` (0 1px 3px...)
- Modals: `shadow-card` at elevation level 3

---

## Next Steps

1. ✅ **Review this report** with frontend team
2. 🔧 **Fix high-priority files** (start with AdminAcademicAssignmentsPage, StudentDashboard)
3. 📋 **Create a Tailwind config validator** to catch these at build time
4. 🧪 **Test responsive behavior** after fixes
5. 📐 **Consider documenting component patterns** (Button, Input, Card templates)

---

**Questions?** Reference `rules.md` for the authoritative design specifications.
