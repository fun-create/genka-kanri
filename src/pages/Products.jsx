import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ProductWizard from '../components/ProductWizard'

export default function Products() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [positions, setPositions] = useState([])
  const [showWizard, setShowWizard] = useState(false)

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('T_商品マスタ')
      .select('*')
      .order('商品コード')
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
        <button
          onClick={() => setShowWizard(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          ＋ 新規登録
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="商品名・商品コードで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-72"
        />
        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          <option value="">全ポジション</option>
          {positions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {(search || positionFilter) && (
          <button
            onClick={() => { setSearch(''); setPositionFilter('') }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            絞り込みクリア
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
        <div className="overflow-x-auto">
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
                    <Link
                      to={`/products/${encodeURIComponent(row['商品コード'])}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {row['商品名']}
                    </Link>
                  </td>
                  <td className="border border-gray-200 px-3 py-2">
                    <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                      {row['ポジション']}
                    </span>
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-right font-medium">
                    ¥{Number(row['最新総原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-right">
                    {row['本体価格'] ? `¥${Number(row['本体価格']).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 text-right">
                    {row['原価率']
                      ? <span className={`${Number(row['原価率']) > 0.5 ? 'text-red-600 font-semibold' : ''}`}>
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
      )}
    </div>
  )
}
