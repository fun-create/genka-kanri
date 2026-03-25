import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MonthlyReport() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [details, setDetails] = useState([])
  const [inventoryHistory, setInventoryHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchReport() }, [year, month])

  async function fetchReport() {
    setLoading(true)
    const from = `${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`
    const toDate = new Date(year, month, 1)
    const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-01T00:00:00+09:00`

    const [detailRes, histRes] = await Promise.all([
      supabase.from('T_原価計算明細').select('*').gte('作成日時', from).lt('作成日時', to).order('作成日時', { ascending: false }),
      supabase.from('T_在庫履歴').select('*, T_原材料マスタ(資材名)').gte('日時', from).lt('日時', to).order('日時', { ascending: false }),
    ])

    setDetails(detailRes.data || [])
    setInventoryHistory(histRes.data || [])
    setLoading(false)
  }

  const totalCost = details.reduce((sum, d) => sum + Number(d['原価']), 0)
  const inCount = inventoryHistory.filter((h) => h['区分'] === '入庫').length
  const outCount = inventoryHistory.filter((h) => h['区分'] === '出庫').length

  const materialSummary = details.reduce((acc, d) => {
    const code = d['原材料コード'] || '不明'
    if (!acc[code]) acc[code] = { code, totalCost: 0, count: 0 }
    acc[code].totalCost += Number(d['原価'])
    acc[code].count += 1
    return acc
  }, {})

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">月次レポート</h2>

      <div className="flex gap-2 items-center mb-6 flex-wrap">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2.5 text-base md:text-sm">
          {years.map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2.5 text-base md:text-sm">
          {months.map((m) => <option key={m} value={m}>{m}月</option>)}
        </select>
        <span className="text-sm text-gray-500">{year}年{month}月</span>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-600 mb-1">原価計算件数</p>
              <p className="text-2xl font-bold text-blue-800">{details.length}<span className="text-sm font-normal ml-1">件</span></p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs text-green-600 mb-1">合計原価</p>
              <p className="text-2xl font-bold text-green-800">¥{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">在庫移動（入庫/出庫）</p>
              <p className="text-2xl font-bold text-gray-800">
                {inCount}<span className="text-sm font-normal text-gray-500 ml-1">入庫</span>
                {' / '}
                {outCount}<span className="text-sm font-normal text-gray-500 ml-1">出庫</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 原材料別原価集計 */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-700 mb-3">原材料別原価集計</h3>
              {Object.keys(materialSummary).length === 0 ? (
                <p className="text-gray-400 text-sm">データがありません</p>
              ) : (
                <div className="space-y-2">
                  {Object.values(materialSummary)
                    .sort((a, b) => b.totalCost - a.totalCost)
                    .map((s) => (
                      <div key={s.code} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{s.code}</p>
                          <p className="text-xs text-gray-400">{s.count}件</p>
                        </div>
                        <p className="font-bold text-gray-800">¥{s.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* 在庫移動履歴 */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-700 mb-3">在庫移動履歴</h3>
              {inventoryHistory.length === 0 ? (
                <p className="text-gray-400 text-sm">データがありません</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {inventoryHistory.map((h) => (
                    <div key={h.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                      <div>
                        <p className="text-sm text-gray-800">{h['T_原材料マスタ']?.['資材名'] || h['原材料コード']}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(h['日時']).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          h['区分'] === '入庫' ? 'bg-blue-100 text-blue-700' :
                          h['区分'] === '出庫' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{h['区分']}</span>
                        <span className="font-bold text-sm">{h['数量']}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 原価計算明細 */}
          {details.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 mt-6">
              <h3 className="font-semibold text-gray-700 mb-3">原価計算明細</h3>
              {/* デスクトップ テーブル */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600">
                      {['受注ID', '原材料コード', '単価(snapshot)', '数量', '原価', '作成日時'].map((h) => (
                        <th key={h} className="border border-gray-200 px-3 py-2 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d) => (
                      <tr key={d.id} className="bg-white hover:bg-gray-50">
                        <td className="border border-gray-200 px-3 py-2 text-xs">{d['受注ID']}</td>
                        <td className="border border-gray-200 px-3 py-2">{d['原材料コード']}</td>
                        <td className="border border-gray-200 px-3 py-2 text-right">¥{Number(d['単価_snapshot']).toLocaleString()}</td>
                        <td className="border border-gray-200 px-3 py-2 text-right">{d['数量']}</td>
                        <td className="border border-gray-200 px-3 py-2 text-right font-medium">¥{Number(d['原価']).toLocaleString()}</td>
                        <td className="border border-gray-200 px-3 py-2 text-xs whitespace-nowrap">
                          {new Date(d['作成日時']).toLocaleString('ja-JP')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* モバイル カード */}
              <div className="md:hidden space-y-2">
                {details.map((d) => (
                  <div key={d.id} className="bg-gray-50 rounded px-3 py-2.5">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs text-gray-500 truncate flex-1">{d['受注ID']}</p>
                      <p className="font-bold text-gray-800 ml-2">¥{Number(d['原価']).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>単価 ¥{Number(d['単価_snapshot']).toLocaleString()}</span>
                      <span>×</span>
                      <span>{d['数量']}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(d['作成日時']).toLocaleString('ja-JP')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
