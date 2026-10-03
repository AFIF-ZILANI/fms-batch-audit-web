export const LAST_EXPORT_KEY = "lastExportAt"

export function getLastExport(): Date | null {
  try {
    const v = localStorage.getItem(LAST_EXPORT_KEY)
    const d = v ? new Date(v) : null
    return d && !Number.isNaN(+d) ? d : null
  } catch {
    return null
  }
}

export function setLastExport() {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString())
  } catch {
    // storage blocked: the reminder just keeps showing
  }
}

/** Whole days since the last export, or null if never exported. Home shows its reminder when null or > 7. */
export function lastExportDaysAgo(): number | null {
  const d = getLastExport()
  return d ? Math.floor((Date.now() - +d) / 86_400_000) : null
}
