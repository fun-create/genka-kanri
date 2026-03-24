import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KUBUN_ORDER = ['メディア', '溶剤', '原材料', '工数', '梱包']
const KUBUN_COLOR = {
  メディア: 'bg-blue-100 text-blue-700',
  溶剤:     'bg-purple-100 text-purple-700',
  原材料:   'bg-green-100 text-green-700',
  工数:     'bg-orange-100 text-orange-700',
  梱包:     'bg-gray-100 text-gray-700',
}

export default function ProductDetail() {
  const { code } = useParams()
  const [product, setProduct] = useState(null)
  const [bomRows, setBomRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const { data: prod, error: prodErr } = await supabase
        .from('T_商品マスタ')
        .select('*')
        .eq('商品コード', decodeURIComponent(code))
        .single()

      if (prodErr || !prod) {
        setError('商品が見つかりません')
        setLoading(false)
        return
      }

      setProduct(prod)

      if (prod['原価コード']) {
        const { data: bom } = await supabase
          .from('T_原価計算明細')
          .select('*')
          .eq('受注ID', prod['原価コード'])
          .order('明細区分')
        setBomRows(bom || [])
      }

      setLoading(false)
    }
    fetchData()
  }, [code])

  if (loading) return <p className="text-gray-500">読み込み中...</p>
  if (error) return (
    <div>
      <Link to="/products" className="text-blue-600 hover:underline text-sm">← 商品一覧に戻る</Link>
      <p className="text-red-500 mt-4">{error}</p>
    </div>
  )

  // 明細区分ごとの集計
  const kubunSummary = {}
  for (const row of bomRows) {
    const k = row['明細区分'] || '不明'
    if (!kubunSummary[k]) kubunSummary[k] = { count: 0, totalCost: 0, rows: [] }
    kubunSummary[k].count += 1
    kubunSummary[k].totalCost += Number(row['原価'])
    kubunSummary[k].rows.push(row)
  }

  const totalCost = bomRows.reduce((sum, r) => sum + Number(r['原価']), 0)
  const sortedKubun = KUBUN_ORDER.filter((k) => kubunSummary[k]).concat(
    Object.keys(kubunSummary).filter((k) => !KUBUN_ORDER.includes(k))
  )

  return (
    <div>
      <div className="mb-4">
        <Link to="/products" className="text-blue-600 hover:underline text-sm">← 商品一覧に戻る</Link>
      </div>

      {/* 商品情報カード */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{product['商品コード']}</p>
            <h2 className="text-xl font-bold text-gray-800">{product['商品名']}</h2>
            <div className="flex gap-2 mt-2">
              {product['ポジション'] && (
                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                  {product['ポジション']}
                </span>
              )}
              {product['原価コード'] && (
                <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                  原価コード: {product['原価コード']}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-0.5">最新総原価</p>
            <p className="text-2xl font-bold text-blue-600">
              ¥{Number(product['最新総原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            {product['本体価格'] > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                本体価格 ¥{Number(product['本体価格']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                {product['原価率'] > 0 && (
                  <span className={`ml-2 font-medium ${Number(product['原価率']) > 0.5 ? 'text-red-600' : 'text-gray-600'}`}>
                    （原価率 {(Number(product['原価率']) * 100).toFixed(1)}%）
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* BOM明細 */}
      {!product['原価コード'] ? (
        <p className="text-gray-400 text-sm">原価コードが設定されていません</p>
      ) : bomRows.length === 0 ? (
        <p className="text-gray-400 text-sm">BOM明細データがありません（原価コード: {product['原価コード']}）</p>
      ) : (
        <>
          {/* 明細区分別サマリー */}
          <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
            {sortedKubun.map((k) => {
              const s = kubunSummary[k]
              const pct = totalCost > 0 ? (s.totalCost / totalCost * 100) : 0
              return (
                <div key={k} className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${KUBUN_COLOR[k] || 'bg-gray-100 text-gray-700'}`}>
                      {k}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-800">
                    ¥{s.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-gray-400">{pct.toFixed(1)}%　{s.count}件</p>
                </div>
              )
            })}
            {/* 合計 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-600 mb-1 font-medium">合計原価（BOM）</p>
              <p className="text-lg font-bold text-blue-700">
                ¥{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-blue-400">{bomRows.length}明細</p>
            </div>
          </div>

          {/* 明細区分ごとのテーブル */}
          {sortedKubun.map((k) => (
            <div key={k} className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${KUBUN_COLOR[k] || 'bg-gray-100 text-gray-700'}`}>
                    {k}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">{kubunSummary[k].count} 件</span>
                </div>
                <span className="text-sm font-bold text-gray-800">
                  小計 ¥{kubunSummary[k].totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    {['コード', '名称', '単価', '数量', '原価'].map((h) => (
                      <th key={h} className="border border-gray-100 px-3 py-1.5 text-left text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kubunSummary[k].rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="border border-gray-100 px-3 py-1.5 text-xs text-gray-500">{row['コード']}</td>
                      <td className="border border-gray-100 px-3 py-1.5">{row['名称']}</td>
                      <td className="border border-gray-100 px-3 py-1.5 text-right">
                        ¥{Number(row['単価_snapshot']).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="border border-gray-100 px-3 py-1.5 text-right">{Number(row['数量']).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      <td className="border border-gray-100 px-3 py-1.5 text-right font-medium">
                        ¥{Number(row['原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
