import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const emptyForm = {
  原材料コード: '',
  資材名: '',
  最新単価: '',
  メディア区分: '',
  仕入先URL: '',
  発注点: '',
  現在庫: '',
}

export default function RawMaterials() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editKey, setEditKey] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [priceEdit, setPriceEdit] = useState({ code: null, value: '' })

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('T_原材料マスタ').select('*').order('原材料コード')
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function openAdd() { setForm(emptyForm); setEditKey(null); setShowForm(true) }
  function openEdit(row) {
    setForm({ ...row, 最新単価: String(row['最新単価']), 発注点: String(row['発注点']), 現在庫: String(row['現在庫']) })
    setEditKey(row['原材料コード'])
    setShowForm(true)
  }

  async function recordPriceHistory({ code, 資材名, oldPrice, newPrice, method }) {
    const { data: bomData } = await supabase
      .from('T_原価計算明細')
      .select('受注ID')
      .eq('コード', code)
    const bomCount     = bomData ? bomData.length : 0
    const productCount = bomData ? new Set(bomData.map((r) => r['受注ID'])).size : 0
    await supabase.from('T_単価更新履歴').insert({
      原材料コード: code,
      資材名,
      更新前単価: oldPrice,
      更新後単価: newPrice,
      計算方式: method,
      更新件数_BOM: bomCount,
      更新件数_商品: productCount,
    })
  }

  async function handleSave() {
    const payload = {
      原材料コード: form['原材料コード'],
      資材名: form['資材名'],
      最新単価: Number(form['最新単価']),
      メディア区分: form['メディア区分'],
      仕入先URL: form['仕入先URL'],
      発注点: Number(form['発注点']),
      現在庫: Number(form['現在庫']),
    }
    if (editKey) {
      const currentRow = rows.find((r) => r['原材料コード'] === editKey)
      const oldPrice   = currentRow ? Number(currentRow['最新単価']) : null
      const newPrice   = Number(form['最新単価'])
      await supabase.from('T_原材料マスタ').update(payload).eq('原材料コード', editKey)
      if (oldPrice !== newPrice) {
        await recordPriceHistory({ code: editKey, 資材名: form['資材名'], oldPrice, newPrice, method: 'フォーム編集' })
      }
    } else {
      await supabase.from('T_原材料マスタ').insert(payload)
    }
    setShowForm(false)
    fetchData()
  }

  async function handleDelete(code) {
    if (!confirm(`原材料コード「${code}」を削除しますか？`)) return
    await supabase.from('T_原材料マスタ').delete().eq('原材料コード', code)
    fetchData()
  }

  function exportToExcel() {
    const data = filtered.map((r) => ({
      原材料コード: r['原材料コード'],
      資材名: r['資材名'],
      最新単価: r['最新単価'],
      メディア区分: r['メディア区分'],
      仕入先URL: r['仕入先URL'],
      発注点: r['発注点'],
      現在庫: r['現在庫'],
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '原材料マスタ')
    XLSX.writeFile(wb, '原材料マスタ.xlsx')
  }

  async function savePriceEdit(code) {
    const val = parseFloat(priceEdit.value)
    if (!isNaN(val) && val >= 0) {
      const currentRow = rows.find((r) => r['原材料コード'] === code)
      const oldPrice   = currentRow ? Number(currentRow['最新単価']) : null
      await supabase.from('T_原材料マスタ').update({ 最新単価: val }).eq('原材料コード', code)
      if (oldPrice !== val) {
        await recordPriceHistory({ code, 資材名: currentRow?.['資材名'] || '', oldPrice, newPrice: val, method: 'インライン編集' })
      }
      fetchData()
    }
    setPriceEdit({ code: null, value: '' })
  }

  const filtered = rows.filter(
    (r) =>
      (r['原材料コード'] || '').includes(search) ||
      (r['資材名'] || '').includes(search)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">原材料マスタ管理</h2>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2.5 rounded text-sm hover:bg-green-700 min-h-[44px]">
            Excel出力
          </button>
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2.5 rounded text-sm hover:bg-blue-700 min-h-[44px]">
            ＋ 追加
          </button>
        </div>
      </div>

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
          {/* ── デスクトップ テーブル ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  {['原材料コード', '資材名', '最新単価', 'メディア区分', '発注点', '現在庫', '操作'].map((h) => (
                    <th key={h} className="border border-gray-200 px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row['原材料コード']} className={`${row['現在庫'] <= row['発注点'] ? 'bg-red-50' : 'bg-white'} hover:bg-gray-50`}>
                    <td className="border border-gray-200 px-3 py-2">{row['原材料コード']}</td>
                    <td className="border border-gray-200 px-3 py-2">{row['資材名']}</td>
                    <td
                      className="border border-gray-200 px-3 py-2 text-right cursor-pointer group"
                      title="クリックして単価を編集"
                      onClick={() => !priceEdit.code && setPriceEdit({ code: row['原材料コード'], value: String(row['最新単価']) })}
                    >
                      {priceEdit.code === row['原材料コード'] ? (
                        <input
                          type="number"
                          value={priceEdit.value}
                          step="0.001"
                          autoFocus
                          className="border border-blue-400 rounded px-1 py-0.5 text-sm w-24 text-right"
                          onChange={(e) => setPriceEdit((p) => ({ ...p, value: e.target.value }))}
                          onBlur={() => savePriceEdit(row['原材料コード'])}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') savePriceEdit(row['原材料コード'])
                            if (e.key === 'Escape') setPriceEdit({ code: null, value: '' })
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="group-hover:text-blue-600 group-hover:underline">
                          ¥{Math.ceil(Number(row['最新単価'])).toLocaleString()}
                          <span className="ml-1 text-xs text-gray-300 group-hover:text-blue-400">✏</span>
                        </span>
                      )}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">{row['メディア区分']}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right">{row['発注点']}</td>
                    <td className={`border border-gray-200 px-3 py-2 text-right font-semibold ${row['現在庫'] <= row['発注点'] ? 'text-red-600' : ''}`}>
                      {row['現在庫']}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 whitespace-nowrap">
                      <button onClick={() => openEdit(row)} className="text-blue-600 hover:underline mr-3 text-xs">編集</button>
                      <button onClick={() => handleDelete(row['原材料コード'])} className="text-red-500 hover:underline text-xs">削除</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── モバイル カード ── */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 && (
              <p className="text-center py-8 text-gray-400">データがありません</p>
            )}
            {filtered.map((row) => {
              const isLow = row['現在庫'] <= row['発注点']
              return (
                <div key={row['原材料コード']} className={`border rounded-lg p-4 ${isLow ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">{row['資材名']}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{row['原材料コード']}</p>
                    </div>
                    {isLow && (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full shrink-0 ml-2">発注点以下</span>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-3">
                    <div>
                      <dt className="text-xs text-gray-500">最新単価</dt>
                      <dd className="font-medium">¥{Math.ceil(Number(row['最新単価'])).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">メディア区分</dt>
                      <dd>{row['メディア区分'] || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">現在庫</dt>
                      <dd className={`font-semibold ${isLow ? 'text-red-600' : ''}`}>{row['現在庫']}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">発注点</dt>
                      <dd>{row['発注点']}</dd>
                    </div>
                  </dl>
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button onClick={() => openEdit(row)} className="flex-1 py-2.5 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 min-h-[44px]">編集</button>
                    <button onClick={() => handleDelete(row['原材料コード'])} className="flex-1 py-2.5 text-sm text-red-500 border border-red-200 rounded hover:bg-red-50 min-h-[44px]">削除</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full rounded-t-2xl md:rounded-lg md:max-w-lg shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="p-5">
              <h3 className="font-bold text-gray-800 mb-4">{editKey ? '原材料編集' : '原材料追加'}</h3>
              <div className="space-y-3">
                {[
                  { key: '原材料コード', type: 'text', disabled: !!editKey },
                  { key: '資材名', type: 'text' },
                  { key: '最新単価', type: 'number' },
                  { key: 'メディア区分', type: 'text' },
                  { key: '発注点', type: 'number' },
                  { key: '現在庫', type: 'number' },
                ].map(({ key, type, disabled }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{key}</label>
                    <input
                      type={type}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      disabled={disabled}
                      className="border border-gray-300 rounded px-3 py-2.5 text-base w-full disabled:bg-gray-100"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">仕入先URL</label>
                  <input
                    type="text"
                    value={form['仕入先URL']}
                    onChange={(e) => setForm({ ...form, '仕入先URL': e.target.value })}
                    className="border border-gray-300 rounded px-3 py-2.5 text-base w-full"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 text-sm border border-gray-300 rounded hover:bg-gray-50 min-h-[44px]">キャンセル</button>
                <button onClick={handleSave} className="flex-1 py-3 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 min-h-[44px]">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
