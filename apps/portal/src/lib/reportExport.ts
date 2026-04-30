export const MAX_DETAIL_EXPORT_ROWS = 5000
export const MAX_SUMMARY_EXPORT_ROWS = 20000
export const HOUSE_OPTIONS = [
  'House of Abū Bakr',
  'House of Khadījah',
  'House of ʿUmar',
  'House of ʿĀʾishah',
] as const

export const HOUSE_LOGOS: Record<string, string> = {
  'House of Abū Bakr': '/House of Abū Bakr.png',
  'House of Khadījah': '/House of Khadījah.png',
  'House of ʿUmar': '/House of ʿUmar.png',
  'House of ʿĀʾishah': '/House of ʿĀʾishah.png',
}

export class ReportExportError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ReportExportError'
    this.status = status
  }
}

export class OversizedReportError extends ReportExportError {
  constructor(message = 'This export is too large. Narrow the date range or choose a smaller scope.') {
    super(message, 413)
    this.name = 'OversizedReportError'
  }
}

type SummaryCard = {
  label: string
  value: string | number
}

type ChartDatum = {
  label: string
  value: number
}

type PrintableChart =
  | {
      kind: 'bar'
      title: string
      data: ChartDatum[]
    }
  | {
      kind: 'line'
      title: string
      data: ChartDatum[]
    }

type PrintableReportOptions = {
  title: string
  subtitle: string
  crestUrl: string
  brandLine?: string
  headers?: string[]
  rows?: (string | number)[][]
  variant?: 'default' | 'student'
  summaryCards?: SummaryCard[]
  paragraphs?: string[]
  charts?: PrintableChart[]
  heroImageUrl?: string
  heroImageAlt?: string
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n')
}

export function sanitizeFilenameSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'report'
}

function buildBarChartHtml(title: string, data: ChartDatum[]): string {
  const safeData = data.slice(0, 12)
  const width = 480
  const height = 200
  const padding = 28
  const maxValue = Math.max(1, ...safeData.map((item) => item.value))
  const barHeight = 18
  const gap = 8
  const chartHeight = safeData.length * (barHeight + gap)
  const viewHeight = Math.max(height, chartHeight + padding * 2)
  const valueOffset = 56

  const bars = safeData
    .map((item, index) => {
      const barWidth = Math.round((item.value / maxValue) * (width - 160 - valueOffset))
      const y = padding + index * (barHeight + gap)
      return `
        <text x="0" y="${y + 13}" font-size="11" fill="#4a3b1a">${escapeHtml(item.label)}</text>
        <rect x="140" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="#B8860B"></rect>
        <text x="${140 + barWidth + 6}" y="${y + 13}" font-size="11" fill="#4a3b1a">${escapeHtml(item.value.toLocaleString())}</text>
      `
    })
    .join('')

  return `
    <div class="chart-card">
      <div class="chart-title">${escapeHtml(title)}</div>
      <svg width="${width}" height="${viewHeight}" viewBox="0 0 ${width} ${viewHeight}">
        ${bars}
      </svg>
    </div>
  `
}

function buildLineChartHtml(title: string, data: ChartDatum[]): string {
  const safeData = data.slice(0, 12)
  const width = 420
  const height = 200
  const padding = 24
  const maxValue = Math.max(1, ...safeData.map((item) => item.value))
  const stepX = safeData.length > 1 ? (width - padding * 2) / (safeData.length - 1) : 0
  const points = safeData
    .map((item, index) => {
      const x = padding + index * stepX
      const y = height - padding - (item.value / maxValue) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')

  const circles = points
    .split(' ')
    .filter(Boolean)
    .map((point) => {
      const [x, y] = point.split(',')
      return `<circle cx="${x}" cy="${y}" r="3" fill="#B8860B" />`
    })
    .join('')

  const labels = safeData
    .map((item, index) => {
      const x = padding + index * stepX
      return `<text x="${x}" y="${height - 6}" text-anchor="middle" font-size="10" fill="#6b5b3a">${escapeHtml(item.label)}</text>`
    })
    .join('')

  return `
    <div class="chart-card">
      <div class="chart-title">${escapeHtml(title)}</div>
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <polyline fill="none" stroke="#6b4a1a" stroke-width="2" points="${points}" />
        ${circles}
        ${labels}
      </svg>
    </div>
  `
}

export function buildPrintableReportHtml({
  title,
  subtitle,
  crestUrl,
  brandLine = 'League of Champions',
  headers = [],
  rows = [],
  variant = 'default',
  summaryCards = [],
  paragraphs = [],
  charts = [],
  heroImageUrl,
  heroImageAlt,
}: PrintableReportOptions): string {
  const safeTitle = escapeHtml(title)
  const safeSubtitle = escapeHtml(subtitle)
  const safeCrestUrl = escapeHtml(crestUrl)
  const safeBrandLine = escapeHtml(brandLine)
  const safeHeroUrl = heroImageUrl ? escapeHtml(heroImageUrl) : ''
  const safeHeroAlt = escapeHtml(heroImageAlt || '')

  const cardsHtml = summaryCards.length > 0
    ? `
      <div class="summary-grid">
        ${summaryCards
          .map(
            (card) => `
              <div class="summary-card">
                <div class="summary-label">${escapeHtml(card.label)}</div>
                <div class="summary-value">${escapeHtml(card.value)}</div>
              </div>
            `
          )
          .join('')}
      </div>
    `
    : ''

  const paragraphsHtml = paragraphs.length > 0
    ? `
      <div class="paragraphs">
        ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
      </div>
    `
    : ''

  const chartsHtml = charts.length > 0
    ? `
      <div class="charts">
        ${charts
          .map((chart) => (chart.kind === 'bar'
            ? buildBarChartHtml(chart.title, chart.data)
            : buildLineChartHtml(chart.title, chart.data)))
          .join('')}
      </div>
    `
    : ''

  const heroHtml = safeHeroUrl
    ? `
      <div class="hero">
        <img class="hero-image" src="${safeHeroUrl}" alt="${safeHeroAlt}" />
      </div>
    `
    : ''

  const tableHtml = headers.length > 0
    ? `
      <div class="divider"></div>
      <table>
        <thead>
          <tr>
            ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    `
    : ''

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${safeTitle}</title>
        <style>
          body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; padding: 24px; background: #f7f4ee; }
          .report { background: #fffdf9; border: 1px solid #e7dfcf; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(20, 14, 4, 0.06); }
          .header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
          .crest { width: 64px; height: 64px; object-fit: contain; }
          .brand { font-size: 12px; letter-spacing: 0.12em; color: #7a6a43; }
          .title { font-size: 20px; margin: 4px 0 0; }
          .subtitle { font-size: 12px; color: #6b5b3a; margin: 6px 0 16px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
          .summary-card { border: 1px solid #eadfca; background: #fbf8f1; border-radius: 12px; padding: 10px 12px; }
          .summary-label { font-size: 10px; letter-spacing: 0.12em; color: #8a7a55; margin-bottom: 4px; }
          .summary-value { font-size: 16px; font-weight: 700; color: #2b1d0a; word-break: break-word; }
          .paragraphs { margin: 10px 0 18px; color: #3e3018; font-size: 12px; line-height: 1.55; }
          .paragraphs p { margin: 0 0 10px; }
          .divider { height: 1px; background: #eadfca; margin: 14px 0; }
          .charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 16px 0; }
          .chart-card { border: 1px solid #eadfca; border-radius: 12px; padding: 12px; background: #fffaf0; }
          .chart-title { font-size: 11px; letter-spacing: 0.12em; color: #7a6a43; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #e7dfcf; padding: 7px 8px; text-align: left; vertical-align: top; }
          th { background: #f3ead6; color: #5b4a22; letter-spacing: 0.08em; font-size: 10px; }
          tr:nth-child(even) td { background: #fbf8f1; }
          .report-card .title { font-size: 22px; }
          .report-card .crest { width: 72px; height: 72px; }
          .hero { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
          .hero-image { width: 56px; height: 56px; object-fit: contain; }
          @media print {
            body { padding: 0; background: white; }
            .report { box-shadow: none; border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="report ${variant === 'student' ? 'report-card' : ''}">
          <div class="header">
              <img class="crest" src="${safeCrestUrl}" alt="School crest" />
            <div>
              <div class="brand">${safeBrandLine}</div>
              <div class="title">${safeTitle}</div>
            </div>
          </div>
          <div class="subtitle">${safeSubtitle}</div>
          ${heroHtml}
          ${cardsHtml}
          ${paragraphsHtml}
          ${chartsHtml}
          ${tableHtml}
        </div>
        <script>
          window.addEventListener('load', () => {
            window.setTimeout(() => window.print(), 120);
          });
        </script>
      </body>
    </html>
  `
}
