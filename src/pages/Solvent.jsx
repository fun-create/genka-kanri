import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Solvent() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ 溶剤名: '', 最新単価: '' })
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('T_溶剤マスタ').select('*')
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function openAdd() { setForm({ 溶剤名: '', 最新単価: '' }); setEditId(null); setShowForm(true) }
  function openEdit(row) {
    setForm({ 溶剤名: row['溶剤名'], 最新単価: String(row['最新単価']) })
    setEditId(row.id)
    setShowForm(true)
  }

  async function handleSave() {
    const payload = { 溶剤名: form['溶剤名'], 最新単価: Number(form['最新単価']) }
    if (editId) {
      await supabase.from('T_溶剤マスタ').update(payload).eq('id', editId)
    } else {
      await supabase.from('T_溶剤マスタ').insert(payload)
    }
    setShowForm(false)
    fetchData()
  }

  async function handleDelete(id, name) {
    if (!confirm(`「${name}」を削除しますか？`)) return
    await supabase.from('T_溶剤マスタ').delete().eq('id', id)
    fetchData()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">溶剤マスタ管理</h2>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">＋ 追加</button>
      </div>

      {loading ? <p className="text-gray-500">読み込み中...</p> : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              {['溶剤名', '最新単価（円）', '操作'].map((h) => (
                <th key={h} className="border border-gray-200 px-3 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="bg-white hover:bg-gray-50">
                <td className="border border-gray-200 px-3 py-2">{row['溶剤名']}</td>
                <td className="border border-gray-200 px-3 py-2 text-right">¥{Number(row['最新単価']).toLocaleString()}</td>
                <td className="border border-gray-200 px-3 py-2">
                  <button onClick={() => openEdit(row)} className="text-blue-600 hover:underline mr-3 text-xs">編集</button>
                  <button onClick={() => handleDelete(row.id, row['溶剤名'])} className="text-red-500 hover:underline text-xs">削除</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="text-center py-8 text-gray-400">データがありません</td></tr>
            )}
          </tbody>
        </table>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-gray-800 mb-4">{editId ? '溶剤編集' : '溶剤追加'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">溶剤名</label>
                <input type="text" value={form['溶剤名']} onChange={(e) => setForm({ ...form, 溶剤名: e.target.value })}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">最新単価（円）</label>
                <input type="number" value={form['最新単価']} onChange={(e) => setForm({ ...form, 最新単価: e.target.value })}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">キャンセル</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
