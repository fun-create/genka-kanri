import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  return `¥${Math.ceil(n).toLocaleString()}`
}

function diffColor(diff) {
  if (diff > 0) return 'text-red-600'
  if (diff < 0) return 'text-blue-600'
  return 'text-gray-500'
}

export default function PriceHistory() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('T_単価更新履歴')
      .select('*')
      .order('更新日時', { ascending: false })
      .then(({ data }) => {
        setRows(data || [])
        setLoading(false)
      })
  }, [])

  const filtered = rows.filter(
    (r) =>
      !search ||
      (r['原材料コード'] || '').includes(search) ||
      (r['資材名'] || '').includes(search)
  )

  // サマリー
  const total = rows.length
  const now = new Date()
  const thisMonth = rows.filter((r) => {
    const d = new Date(r['更新日時'])
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
  const latest = rows[0] ? new Date(rows[0]['更新日時']).toLocaleDateString('ja-JP') : null

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-800">単価更新履歴</h2>
        <p className="text-sm text-gray-500 mt-0.5">原材料の単価が変更されるたびに自動記録されます</p>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">総更新回数</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{total}<span className="text-sm font-normal text-gray-500 ml-1">回</span></p>
            </div>
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-500">今月の更新</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{thisMonth}<span className="text-sm font-normal ml-1">回</span></p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">直近更新日</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{latest || '—'}</p>
            </div>
          </div>

          {/* 検索 */}
          <input
            type="text"
            placeholder="原材料コード・資材名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2.5 text-base md:text-sm mb-4 w-full md:w-72"
          />

          {/* デスクトップ テーブル */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  {['更新日時', '原材料コード', '資材名', '更新前単価', '更新後単価', '変動額', '変動率', '計算方式', 'BOM件数', '商品件数'].map((h) => (
                    <th key={h} className="border border-gray-200 px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const before = Number(row['更新前単価'])
                  const after  = Number(row['更新後単価'])
                  const diff   = after - before
                  const rate   = before > 0 ? (diff / before) * 100 : null
                  return (
                    <tr key={row.id} className="bg-white hover:bg-gray-50">
                      <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(row['更新日時']).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">{row['原材料コード']}</td>
                      <td className="border border-gray-200 px-3 py-2 font-medium">{row['資材名']}</td>
                      <td className="border border-gray-200 px-3 py-2 text-right">{fmt(before)}</td>
                      <td className="border border-gray-200 px-3 py-2 text-right font-medium">{fmt(after)}</td>
                      <td className={`border border-gray-200 px-3 py-2 text-right font-medium ${diffColor(diff)}`}>
                        {diff > 0 ? '+' : ''}{fmt(diff)}
                      </td>
                      <td className={`border border-gray-200 px-3 py-2 text-right ${diffColor(diff)}`}>
                        {rate !== null ? `${diff >= 0 ? '+' : ''}${rate.toFixed(1)}%` : '—'}
                      </td>
                      <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">{row['計算方式'] || '—'}</td>
                      <td className="border border-gray-200 px-3 py-2 text-right text-xs">{row['更新件数_BOM'] ?? '—'}</td>
                      <td className="border border-gray-200 px-3 py-2 text-right text-xs">{row['更新件数_商品'] ?? '—'}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-400">
                      {rows.length === 0 ? '更新履歴がありません' : '条件に一致する履歴がありません'}
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
                {rows.length === 0 ? '更新履歴がありません' : '条件に一致する履歴がありません'}
              </p>
            )}
            {filtered.map((row) => {
              const before = Number(row['更新前単価'])
              const after  = Number(row['更新後単価'])
              const diff   = after - before
              const rate   = before > 0 ? (diff / before) * 100 : null
              return (
                <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">{row['資材名']}</p>
                      <p className="text-xs text-gray-400">{row['原材料コード']}</p>
                    </div>
                    <p className="text-xs text-gray-400 ml-2 shrink-0">
                      {new Date(row['更新日時']).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500">更新前</dt>
                      <dd>{fmt(before)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">更新後</dt>
                      <dd className="font-medium">{fmt(after)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">変動</dt>
                      <dd className={`font-medium ${diffColor(diff)}`}>
                        {diff >= 0 ? '+' : ''}{fmt(diff)}
                        {rate !== null && <span className="text-xs ml-1">({rate.toFixed(1)}%)</span>}
                      </dd>
                    </div>
                  </dl>
                  {row['計算方式'] && (
                    <p className="text-xs text-gray-400 mt-2">{row['計算方式']}　BOM: {row['更新件数_BOM']}件 / 商品: {row['更新件数_商品']}件</p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
