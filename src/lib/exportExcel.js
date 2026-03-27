import XLSXStyle from 'xlsx-js-style'

const HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } },
  border: {
    top:    { style: 'thin', color: { rgb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
    left:   { style: 'thin', color: { rgb: 'D1D5DB' } },
    right:  { style: 'thin', color: { rgb: 'D1D5DB' } },
  },
}

export function getDateStr() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/**
 * @param {string} filename - e.g. '原材料マスタ_20260327.xlsx'
 * @param {{ header: string, key: string, type?: 'number'|'string' }[]} columns
 * @param {object[]} data - array of row objects
 */
export function exportToExcel({ filename, columns, data }) {
  const headers = columns.map((c) => c.header)

  const dataRows = data.map((row) =>
    columns.map((c) => {
      const v = row[c.key]
      if (c.type === 'number') return v == null ? null : Number(v)
      return v == null ? '' : String(v)
    })
  )

  const wb = XLSXStyle.utils.book_new()
  const ws = XLSXStyle.utils.aoa_to_sheet([headers, ...dataRows])

  // Apply header styles
  headers.forEach((_, ci) => {
    const ref = XLSXStyle.utils.encode_cell({ r: 0, c: ci })
    if (ws[ref]) ws[ref].s = HEADER_STYLE
  })

  // Auto column widths
  ws['!cols'] = columns.map((c, ci) => ({
    wch: Math.max(
      c.header.length * 2,
      ...dataRows.map((r) => String(r[ci] ?? '').length)
    ),
  }))

  XLSXStyle.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSXStyle.writeFile(wb, filename)
}
