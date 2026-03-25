import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function Inventory() {
  const [rows, setRows] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCode, setSelectedCode] = useState(null)

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from('T_原材料マスタ').select('*').order('原材料コード')
      setRows(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  async function showHistory(code) {
    setSelectedCode(code)
    const { data } = await supabase
      .from('T_在庫履歴')
      .select('*')
      .eq('原材料コード', code)
      .order('日時', { ascending: false })
      .limit(30)
    setHistory(data || [])
  }

  const filtered = rows.filter(
    (r) =>
      (r['原材料コード'] || '').includes(search) ||
      (r['資材名'] || '').includes(search)
  )

  const lowStockCount = rows.filter((r) => Number(r['現在庫']) <= Number(r['発注点'])).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">在庫一覧</h2>
        <Link to="/inventory-register"
          className="bg-blue-600 text-white px-4 py-2.5 rounded text-sm hover:bg-blue-700 min-h-[44px] flex items-center">
          ＋ 在庫登録
        </Link>
      </div>

      {lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded px-4 py-2.5 text-sm text-red-700 mb-4">
          発注点以下の在庫が {lowStockCount} 件あります
        </div>
      )}

      <input
        type="text"
        placeholder="コード・資材名で検索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border border-gray-300 rounded px-3 py-2.5 text-base md:text-sm mb-4 w-full md:w-72"
      />

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <>
          {/* デスクトップ テーブル */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  {['原材料コード', '資材名', 'メディア区分', '現在庫', '発注点', '状態', '履歴'].map((h) => (
                    <th key={h} className="border border-gray-200 px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const isLow = Number(row['現在庫']) <= Number(row['発注点'])
                  return (
                    <tr key={row['原材料コード']} className={`${isLow ? 'bg-red-50' : 'bg-white'} hover:bg-gray-50`}>
                      <td className="border border-gray-200 px-3 py-2">{row['原材料コード']}</td>
                      <td className="border border-gray-200 px-3 py-2">{row['資材名']}</td>
                      <td className="border border-gray-200 px-3 py-2">{row['メディア区分']}</td>
                      <td className={`border border-gray-200 px-3 py-2 text-right font-semibold ${isLow ? 'text-red-600' : ''}`}>
                        {row['現在庫']}
                      </td>
                      <td className="border border-gray-200 px-3 py-2 text-right">{row['発注点']}</td>
                      <td className="border border-gray-200 px-3 py-2">
                        {isLow
                          ? <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">発注点以下</span>
                          : <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">正常</span>
                        }
                      </td>
                      <td className="border border-gray-200 px-3 py-2">
                        <button onClick={() => showHistory(row['原材料コード'])} className="text-blue-600 hover:underline text-xs">履歴</button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* モバイル カード */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 && <p className="text-center py-8 text-gray-400">データがありません</p>}
            {filtered.map((row) => {
              const isLow = Number(row['現在庫']) <= Number(row['発注点'])
              return (
                <div key={row['原材料コード']} className={`border rounded-lg p-4 ${isLow ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">{row['資材名']}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{row['原材料コード']}{row['メディア区分'] ? ` · ${row['メディア区分']}` : ''}</p>
                    </div>
                    {isLow
                      ? <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full shrink-0 ml-2">発注点以下</span>
                      : <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full shrink-0 ml-2">正常</span>
                    }
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-3">
                    <div>
                      <dt className="text-xs text-gray-500">現在庫</dt>
                      <dd className={`text-xl font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{row['現在庫']}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">発注点</dt>
                      <dd className="font-medium">{row['発注点']}</dd>
                    </div>
                  </dl>
                  <button
                    onClick={() => showHistory(row['原材料コード'])}
                    className="w-full py-2.5 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 min-h-[44px]"
                  >
                    在庫履歴を見る
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {selectedCode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full rounded-t-2xl md:rounded-lg md:max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 shrink-0">
              <h3 className="font-bold text-gray-800">在庫履歴：{selectedCode}</h3>
              <button onClick={() => setSelectedCode(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {history.length === 0 ? (
                <p className="text-center py-6 text-gray-400">履歴がありません</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2.5">
                      <div>
                        <p className="text-xs text-gray-500">{new Date(h['日時']).toLocaleString('ja-JP')}</p>
                        {h['備考'] && <p className="text-sm text-gray-600 mt-0.5">{h['備考']}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          h['区分'] === '入庫' ? 'bg-blue-100 text-blue-700' :
                          h['区分'] === '出庫' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{h['区分']}</span>
                        <span className="font-bold text-gray-800">{h['数量']}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
