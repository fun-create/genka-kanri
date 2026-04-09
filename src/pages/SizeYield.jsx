import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const emptyForm = { 製品名: '', 面積m2: '', メディア取得係数: '', 溶剤取得係数: '' }

export default function SizeYield() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('T_サイズ歩留まりマスタ').select('*').order('製品名')
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function openAdd() { setForm(emptyForm); setEditId(null); setShowForm(true) }
  function openEdit(row) {
    setForm({ 製品名: row['製品名'], 面積m2: String(row['面積m2']), メディア取得係数: String(row['メディア取得係数']), 溶剤取得係数: String(row['溶剤取得係数']) })
    setEditId(row.id)
    setShowForm(true)
  }

  async function handleSave() {
    const payload = {
      製品名: form['製品名'],
      面積m2: Number(form['面積m2']),
      メディア取得係数: Number(form['メディア取得係数']),
      溶剤取得係数: Number(form['溶剤取得係数']),
    }
    if (editId) {
      await supabase.from('T_サイズ歩留まりマスタ').update(payload).eq('id', editId)
    } else {
      await supabase.from('T_サイズ歩留まりマスタ').insert(payload)
    }
    setShowForm(false)
    fetchData()
  }

  async function handleDelete(id, name) {
    if (!confirm(`「${name}」を削除しますか？`)) return
    await supabase.from('T_サイズ歩留まりマスタ').delete().eq('id', id)
    fetchData()
  }

  const fields = [
    { key: '製品名', type: 'text' },
    { key: '面積m2', type: 'number' },
    { key: 'メディア取得係数', type: 'number' },
    { key: '溶剤取得係数', type: 'number' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">サイズ歩留まりマスタ</h2>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2.5 rounded text-sm hover:bg-blue-700 min-h-[44px]">
          ＋ 追加
        </button>
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
                  {['製品名', '面積(m²)', 'メディア単価', '溶剤単価', 'メディア取得係数', '溶剤取得係数', '操作'].map((h) => (
                    <th key={h} className="border border-gray-200 px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="bg-white hover:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">{row['製品名']}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right">{row['面積m2']}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right">¥{Math.ceil(Number(row['メディア単価'] || 0)).toLocaleString()}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right">¥{Math.ceil(Number(row['溶剤単価'] || 0)).toLocaleString()}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right">{row['メディア取得係数']}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right">{row['溶剤取得係数']}</td>
                    <td className="border border-gray-200 px-3 py-2">
                      <button onClick={() => openEdit(row)} className="text-blue-600 hover:underline mr-3 text-xs">編集</button>
                      <button onClick={() => handleDelete(row.id, row['製品名'])} className="text-red-500 hover:underline text-xs">削除</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* モバイル カード */}
          <div className="md:hidden space-y-3">
            {rows.length === 0 && <p className="text-center py-8 text-gray-400">データがありません</p>}
            {rows.map((row) => (
              <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="font-semibold text-gray-800 mb-3">{row['製品名']}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-3">
                  <div>
                    <dt className="text-xs text-gray-500">面積(m²)</dt>
                    <dd className="font-medium">{row['面積m2']}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">メディア単価</dt>
                    <dd className="font-medium">¥{Math.ceil(Number(row['メディア単価'] || 0)).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">溶剤単価</dt>
                    <dd className="font-medium">¥{Math.ceil(Number(row['溶剤単価'] || 0)).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">メディア取得係数</dt>
                    <dd>{row['メディア取得係数']}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">溶剤取得係数</dt>
                    <dd>{row['溶剤取得係数']}</dd>
                  </div>
                </dl>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => openEdit(row)} className="flex-1 py-2.5 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 min-h-[44px]">編集</button>
                  <button onClick={() => handleDelete(row.id, row['製品名'])} className="flex-1 py-2.5 text-sm text-red-500 border border-red-200 rounded hover:bg-red-50 min-h-[44px]">削除</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full rounded-t-2xl md:rounded-lg md:max-w-md shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="p-5">
              <h3 className="font-bold text-gray-800 mb-4">{editId ? '編集' : '追加'}</h3>
              <div className="space-y-3">
                {fields.map(({ key, type }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{key}</label>
                    <input
                      type={type}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="border border-gray-300 rounded px-3 py-2.5 text-base w-full"
                    />
                  </div>
                ))}
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
