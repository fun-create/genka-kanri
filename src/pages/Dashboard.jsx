import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

function grossRate(product) {
  const price = Number(product['本体価格'])
  const cost = Number(product['最新総原価'])
  if (!price) return null
  return ((price - cost) / price) * 100
}

function rowBg(rate) {
  if (rate === null) return 'bg-white'
  if (rate <= 20) return 'bg-red-50'
  if (rate <= 40) return 'bg-yellow-50'
  return 'bg-green-50'
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    rawMaterialCount: 0,
    lowStockCount: 0,
    productCount: 0,
    solventPrice: 0,
  })
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' | 'desc'
  const [positionFilter, setPositionFilter] = useState('')

  useEffect(() => {
    async function fetchStats() {
      const [rawRes, productRes, solventRes, allProductsRes] = await Promise.all([
        supabase.from('T_原材料マスタ').select('原材料コード, 現在庫, 発注点'),
        supabase.from('T_商品マスタ').select('商品コード', { count: 'exact', head: true }),
        supabase.from('T_溶剤マスタ').select('最新単価').limit(1).single(),
        supabase.from('T_商品マスタ').select('*').order('商品コード'),
      ])

      const rawData = rawRes.data || []
      setStats({
        rawMaterialCount: rawData.length,
        lowStockCount: rawData.filter((r) => r['現在庫'] <= r['発注点']).length,
        productCount: productRes.count || 0,
        solventPrice: solventRes.data?.['最新単価'] ?? 0,
      })

      // 本体価格が設定されている商品のみ
      const withPrice = (allProductsRes.data || []).filter((p) => Number(p['本体価格']) > 0)
      setProducts(withPrice)
      setLoading(false)
    }
    fetchStats()
  }, [])

  const baseCards = [
    { label: '原材料種類数', value: stats.rawMaterialCount, unit: '種', color: 'bg-blue-50 border-blue-200', link: '/raw-materials' },
    { label: '発注点以下の在庫', value: stats.lowStockCount, unit: '件', color: 'bg-red-50 border-red-200', link: '/inventory' },
    { label: '商品マスタ件数', value: stats.productCount, unit: '件', color: 'bg-green-50 border-green-200', link: '/cost-calculation' },
    { label: '溶剤最新単価', value: stats.solventPrice.toLocaleString(), unit: '円', color: 'bg-yellow-50 border-yellow-200', link: '/solvent' },
  ]

  // 粗利サマリー計算
  const rates = products.map((p) => ({ product: p, rate: grossRate(p) })).filter((x) => x.rate !== null)
  const avgRate = rates.length ? rates.reduce((s, x) => s + x.rate, 0) / rates.length : null
  const lowCount = rates.filter((x) => x.rate <= 20).length
  const maxItem = rates.length ? rates.reduce((a, b) => (a.rate > b.rate ? a : b)) : null
  const minItem = rates.length ? rates.reduce((a, b) => (a.rate < b.rate ? a : b)) : null

  // ポジション一覧
  const positions = [...new Set(products.map((p) => p['ポジション']).filter(Boolean))].sort()

  // ポジション別平均粗利率
  const positionStats = positions.map((pos) => {
    const posRates = rates.filter((x) => x.product['ポジション'] === pos)
    const avg = posRates.length ? posRates.reduce((s, x) => s + x.rate, 0) / posRates.length : null
    return { pos, avg, count: posRates.length }
  })

  // フィルター＆ソート
  const filtered = rates
    .filter((x) => !positionFilter || x.product['ポジション'] === positionFilter)
    .sort((a, b) => sortOrder === 'asc' ? a.rate - b.rate : b.rate - a.rate)

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">ダッシュボード</h2>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <>
          {/* 既存サマリーカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {baseCards.map((card) => (
              <Link
                key={card.label}
                to={card.link}
                className={`border rounded-lg p-4 ${card.color} hover:opacity-80 transition-opacity`}
              >
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-gray-800">
                  {card.value}
                  <span className="text-sm font-normal text-gray-500 ml-1">{card.unit}</span>
                </p>
              </Link>
            ))}
          </div>

          {/* 粗利サマリーカード */}
          {rates.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <p className="text-xs text-gray-500 mb-1">平均粗利率</p>
                <p className="text-2xl font-bold text-gray-800">
                  {avgRate !== null ? `${avgRate.toFixed(1)}%` : '—'}
                </p>
              </div>
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <p className="text-xs text-red-500 mb-1">粗利率20%以下の商品</p>
                <p className="text-2xl font-bold text-red-600">{lowCount}<span className="text-sm font-normal ml-1">件</span></p>
              </div>
              <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                <p className="text-xs text-green-600 mb-1">最高粗利率</p>
                {maxItem && (
                  <>
                    <p className="text-2xl font-bold text-green-700">{maxItem.rate.toFixed(1)}%</p>
                    <p className="text-xs text-green-600 mt-0.5 truncate">{maxItem.product['商品名']}</p>
                  </>
                )}
              </div>
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <p className="text-xs text-red-500 mb-1">最低粗利率</p>
                {minItem && (
                  <>
                    <p className="text-2xl font-bold text-red-600">{minItem.rate.toFixed(1)}%</p>
                    <p className="text-xs text-red-500 mt-0.5 truncate">{minItem.product['商品名']}</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ポジション別集計カード */}
          {positionStats.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">ポジション別平均粗利率</h3>
              <div className="flex flex-wrap gap-2">
                {positionStats.map(({ pos, avg, count }) => (
                  <div key={pos} className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center min-w-[100px]">
                    <p className="text-xs text-gray-500">{pos}</p>
                    <p className={`text-lg font-bold mt-0.5 ${avg !== null && avg <= 20 ? 'text-red-600' : avg !== null && avg <= 40 ? 'text-yellow-600' : 'text-green-700'}`}>
                      {avg !== null ? `${avg.toFixed(1)}%` : '—'}
                    </p>
                    <p className="text-xs text-gray-400">{count}件</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 商品別粗利一覧 */}
          {rates.length > 0 && (
            <div className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-700">商品別粗利一覧</h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">全ポジション</option>
                    {positions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="asc">粗利率：低い順</option>
                    <option value="desc">粗利率：高い順</option>
                  </select>
                  <span className="text-xs text-gray-400">{filtered.length} 件</span>
                </div>
              </div>

              {/* デスクトップ テーブル */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600">
                      {['商品コード', '商品名', 'ポジション', '本体価格', '最新総原価', '粗利額', '粗利率'].map((h) => (
                        <th key={h} className="border border-gray-200 px-3 py-2 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(({ product, rate }) => {
                      const price = Number(product['本体価格'])
                      const cost = Number(product['最新総原価'])
                      const gross = price - cost
                      return (
                        <tr key={product['商品コード']} className={rowBg(rate)}>
                          <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">{product['商品コード']}</td>
                          <td className="border border-gray-200 px-3 py-2">
                            <Link to={`/products/${encodeURIComponent(product['商品コード'])}`} className="text-blue-600 hover:underline font-medium">
                              {product['商品名']}
                            </Link>
                          </td>
                          <td className="border border-gray-200 px-3 py-2">
                            {product['ポジション'] && (
                              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{product['ポジション']}</span>
                            )}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-right">¥{price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right">¥{cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right font-medium">¥{gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right font-bold">
                            {rate.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* モバイル カード */}
              <div className="md:hidden space-y-2">
                {filtered.map(({ product, rate }) => {
                  const price = Number(product['本体価格'])
                  const cost = Number(product['最新総原価'])
                  const gross = price - cost
                  return (
                    <div key={product['商品コード']} className={`border border-gray-200 rounded-lg p-4 ${rowBg(rate)}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <Link to={`/products/${encodeURIComponent(product['商品コード'])}`} className="text-blue-600 font-semibold text-base block truncate">
                            {product['商品名']}
                          </Link>
                          <p className="text-xs text-gray-400 mt-0.5">{product['商品コード']}</p>
                        </div>
                        <span className="text-lg font-bold ml-2 shrink-0">{rate.toFixed(1)}%</span>
                      </div>
                      <dl className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <dt className="text-xs text-gray-500">本体価格</dt>
                          <dd>¥{price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">最新総原価</dt>
                          <dd>¥{cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500">粗利額</dt>
                          <dd className="font-medium">¥{gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</dd>
                        </div>
                      </dl>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* クイックリンク */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-gray-700 mb-3">クイックリンク</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { to: '/inventory-register', label: '在庫入庫登録' },
                { to: '/cost-calculation', label: '原価計算' },
                { to: '/monthly-report', label: '月次レポート' },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-center py-3 px-3 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700 transition-colors min-h-[44px] flex items-center justify-center"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
