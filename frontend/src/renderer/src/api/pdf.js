// Thin wrapper around the Electron IPC bridge for PDF export.
//
// Used by every "Export PDF" button on the summary dialogs. The bridge calls
// webContents.printToPDF() on the renderer's own window — so whatever the user
// is currently looking at (with @media print rules applied) is what gets saved.
//
// Returns the saved file path on success, or null if the user cancelled the
// save dialog. Throws on actual errors so callers can surface them.

export async function exportPDF({ defaultFilename } = {}) {
  if (!window.electron?.exportPDF) {
    throw new Error('PDF export is only available in the desktop app.')
  }
  const result = await window.electron.exportPDF({ defaultFilename })
  if (result.canceled) return null
  if (!result.ok) throw new Error(result.error || 'PDF export failed')
  return result.path
}

// Build a sensible default filename for a date-ranged summary.
// `kind` is short identifier ("po-summary", "so-summary", "inventory-summary").
export function defaultPdfName(kind, range) {
  const today = new Date().toISOString().split('T')[0]
  if (range?.from && range?.to) return `${kind}_${range.from}_to_${range.to}.pdf`
  return `${kind}_${today}.pdf`
}
