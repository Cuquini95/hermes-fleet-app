# Design Spec: Gastos PDF Report

**Date:** 2026-04-10
**Feature:** PDF export of monthly expense (Gastos) reports, filterable by unit
**Status:** Approved design — ready for implementation plan

## Goal

Give managers a one-tap way to turn the Gastos view into a shareable PDF report
they can download, print, or share via WhatsApp/Email. The report is a one-page
(sometimes multi-page) executive summary plus per-unit detail tables. Selection
and period are driven directly from the existing Gastos page so the PDF reflects
exactly what the user is looking at.

## User story

> As a gerente/supervisor/coordinador, I want to export the gastos of a given
> month, for one, some, or all of my units, as a PDF I can download, print, or
> share — so I can send the monthly expense report to accounting or the owner
> without copy-pasting from Google Sheets.

## Scope

### In scope

- Month selector in the Gastos header (navigate to any past month, not future)
- Tap-to-select/deselect units on the existing heatmap
- "Generar PDF" CTA that routes to a preview screen
- Client-side PDF generation via `jspdf` + `jspdf-autotable`
- Preview screen with iframe preview + 3 actions: Descargar, Imprimir, Compartir
- Web Share API integration (`navigator.share` with file) with fallback
- PDF layout "version B": cover/header + KPI hero + type breakdown + unit ranking
  + per-unit detail tables with date/proveedor/tipo/folio/total

### Out of scope (explicit)

- Line items (parts/quantities) in the PDF detail rows — deferred to "version C"
- Receipt image thumbnails in the PDF — deferred to "version D"
- Custom date ranges (start/end) — only whole months
- Multi-month reports — one month per PDF
- Server-side generation — all client-side
- Email-sending the report from the app — relies on Web Share API / OS share sheet
- Edit permissions for gastos inside the preview screen

## Approach

Client-side only. The Gastos page stays the single source of truth for the
filtered dataset. When the user taps "Generar PDF", the filtered data is passed
via React Router location state to a preview page that generates the PDF once,
caches the `Blob`, and exposes three actions on top of it.

### Why client-side + jsPDF

- Plays cleanly with the Web Share API (needs a real `File` object from a `Blob`)
- No round-trip to the VPS; works offline once the app is loaded
- `jspdf-autotable` handles per-unit detail tables with minimal code
- Bundle cost (~200 KB) is acceptable for the value delivered
- Keeps the VPS FastAPI small and avoids new Python dependencies

Alternatives considered:

- `@react-pdf/renderer`: better DX but ~500 KB bundle cost, overkill for this scope
- Browser `window.print()` + print CSS: no file handle, breaks the share sheet flow
- Server-side Python: requires network, slower, needs VPS work

## Architecture

### New files

| File                                | Responsibility                                                |
| ----------------------------------- | ------------------------------------------------------------- |
| `src/lib/gastos-pdf.ts`             | Pure function `generateGastosPDF(data): Blob`. No UI coupling. |
| `src/pages/GastosReportePage.tsx`   | Preview screen + 3 action buttons                             |
| `src/components/MonthSelector.tsx`  | Reusable `◀ Abril 2026 ▶` navigator                          |

### Modified files

| File                          | Change                                                            |
| ----------------------------- | ----------------------------------------------------------------- |
| `src/pages/GastosPage.tsx`    | Add `MonthSelector`, make heatmap tiles selectable, add CTA       |
| Router entrypoint             | Add `/gastos/reporte` route                                       |
| `package.json`                | Add `jspdf` and `jspdf-autotable`                                 |

### Data contract between pages

```ts
export interface GastoReportData {
  period: { year: number; month: number; label: string }; // month is 1-12
  generatedAt: string;                                     // dd/MM/yyyy HH:mm
  generatedBy: string;                                     // userName
  selectedUnits: string[];                                 // e.g. ['CV102', 'CV108']
  gastos: GastoCompra[];                                   // already filtered
  totals: {
    total: number;
    count: number;
    averagePerRecord: number;
  };
  byType: Array<{
    tipo: GastoTipo;
    total: number;
    count: number;
    pct: number; // 0-100
  }>;
  byUnit: Array<{
    unidad: string;
    total: number;
    count: number;
    gastos: GastoCompra[]; // just this unit's gastos, date-ordered
  }>;
}
```

`GastosPage` computes this object when the user taps "Generar PDF" and passes it
via `navigate('/gastos/reporte', { state: { reportData } })`. The preview page
reads it via `useLocation().state` and renders. Direct navigation to
`/gastos/reporte` without state redirects back to `/gastos`.

## Data flow

```
GastosPage
  ├── selectedMonth state (default: current month)
  │     └── MonthSelector buttons mutate it
  ├── selectedUnits: Set<string> (default: all units that have gastos this month)
  │     └── heatmap cells toggle membership on tap
  ├── monthly: GastoCompra[] = gastos filtered by selectedMonth
  ├── onClick "Generar PDF":
  │     ├── build GastoReportData from monthly + selectedUnits
  │     └── navigate('/gastos/reporte', { state: { reportData } })
  │
GastosReportePage
  ├── const reportData = useLocation().state?.reportData
  ├── if (!reportData) → navigate('/gastos')
  ├── useMemo:
  │     const pdfBlob = generateGastosPDF(reportData)
  │     const blobUrl = URL.createObjectURL(pdfBlob)
  ├── render <iframe src={blobUrl} />
  └── 3 actions:
        ├── Descargar  → <a href={blobUrl} download={filename}>
        ├── Imprimir   → iframe.contentWindow.print()
        └── Compartir  → navigator.share({ files: [new File([pdfBlob], filename)] })
                         fallback on unsupported: trigger Descargar
```

## PDF layout (version B)

Single PDF document, A4 portrait, generated with jsPDF at 72 DPI.

### Header (every page)

- Left: GTP logo block + "Hermes Fleet" subtitle + "GTP Transportes" brand name
- Right: "Reporte de Gastos" title, "Generado {fecha} · por {userName}" subtitle,
  period badge (amber) "Abril 2026 · N unidades"
- Separator line in navy (#162252)

### Hero KPI card

- Full-width gradient block (navy to blue)
- Left: "Total del período" label, big currency value, "N registros · M unidades"
- Right: "Promedio / registro" with its value

### Section: Gasto por tipo

- 4-column grid: Combustible, Refacciones, Servicio, Otros
- Each card: color-coded left border, amount, percentage + count

### Section: Detalle por unidad

One block per unit in the selected set, sorted by total descending:

- Unit header strip: unit ID (bold), meta (`N gastos · <type from equipment list>`),
  total (green, right-aligned)
- Table with columns: Fecha | Proveedor | Tipo (chip) | Folio | Total (right-aligned)
- Rows sorted by date ascending
- Zebra striping for readability

### Footer (every page)

- Left: "Hermes Fleet · Reporte automático"
- Right: "Página N de M"

### Filename pattern

- Single unit: `Gastos-{Mes}-{Año}-{UnitID}.pdf` → `Gastos-Abril-2026-CV102.pdf`
- Multiple units: `Gastos-{Mes}-{Año}.pdf` → `Gastos-Abril-2026.pdf`
- Month names in Spanish, no accents in filename (Abril, not Abríl)

## UI changes on GastosPage

### Header (changed)

Current:

```
Gastos
Abril De 2026              [refresh] [+ Nuevo]
```

New:

```
Gastos
[◀] Abril 2026 [▶]         [refresh] [+ Nuevo]
                                     [Generar PDF]  ← new CTA
```

The CTA only appears if the user has a role in `canCreate` and there is at least
one gasto in the selected month AND at least one unit is selected.

### Heatmap (changed)

Each tile gains:

- A subtle amber ring (`ring-2 ring-amber`) when selected
- Tap toggles selection
- A small "Todas / Ninguna" pill above the grid to bulk-select

Default state on page load: all visible units are selected.

### Empty states

- No gastos in month → existing empty state, CTA hidden
- 0 units selected → CTA disabled with helper text "Selecciona al menos 1 unidad"

## Error handling

| Scenario                                | Behavior                                                           |
| --------------------------------------- | ------------------------------------------------------------------ |
| 0 units selected                        | CTA disabled + helper text                                         |
| Selected month has no gastos            | Entire Resumen tab shows empty state, CTA hidden                   |
| PDF generation throws                   | Preview page shows error state with Retry button                   |
| Web Share API missing                   | Compartir button falls back to Descargar + toast explaining        |
| Share files permission denied           | Same fallback as above                                             |
| Iframe blob blocked by CSP              | Preview page hides iframe, shows text summary + action buttons     |
| Direct nav to `/gastos/reporte`         | Redirect to `/gastos`                                              |
| Very large month (>500 gastos)          | Auto-paginate via `autoTable`'s `startY` continuation              |

## Testing

### Unit tests

- `gastos-pdf.ts`
  - Given a minimal dataset, output is a non-empty `Blob`
  - Blob's first 5 bytes are `%PDF-` (valid PDF magic number)
  - Page count is at least 1
  - Total in header matches `sum(gastos.total)`
  - Each selected unit has its own detail section
- `MonthSelector`
  - Clicking `▶` when on current month is a no-op (disabled state)
  - Clicking `◀` navigates to previous month
  - Displays month label in Spanish

### Smoke tests

- `GastosReportePage` renders without crash given valid `reportData`
- `GastosReportePage` redirects when `location.state` is missing
- `GastosPage` CTA disabled when `selectedUnits.size === 0`

### Manual QA (preview server)

- Change month with selector → summary + heatmap update
- Tap heatmap tiles → selection toggles visually
- Tap "Generar PDF" → navigates to preview
- Preview iframe shows the PDF
- Descargar → file lands in Downloads with correct filename
- Imprimir → native print dialog opens
- Compartir (on mobile) → share sheet opens with file attached
- Compartir (on desktop Safari) → falls back to download + toast
- Back navigation preserves month + selection state

## Defaults

- Heatmap default selection: all visible units selected
- Access: `canCreate` roles (gerencia / supervisor / jefe_taller / coordinador)
- Filename: `Gastos-{Mes}-{Año}.pdf` or `Gastos-{Mes}-{Año}-{UnitID}.pdf`
- Month selector lower bound: unrestricted past, no future navigation

## Open questions

None. All clarifying questions resolved during brainstorming.

## Non-goals for this iteration

- Multi-language PDF (Spanish only)
- Custom branding / logo upload
- Email-send from app
- Export to Excel
- Historical price catalog in the PDF
