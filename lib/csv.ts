export function downloadCsv(filename: string, rows: Array<Record<string, string>>) {
  const headers = Object.keys(rows[0] || {})
  if (headers.length === 0) return
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => cell(row[header] || "")).join(",")),
  ]
  const file = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
