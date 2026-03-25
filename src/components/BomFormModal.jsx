import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const KUBUN_OPTIONS = ['原材料', 'メディア', '溶剤', '工数', '梱包']

export default function BomFormModal({ 原価コード, editRow, onSave, onClose }) {
  const [form, setForm] = useState({
    明細区分: editRow?.['明細区分'] || '原材料',
    コード: editRow?.['コード'] || '',
    名称: editRow?.['名称'] || '',
    単価_snapshot: editRow != null ? String(editRow['単価_snapshot'] ?? '') : '',
    数量: editRow != null ? String(editRow['数量'] ?? '') : '',
  })
  const [materials, setMaterials] = useState([])
  const [solvents, setSolvents] = useState([])
  const [processes, setProcesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchMasters() {
      const [matRes, solRes, procRes] = await Promise.all([
        supabase.from('T_原材料マスタ').select('原材料コード, 資材名, 最新単価, メディア区分').order('資材名'),
        supabase.from('T_溶剤マスタ').select('*'),
        supabase.from('T_工程マスタ').select('id, ポジション名, 分単価').order('ポジション名'),
      ])
      setMaterials(matRes.data || [])
      setSolvents(solRes.data || [])
      setProcesses(procRes.data || [])
      setLoading(false)
    }
    fetchMasters()
  }, [])

  const computed原価 = (parseFloat(form.単価_snapshot) || 0) * (parseFloat(form.数量) || 0)

  function handleKubunChange(kubun) {
    setForm((f) => ({ ...f, 明細区分: kubun, コード: '', 名称: '', 単価_snapshot: '' }))
  }

  function handleMasterSelect(value) {
    if (!value) return
    const kubun = form.明細区分
    if (kubun === '原材料' || kubun === 'メディア' || kubun === '梱包') {
      const mat = materials.find((m) => m['原材料コード'] === value)
      if (mat) setForm((f) => ({ ...f, コード: value, 名称: mat['資材名'], 単価_snapshot: String(mat['最新単価']) }))
    } else if (kubun === '溶剤') {
      const sol = solvents.find((s) => s.id === value)
      if (sol) setForm((f) => ({ ...f, コード: 'SOLVENT', 名称: sol['溶剤名'], 単価_snapshot: String(sol['最新単価']) }))
    } else if (kubun === '工数') {
      const proc = processes.find((p) => p.id === value)
      if (proc) setForm((f) => ({ ...f, コード: proc.id, 名称: proc['ポジション名'], 単価_snapshot: String(proc['分単価']) }))
    }
  }

  function getMasterValue() {
    const kubun = form.明細区分
    if (kubun === '溶剤') return solvents.find((s) => s['溶剤名'] === form.名称)?.id || ''
    return form.コード
  }

  function getMasterOptions() {
    const kubun = form.明細区分
    if (kubun === '原材料' || kubun === '梱包')
      return materials.map((m) => ({ value: m['原材料コード'], label: `${m['原材料コード']} - ${m['資材名']}` }))
    if (kubun === 'メディア')
      return materials.filter((m) => m['メディア区分']).map((m) => ({ value: m['原材料コード'], label: `${m['原材料コード']} - ${m['資材名']}` }))
    if (kubun === '溶剤')
      return solvents.map((s) => ({ value: s.id, label: s['溶剤名'] }))
    if (kubun === '工数')
      return processes.map((p) => ({ value: p.id, label: p['ポジション名'] }))
    return []
  }

  async function handleSave() {
    if (!form.名称 || !form.数量) { alert('名称と数量は必須です'); return }
    setSaving(true)
    const payload = {
      受注ID: 原価コード,
      明細区分: form.明細区分,
      コード: form.コード,
      名称: form.名称,
      単価_snapshot: parseFloat(form.単価_snapshot) || 0,
      数量: parseFloat(form.数量) || 0,
      原価: computed原価,
    }
    let error
    if (editRow) {
      ;({ error } = await supabase.from('T_原価計算明細').update(payload).eq('id', editRow.id))
    } else {
      ;({ error } = await supabase.from('T_原価計算明細').insert(payload))
    }
    if (error) { alert('保存に失敗しました: ' + error.message); setSaving(false); return }
    onSave()
  }

  const masterOptions = getMasterOptions()

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="font-bold text-gray-800 mb-4">{editRow ? 'BOM明細編集' : 'BOM明細追加'}</h3>
        {loading ? (
          <p className="text-gray-400 text-sm py-4 text-center">マスタ読み込み中...</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">明細区分</label>
              <select value={form.明細区分} onChange={(e) => handleKubunChange(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full">
                {KUBUN_OPTIONS.map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>
            {masterOptions.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {form.明細区分 === '工数' ? 'ポジション' : 'マスタから選択'}
                </label>
                <select value={getMasterValue()} onChange={(e) => handleMasterSelect(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full">
                  <option value="">選択してください</option>
                  {masterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">コード</label>
                <input type="text" value={form.コード}
                  onChange={(e) => setForm((f) => ({ ...f, コード: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">名称 *</label>
                <input type="text" value={form.名称}
                  onChange={(e) => setForm((f) => ({ ...f, 名称: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">単価（Snapshot）</label>
                <input type="number" value={form.単価_snapshot} step="0.001"
                  onChange={(e) => setForm((f) => ({ ...f, 単価_snapshot: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">数量 *</label>
                <input type="number" value={form.数量} step="0.001"
                  onChange={(e) => setForm((f) => ({ ...f, 数量: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 flex justify-between">
              <span className="text-sm text-blue-700 font-medium">原価（自動計算）</span>
              <span className="text-base font-bold text-blue-700">
                ¥{computed原価.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">キャンセル</button>
          <button onClick={handleSave} disabled={saving || loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
