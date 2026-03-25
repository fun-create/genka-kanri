import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const emptyForm = { 原材料コード: '', 区分: '入庫', 数量: '', 備考: '' }

export default function InventoryRegister() {
  const [materials, setMaterials] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [recentHistory, setRecentHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const [matRes, histRes] = await Promise.all([
        supabase.from('T_原材料マスタ').select('原材料コード, 資材名, 現在庫').order('資材名'),
        supabase.from('T_在庫履歴').select('*, T_原材料マスタ(資材名)').order('日時', { ascending: false }).limit(20),
      ])
      setMaterials(matRes.data || [])
      setRecentHistory(histRes.data || [])
      setLoadingHistory(false)
    }
    fetchData()
  }, [])

  const selectedMaterial = materials.find((m) => m['原材料コード'] === form['原材料コード'])

  async function handleSave() {
    if (!form['原材料コード'] || !form['数量']) {
      alert('原材料と数量を入力してください')
      return
    }
    setSaving(true)

    const qty = Number(form['数量'])
    let delta = 0
    if (form['区分'] === '入庫') delta = qty
    else if (form['区分'] === '出庫') delta = -qty
    else delta = qty

    await supabase.from('T_在庫履歴').insert({
      原材料コード: form['原材料コード'],
      区分: form['区分'],
      数量: qty,
      備考: form['備考'],
    })

    if (form['区分'] === '調整') {
      await supabase.from('T_原材料マスタ').update({ 現在庫: qty }).eq('原材料コード', form['原材料コード'])
    } else {
      const current = Number(selectedMaterial?.['現在庫'] ?? 0)
      await supabase.from('T_原材料マスタ').update({ 現在庫: current + delta }).eq('原材料コード', form['原材料コード'])
    }

    const [matRes, histRes] = await Promise.all([
      supabase.from('T_原材料マスタ').select('原材料コード, 資材名, 現在庫').order('資材名'),
      supabase.from('T_在庫履歴').select('*, T_原材料マスタ(資材名)').order('日時', { ascending: false }).limit(20),
    ])
    setMaterials(matRes.data || [])
    setRecentHistory(histRes.data || [])
    setForm(emptyForm)
    setSaving(false)
    alert('在庫を登録しました')
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">在庫登録</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 登録フォーム */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="font-semibold text-gray-700 mb-4">入出庫登録</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">原材料</label>
              <select value={form['原材料コード']} onChange={(e) => setForm({ ...form, 原材料コード: e.target.value })}
                className="border border-gray-300 rounded px-3 py-2.5 text-base w-full">
                <option value="">選択してください</option>
                {materials.map((m) => (
                  <option key={m['原材料コード']} value={m['原材料コード']}>
                    {m['資材名']}（現在庫: {m['現在庫']}）
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">区分</label>
              <div className="flex gap-4">
                {['入庫', '出庫', '調整'].map((k) => (
                  <label key={k} className="flex items-center gap-2 text-base cursor-pointer min-h-[44px]">
                    <input
                      type="radio"
                      name="kbn"
                      value={k}
                      checked={form['区分'] === k}
                      onChange={() => setForm({ ...form, 区分: k })}
                      className="w-4 h-4"
                    />
                    {k}
                  </label>
                ))}
              </div>
              {form['区分'] === '調整' && (
                <p className="text-xs text-orange-600 mt-1">※ 調整の場合、現在庫を入力値で上書きします</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {form['区分'] === '調整' ? '調整後数量' : '数量'}
              </label>
              <input type="number" value={form['数量']} onChange={(e) => setForm({ ...form, 数量: e.target.value })}
                className="border border-gray-300 rounded px-3 py-2.5 text-base w-full" min="0" />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">備考</label>
              <input type="text" value={form['備考']} onChange={(e) => setForm({ ...form, 備考: e.target.value })}
                className="border border-gray-300 rounded px-3 py-2.5 text-base w-full"
                placeholder="任意" />
            </div>

            {selectedMaterial && form['数量'] && form['区分'] !== '調整' && (
              <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2.5 text-sm">
                <span className="text-blue-700">
                  {selectedMaterial['資材名']}：現在庫 {selectedMaterial['現在庫']} →{' '}
                  {form['区分'] === '入庫'
                    ? Number(selectedMaterial['現在庫']) + Number(form['数量'])
                    : Number(selectedMaterial['現在庫']) - Number(form['数量'])}
                </span>
              </div>
            )}

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-blue-600 text-white py-3 rounded text-base hover:bg-blue-700 disabled:opacity-50 font-medium min-h-[44px]">
              {saving ? '登録中...' : '登録する'}
            </button>
          </div>
        </div>

        {/* 最近の履歴 */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="font-semibold text-gray-700 mb-4">最近の履歴（直近20件）</h3>
          {loadingHistory ? (
            <p className="text-gray-500 text-sm">読み込み中...</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentHistory.length === 0 && (
                <p className="text-center py-6 text-gray-400 text-sm">履歴がありません</p>
              )}
              {recentHistory.map((h) => (
                <div key={h.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {h['T_原材料マスタ']?.['資材名'] || h['原材料コード']}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(h['日時']).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      h['区分'] === '入庫' ? 'bg-blue-100 text-blue-700' :
                      h['区分'] === '出庫' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{h['区分']}</span>
                    <span className="font-bold text-gray-800 text-sm">{h['数量']}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
