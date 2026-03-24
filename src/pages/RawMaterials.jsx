import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('T_原材料マスタ').select('*').order('原材料コード')
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function openAdd() {
    setForm(emptyForm)
    setEditKey(null)
    setShowForm(true)
  }

  function openEdit(row) {
    setForm({ ...row, 最新単価: String(row['最新単価']), 発注点: String(row['発注点']), 現在庫: String(row['現在庫']) })
    setEditKey(row['原材料コード'])
    setShowForm(true)
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
      await supabase.from('T_原材料マスタ').update(payload).eq('原材料コード', editKey)
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

  const filtered = rows.filter(
    (r) =>
      r['原材料コード'].includes(search) ||
      r['資材名'].includes(search)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">原材料マスタ管理</h2>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          ＋ 追加
        </button>
      </div>

      <input
        type="text"
        placeholder="コード・資材名で検索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm mb-4 w-72"
      />

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <div className="overflow-x-auto">
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
                <tr
                  key={row['原材料コード']}
                  className={`${row['現在庫'] <= row['発注点'] ? 'bg-red-50' : 'bg-white'} hover:bg-gray-50`}
                >
                  <td className="border border-gray-200 px-3 py-2">{row['原材料コード']}</td>
                  <td className="border border-gray-200 px-3 py-2">{row['資材名']}</td>
                  <td className="border border-gray-200 px-3 py-2 text-right">¥{Number(row['最新単価']).toLocaleString()}</td>
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
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
            <h3 className="font-bold text-gray-800 mb-4">{editKey ? '原材料編集' : '原材料追加'}</h3>
            <div className="grid grid-cols-2 gap-3">
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
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full disabled:bg-gray-100"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">仕入先URL</label>
                <input
                  type="text"
                  value={form['仕入先URL']}
                  onChange={(e) => setForm({ ...form, '仕入先URL': e.target.value })}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
                />
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
