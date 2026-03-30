import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

const emptyForm = { 工程コード: '', 商品名: '', ポジション名: '', '人件費_1個': '' }

export default function Process() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('T_工程マスタ').select('*').order('工程コード')
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const filtered = rows.filter((r) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      String(r['工程コード'] || '').toLowerCase().includes(s) ||
      String(r['商品名'] || '').toLowerCase().includes(s) ||
      String(r['ポジション名'] || '').toLowerCase().includes(s)
    )
  })

  function openAdd() { setForm(emptyForm); setEditId(null); setShowForm(true) }
  function openEdit(row) {
    setForm({
      工程コード: row['工程コード'] || '',
      商品名: row['商品名'] || '',
      ポジション名: row['ポジション名'] || '',
      '人件費_1個': String(row['人件費_1個'] ?? ''),
    })
    setEditId(row.id)
    setShowForm(true)
  }

  async function handleSave() {
    const payload = {
      工程コード: form['工程コード'],
      商品名: form['商品名'],
      ポジション名: form['ポジション名'],
      '人件費_1個': Number(form['人件費_1個']),
    }
    if (editId) {
      await supabase.from('T_工程マスタ').update(payload).eq('id', editId)
    } else {
      await supabase.from('T_工程マスタ').insert(payload)
    }
    setShowForm(false)
    fetchData()
  }

  async function handleDelete(id, name) {
    if (!confirm(`「${name}」を削除しますか？`)) return
    await supabase.from('T_工程マスタ').delete().eq('id', id)
    fetchData()
  }

  function exportToExcel() {
    const data = filtered.map((r) => ({
      工程コード: r['工程コード'],
      商品名: r['商品名'],
      ポジション: r['ポジション名'],
      '人件費（1個）': r['人件費_1個'],
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '工程マスタ')
    XLSX.writeFile(wb, '工程マスタ.xlsx')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">工程マスタ管理</h2>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2.5 rounded text-sm hover:bg-green-700 min-h-[44px]">Excel出力</button>
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2.5 rounded text-sm hover:bg-blue-700 min-h-[44px]">＋ 追加</button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="工程コード・商品名・ポジションで絞り込み"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full md:w-80"
        />
      </div>

      {loading ? <p className="text-gray-500">読み込み中...</p> : (
        <>
          {/* デスクトップ テーブル */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  {['工程コード', '商品名', 'ポジション', '人件費（1個）', '操作'].map((h) => (
                    <th key={h} className="border border-gray-200 px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="bg-white hover:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">{row['工程コード']}</td>
                    <td className="border border-gray-200 px-3 py-2">{row['商品名']}</td>
                    <td className="border border-gray-200 px-3 py-2">{row['ポジション名']}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right">¥{Number(row['人件費_1個'] ?? 0).toLocaleString()}</td>
                    <td className="border border-gray-200 px-3 py-2">
                      <button onClick={() => openEdit(row)} className="text-blue-600 hover:underline mr-3 text-xs">編集</button>
                      <button onClick={() => handleDelete(row.id, row['ポジション名'])} className="text-red-500 hover:underline text-xs">削除</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* モバイル カード */}
          <div className="md:hidden space-y-3">
            {filtered.length === 0 && <p className="text-center py-8 text-gray-400">データがありません</p>}
            {filtered.map((row) => (
              <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="mb-2">
                  <p className="text-xs text-gray-500">{row['工程コード']}</p>
                  <p className="font-semibold text-gray-800">{row['商品名']}</p>
                  <p className="text-sm text-gray-600">{row['ポジション名']}</p>
                  <p className="font-bold text-gray-700 mt-1">¥{Number(row['人件費_1個'] ?? 0).toLocaleString()}<span className="text-xs text-gray-400 font-normal ml-0.5">/個</span></p>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => openEdit(row)} className="flex-1 py-2.5 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 min-h-[44px]">編集</button>
                  <button onClick={() => handleDelete(row.id, row['ポジション名'])} className="flex-1 py-2.5 text-sm text-red-500 border border-red-200 rounded hover:bg-red-50 min-h-[44px]">削除</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full rounded-t-2xl md:rounded-lg md:max-w-sm shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="p-5">
              <h3 className="font-bold text-gray-800 mb-4">{editId ? '工程編集' : '工程追加'}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">工程コード</label>
                  <input type="text" value={form['工程コード']} onChange={(e) => setForm({ ...form, 工程コード: e.target.value })}
                    className="border border-gray-300 rounded px-3 py-2.5 text-base w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">商品名</label>
                  <input type="text" value={form['商品名']} onChange={(e) => setForm({ ...form, 商品名: e.target.value })}
                    className="border border-gray-300 rounded px-3 py-2.5 text-base w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ポジション</label>
                  <input type="text" value={form['ポジション名']} onChange={(e) => setForm({ ...form, ポジション名: e.target.value })}
                    className="border border-gray-300 rounded px-3 py-2.5 text-base w-full" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">人件費（1個）</label>
                  <input type="number" value={form['人件費_1個']} onChange={(e) => setForm({ ...form, '人件費_1個': e.target.value })}
                    className="border border-gray-300 rounded px-3 py-2.5 text-base w-full" />
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
