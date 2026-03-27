import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProductWizard from '../components/ProductWizard'
import { exportToExcel, getDateStr } from '../lib/exportExcel'

const EXPORT_COLUMNS = [
  { header: '商品コード',   key: '商品コード',   type: 'string' },
  { header: '商品名',       key: '商品名',       type: 'string' },
  { header: '最新総原価',   key: '最新総原価',   type: 'number' },
  { header: 'ポジション',   key: 'ポジション',   type: 'string' },
  { header: '原価コード',   key: '原価コード',   type: 'string' },
  { header: '本体価格',     key: '本体価格',     type: 'number' },
  { header: '原価率',       key: '原価率',       type: 'number' },
]

export default function Products() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [positions, setPositions] = useState([])
  const [showWizard, setShowWizard] = useState(false)

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('T_商品マスタ').select('*').order('商品コード')
    const list = data || []
    setRows(list)
    const pos = [...new Set(list.map((r) => r['ポジション']).filter(Boolean))].sort()
    setPositions(pos)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const filtered = rows.filter((r) => {
    const matchSearch =
      !search ||
      (r['商品名'] || '').includes(search) ||
      (r['商品コード'] || '').includes(search)
    const matchPos = !positionFilter || r['ポジション'] === positionFilter
    return matchSearch && matchPos
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">商品管理</h2>
        <div className="flex gap-2">
          <button
            onClick={() => exportToExcel({ filename: `商品マスタ_${getDateStr()}.xlsx`, columns: EXPORT_COLUMNS, data: filtered })}
            className="bg-green-600 text-white px-4 py-2.5 rounded text-sm hover:bg-green-700 min-h-[44px]"
          >
            Excelエクスポート
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="bg-blue-600 text-white px-4 py-2.5 rounded text-sm hover:bg-blue-700 min-h-[44px]"
          >
            ＋ 新規登録
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="商品名・商品コードで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2.5 text-base md:text-sm w-full sm:w-72"
        />
        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2.5 text-base md:text-sm"
        >
          <option value="">全ポジション</option>
          {positions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {(search || positionFilter) && (
          <button
            onClick={() => { setSearch(''); setPositionFilter('') }}
            className="text-sm text-gray-500 hover:text-gray-700 underline py-2 min-h-[44px]"
          >
            クリア
          </button>
        )}
        <span className="text-sm text-gray-500 self-center">{filtered.length} 件</span>
      </div>

      {showWizard && (
        <ProductWizard
          onClose={() => setShowWizard(false)}
          onSaved={() => { setShowWizard(false); fetchData() }}
        />
      )}

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <>
          {/* デスクトップ テーブル */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  {['商品コード', '商品名', 'ポジション', '最新総原価', '本体価格', '原価率'].map((h) => (
                    <th key={h} className="border border-gray-200 px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row['商品コード']} className="bg-white hover:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">{row['商品コード']}</td>
                    <td className="border border-gray-200 px-3 py-2">
                      <Link to={`/products/${encodeURIComponent(row['商品コード'])}`} className="text-blue-600 hover:underline font-medium">
                        {row['商品名']}
                      </Link>
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      {row['ポジション'] && (
                        <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{row['ポジション']}</span>
                      )}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-right font-medium">
                      ¥{Number(row['最新総原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-right">
                      {row['本体価格'] ? `¥${Number(row['本体価格']).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-right">
                      {row['原価率']
                        ? <span className={Number(row['原価率']) > 0.5 ? 'text-red-600 font-semibold' : ''}>
                            {(Number(row['原価率']) * 100).toFixed(1)}%
                          </span>
                        : '-'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      {rows.length === 0 ? 'データがありません' : '条件に一致する商品がありません'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* モバイル カード */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 && (
              <p className="text-center py-8 text-gray-400">
                {rows.length === 0 ? 'データがありません' : '条件に一致する商品がありません'}
              </p>
            )}
            {filtered.map((row) => (
              <div key={row['商品コード']} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/products/${encodeURIComponent(row['商品コード'])}`}
                      className="text-blue-600 font-semibold text-base block truncate"
                    >
                      {row['商品名']}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">{row['商品コード']}</p>
                  </div>
                  {row['ポジション'] && (
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full ml-2 shrink-0">
                      {row['ポジション']}
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500">最新総原価</dt>
                    <dd className="font-bold text-gray-800">¥{Number(row['最新総原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">本体価格</dt>
                    <dd>{row['本体価格'] ? `¥${Number(row['本体価格']).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">原価率</dt>
                    <dd className={row['原価率'] && Number(row['原価率']) > 0.5 ? 'text-red-600 font-semibold' : ''}>
                      {row['原価率'] ? `${(Number(row['原価率']) * 100).toFixed(1)}%` : '-'}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
