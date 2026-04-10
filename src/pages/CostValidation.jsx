import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function StatusBadge({ status }) {
  if (status === '原価コード未設定') {
    return <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">原価コード未設定</span>
  }
  if (status === 'BOM未登録') {
    return <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">BOM未登録</span>
  }
  if (status === '差異あり') {
    return <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">差異あり</span>
  }
  return <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">正常</span>
}

function BomModal({ product, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      if (!product['原価コード']) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('T_原価計算明細')
        .select('*')
        .eq('受注ID', product['原価コード'])
        .order('作成日時')
      setRows(data || [])
      setLoading(false)
    }
    fetch()
  }, [product])

  const total = rows.reduce((sum, r) => sum + (Number(r['原価']) || 0), 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="font-bold text-gray-800 text-base">BOM明細</h3>
            <p className="text-xs text-gray-500 mt-0.5">{product['商品名']}（原価コード: {product['原価コード'] || '未設定'}）</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <p className="text-gray-500 text-sm">読み込み中...</p>
          ) : rows.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              {!product['原価コード'] ? '原価コードが未設定のためBOM明細を取得できません' : 'BOM明細がありません'}
            </p>
          ) : (
            <>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600">
                    {['明細区分', 'コード', '名称', '単価', '数量', '原価'].map((h) => (
                      <th key={h} className="border border-gray-200 px-2 py-2 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="bg-white hover:bg-gray-50">
                      <td className="border border-gray-200 px-2 py-1.5 text-xs text-gray-500">{r['明細区分']}</td>
                      <td className="border border-gray-200 px-2 py-1.5 text-xs text-gray-500">{r['コード']}</td>
                      <td className="border border-gray-200 px-2 py-1.5">{r['名称']}</td>
                      <td className="border border-gray-200 px-2 py-1.5 text-right">
                        {r['単価_snapshot'] != null ? `¥${Number(r['単価_snapshot']).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-right">{r['数量']}</td>
                      <td className="border border-gray-200 px-2 py-1.5 text-right font-medium">
                        ¥{Number(r['原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 font-bold">
                    <td colSpan={5} className="border border-gray-200 px-2 py-2 text-right text-sm">BOM合計</td>
                    <td className="border border-gray-200 px-2 py-2 text-right text-sm text-blue-700">
                      ¥{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
              {product['最新総原価'] && (
                <div className="mt-3 text-xs text-gray-500 text-right">
                  最新総原価: ¥{Number(product['最新総原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  　差異: {total > 0 && product['最新総原価'] > 0
                    ? `${(((total - product['最新総原価']) / product['最新総原価']) * 100).toFixed(1)}%`
                    : '-'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CostValidation() {
  const [products, setProducts] = useState([])
  const [bomCounts, setBomCounts] = useState({})
  const [bomTotals, setBomTotals] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'issues' | position value
  const [positions, setPositions] = useState([])
  const [modalProduct, setModalProduct] = useState(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const { data: productData } = await supabase
        .from('T_商品マスタ')
        .select('*')
        .order('商品コード')

      const list = productData || []
      setProducts(list)

      const pos = [...new Set(list.map((r) => r['ポジション']).filter(Boolean))].sort()
      setPositions(pos)

      // BOM件数と合計を原価コード単位で取得
      const { data: bomData } = await supabase
        .from('T_原価計算明細')
        .select('受注ID, 原価')

      const counts = {}
      const totals = {}
      for (const row of bomData || []) {
        const key = row['受注ID']
        counts[key] = (counts[key] || 0) + 1
        totals[key] = (totals[key] || 0) + (Number(row['原価']) || 0)
      }
      setBomCounts(counts)
      setBomTotals(totals)

      setLoading(false)
    }
    fetchData()
  }, [])

  function getStatus(product) {
    if (!product['原価コード']) return '原価コード未設定'
    const count = bomCounts[product['原価コード']] || 0
    if (count === 0) return 'BOM未登録'
    const bomTotal = bomTotals[product['原価コード']] || 0
    const latestCost = Number(product['最新総原価']) || 0
    if (latestCost > 0 && bomTotal > 0) {
      const diff = Math.abs((bomTotal - latestCost) / latestCost)
      if (diff > 0.1) return '差異あり'
    }
    return '正常'
  }

  const productsWithStatus = products.map((p) => ({
    ...p,
    _status: getStatus(p),
    _bomCount: p['原価コード'] ? (bomCounts[p['原価コード']] || 0) : 0,
  }))

  const filtered = productsWithStatus.filter((p) => {
    if (filter === 'issues') return p._status === '原価コード未設定' || p._status === 'BOM未登録' || p._status === '差異あり'
    if (filter !== 'all') return p['ポジション'] === filter
    return true
  })

  const totalCount = products.length
  const noCodeCount = productsWithStatus.filter((p) => p._status === '原価コード未設定').length
  const noBomCount = productsWithStatus.filter((p) => p._status === 'BOM未登録').length
  const diffCount = productsWithStatus.filter((p) => p._status === '差異あり').length

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">原価検証</h2>
        <p className="text-sm text-gray-500 mt-0.5">商品ごとの原価設定・BOM登録状況を確認します</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500">総商品数</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{loading ? '…' : totalCount}</p>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-4">
          <p className="text-xs text-red-500">BOM明細0件の商品</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{loading ? '…' : noBomCount}</p>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-4">
          <p className="text-xs text-red-500">原価コード未設定</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{loading ? '…' : noCodeCount}</p>
        </div>
        <div className="bg-white border border-yellow-200 rounded-lg p-4">
          <p className="text-xs text-yellow-600">原価差異10%超</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{loading ? '…' : diffCount}</p>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded text-sm min-h-[36px] border transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          全件
        </button>
        <button
          onClick={() => setFilter('issues')}
          className={`px-3 py-1.5 rounded text-sm min-h-[36px] border transition-colors ${
            filter === 'issues'
              ? 'bg-orange-600 text-white border-orange-600'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          要対応のみ
        </button>
        {positions.map((pos) => (
          <button
            key={pos}
            onClick={() => setFilter(pos)}
            className={`px-3 py-1.5 rounded text-sm min-h-[36px] border transition-colors ${
              filter === pos
                ? 'bg-gray-700 text-white border-gray-700'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {pos}
          </button>
        ))}
        <span className="text-sm text-gray-400 self-center ml-1">{filtered.length} 件</span>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <>
          {/* デスクトップ テーブル */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  {['商品コード', '商品名', 'ポジション', '原価コード', '最新総原価', 'BOM明細件数', 'ステータス', ''].map((h) => (
                    <th key={h} className="border border-gray-200 px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row['商品コード']} className="bg-white hover:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">{row['商品コード']}</td>
                    <td className="border border-gray-200 px-3 py-2 font-medium">{row['商品名']}</td>
                    <td className="border border-gray-200 px-3 py-2">
                      {row['ポジション'] && (
                        <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{row['ポジション']}</span>
                      )}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-xs">
                      {row['原価コード'] || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-right">
                      {row['最新総原価']
                        ? `¥${Number(row['最新総原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-right">
                      {row['原価コード'] ? row._bomCount : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      <StatusBadge status={row._status} />
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-center">
                      <button
                        onClick={() => setModalProduct(row)}
                        className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1 rounded text-xs min-h-[32px]"
                      >
                        BOM確認
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      {products.length === 0 ? 'データがありません' : '条件に一致する商品がありません'}
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
                {products.length === 0 ? 'データがありません' : '条件に一致する商品がありません'}
              </p>
            )}
            {filtered.map((row) => (
              <div key={row['商品コード']} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-base truncate">{row['商品名']}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{row['商品コード']}</p>
                  </div>
                  <div className="ml-2 shrink-0">
                    <StatusBadge status={row._status} />
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm mb-3">
                  <div>
                    <dt className="text-xs text-gray-500">ポジション</dt>
                    <dd className="text-gray-700">{row['ポジション'] || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">最新総原価</dt>
                    <dd className="font-medium">
                      {row['最新総原価'] ? `¥${Number(row['最新総原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">BOM明細数</dt>
                    <dd>{row['原価コード'] ? row._bomCount : '—'}</dd>
                  </div>
                </dl>
                <button
                  onClick={() => setModalProduct(row)}
                  className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded text-sm min-h-[44px]"
                >
                  BOM確認
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {modalProduct && (
        <BomModal product={modalProduct} onClose={() => setModalProduct(null)} />
      )}
    </div>
  )
}
