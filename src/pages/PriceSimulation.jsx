import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

// ─── ユーティリティ ───────────────────────────
function calcRecommendedPrice(cost, targetRate) {
  if (!cost || targetRate >= 100) return null
  return cost / (1 - targetRate / 100)
}

function calcGrossRate(price, cost) {
  if (!price) return null
  return ((price - cost) / price) * 100
}

function verdict(currentPrice, recPrice) {
  if (!currentPrice || recPrice === null) return null
  const ratio = currentPrice / recPrice
  if (ratio < 0.952) return 'up'     // 現在価格 < 推奨売価
  if (ratio > 1.05)  return 'down'   // 現在価格 > 推奨売価
  return 'ok'
}

function VerdictBadge({ v }) {
  if (v === 'up')   return <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">値上げ推奨</span>
  if (v === 'down') return <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">値下げ余地あり</span>
  if (v === 'ok')   return <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">適正</span>
  return <span className="text-gray-300 text-xs">—</span>
}

const fmt  = (n) => (n == null || isNaN(n) ? '—' : `¥${Math.ceil(n).toLocaleString()}`)
const fmtR = (r) => (r == null || isNaN(r) ? '—' : `${r.toFixed(1)}%`)

export default function PriceSimulation() {
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [targetRate, setTargetRate] = useState(40)
  const [posFilter, setPosFilter]  = useState('')
  const [results, setResults]      = useState(null)   // null = 未実行

  useEffect(() => {
    supabase.from('T_商品マスタ').select('*').order('商品コード').then(({ data }) => {
      setProducts(data || [])
      setLoading(false)
    })
  }, [])

  const positions = useMemo(
    () => [...new Set(products.map((p) => p['ポジション']).filter(Boolean))].sort(),
    [products]
  )

  function runSimulation() {
    const base = products.filter((p) => {
      const hasCost = Number(p['最新総原価']) > 0
      const matchPos = !posFilter || p['ポジション'] === posFilter
      return hasCost && matchPos
    })

    setResults(
      base.map((p) => {
        const cost    = Number(p['最新総原価'])
        const curP    = Number(p['本体価格']) || null
        const curR    = calcGrossRate(curP, cost)
        const recP    = calcRecommendedPrice(cost, targetRate)
        const diff    = recP !== null && curP ? recP - curP : null
        const v       = verdict(curP, recP)
        return { ...p, _cost: cost, _curP: curP, _curR: curR, _recP: recP, _diff: diff, _verdict: v }
      })
    )
  }

  // ─── サマリー ───────────────────────────────
  const summary = useMemo(() => {
    if (!results) return null
    const upItems   = results.filter((r) => r._verdict === 'up')
    const okItems   = results.filter((r) => r._verdict === 'ok')
    const downItems = results.filter((r) => r._verdict === 'down')
    // 値上げ推奨：推奨売価まで上げた場合の粗利改善額
    const improvement = upItems.reduce((sum, r) => {
      if (r._diff === null || r._diff <= 0) return sum
      return sum + r._diff   // 価格差 = 粗利改善額（原価不変のため）
    }, 0)
    return { up: upItems.length, ok: okItems.length, down: downItems.length, improvement }
  }, [results])

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-800">売価シミュレーション</h2>
        <p className="text-sm text-gray-500 mt-0.5">目標粗利率から推奨売価を算出し、値上げ・値下げの判断根拠を提供します</p>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <div className="space-y-6">

          {/* ══ シミュレーション設定パネル ══ */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-gray-700 mb-4">シミュレーション設定</h3>

            <div className="flex flex-wrap gap-6 items-end">
              {/* スライダー */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-500 mb-1">
                  目標粗利率：<span className="font-bold text-gray-800 text-base">{targetRate}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="1"
                  value={targetRate}
                  onChange={(e) => setTargetRate(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>0%</span>
                  <span>40%</span>
                  <span>80%</span>
                </div>
              </div>

              {/* ポジション絞り込み */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">ポジション絞り込み</label>
                <select
                  value={posFilter}
                  onChange={(e) => setPosFilter(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2.5 text-base md:text-sm"
                >
                  <option value="">全ポジション</option>
                  {positions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* 計算実行 */}
              <button
                onClick={runSimulation}
                className="bg-blue-600 text-white px-6 py-2.5 rounded text-sm font-semibold hover:bg-blue-700 min-h-[44px]"
              >
                計算実行
              </button>
            </div>
          </div>

          {/* ══ 集計サマリー ══ */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-xs text-red-500">値上げ推奨</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{summary.up}<span className="text-sm font-normal ml-1">件</span></p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-xs text-green-600">適正</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{summary.ok}<span className="text-sm font-normal ml-1">件</span></p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-500">値下げ余地あり</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{summary.down}<span className="text-sm font-normal ml-1">件</span></p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-xs text-yellow-600">値上げ時の粗利改善額合計</p>
                <p className="text-xl font-bold text-yellow-700 mt-1 leading-tight">
                  {summary.improvement > 0 ? `¥${Math.ceil(summary.improvement).toLocaleString()}` : '—'}
                </p>
              </div>
            </div>
          )}

          {/* ══ シミュレーション結果テーブル ══ */}
          {results && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-700">
                  シミュレーション結果
                  <span className="text-sm font-normal text-gray-400 ml-2">目標粗利率 {targetRate}%　{results.length} 件</span>
                </h3>
                <button
                  onClick={() => {
                    const rows = results.map((r) => ({
                      '商品コード': r['商品コード'],
                      '商品名': r['商品名'],
                      'ポジション': r['ポジション'] || '',
                      '現在の本体価格': r._curP ?? '',
                      '最新総原価': r._cost,
                      '現在の粗利率(%)': r._curR != null ? Number(r._curR.toFixed(1)) : '',
                      [`推奨売価(粗利率${targetRate}%)`]: r._recP != null ? Math.ceil(r._recP) : '',
                      '価格差': r._diff != null ? Math.ceil(r._diff) : '',
                      '判定': r._verdict === 'up' ? '値上げ推奨' : r._verdict === 'ok' ? '適正' : r._verdict === 'down' ? '値下げ余地あり' : '',
                    }))
                    const ws = XLSX.utils.json_to_sheet(rows)
                    const wb = XLSX.utils.book_new()
                    XLSX.utils.book_append_sheet(wb, ws, 'シミュレーション')
                    XLSX.writeFile(wb, `売価シミュレーション_粗利${targetRate}%.xlsx`)
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 min-h-[44px]"
                >
                  Excel出力
                </button>
              </div>

              {results.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">対象商品がありません（原価0円の商品は除外されます）</p>
              ) : (
                <>
                  {/* デスクトップ テーブル */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-100 text-gray-600">
                          {['商品コード', '商品名', 'ポジション', '現在の本体価格', '最新総原価', '現在の粗利率', '推奨売価', '価格差', '判定'].map((h) => (
                            <th key={h} className="border border-gray-200 px-3 py-2 text-left whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r) => (
                          <tr key={r['商品コード']} className="bg-white hover:bg-gray-50">
                            <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">{r['商品コード']}</td>
                            <td className="border border-gray-200 px-3 py-2 font-medium">{r['商品名']}</td>
                            <td className="border border-gray-200 px-3 py-2">
                              {r['ポジション'] && (
                                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{r['ポジション']}</span>
                              )}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-right">{r._curP ? fmt(r._curP) : <span className="text-gray-300">未設定</span>}</td>
                            <td className="border border-gray-200 px-3 py-2 text-right">{fmt(r._cost)}</td>
                            <td className={`border border-gray-200 px-3 py-2 text-right font-medium ${
                              r._curR === null ? 'text-gray-300'
                              : r._curR <= 20 ? 'text-red-600'
                              : r._curR <= 40 ? 'text-yellow-600'
                              : 'text-green-700'
                            }`}>
                              {r._curP ? fmtR(r._curR) : '—'}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-right font-bold text-blue-700">{fmt(r._recP)}</td>
                            <td className={`border border-gray-200 px-3 py-2 text-right font-medium ${
                              r._diff === null ? 'text-gray-300'
                              : r._diff > 0 ? 'text-red-600'
                              : r._diff < 0 ? 'text-blue-600'
                              : 'text-gray-500'
                            }`}>
                              {r._diff !== null
                                ? `${r._diff > 0 ? '+' : ''}¥${Math.ceil(r._diff).toLocaleString()}`
                                : '—'}
                            </td>
                            <td className="border border-gray-200 px-3 py-2">
                              <VerdictBadge v={r._verdict} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* モバイル カード */}
                  <div className="md:hidden space-y-3">
                    {results.map((r) => (
                      <div key={r['商品コード']} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{r['商品名']}</p>
                            <p className="text-xs text-gray-400">{r['商品コード']}</p>
                          </div>
                          <div className="ml-2 shrink-0">
                            <VerdictBadge v={r._verdict} />
                          </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 text-sm mb-2">
                          <div>
                            <dt className="text-xs text-gray-500">現在の本体価格</dt>
                            <dd>{r._curP ? fmt(r._curP) : <span className="text-gray-300">未設定</span>}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500">推奨売価</dt>
                            <dd className="font-bold text-blue-700">{fmt(r._recP)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500">最新総原価</dt>
                            <dd>{fmt(r._cost)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500">現在の粗利率</dt>
                            <dd>{r._curP ? fmtR(r._curR) : '—'}</dd>
                          </div>
                        </dl>
                        {r._diff !== null && (
                          <p className={`text-xs font-medium ${r._diff > 0 ? 'text-red-600' : r._diff < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                            価格差：{r._diff > 0 ? '+' : ''}¥{Math.ceil(r._diff).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {!results && (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-400">
              <p className="text-sm">設定を選択して「計算実行」を押してください</p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
