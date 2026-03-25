import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const KUBUN_OPTIONS = ['原材料', 'メディア', '溶剤', '工数', '梱包']
const KUBUN_COLOR = {
  メディア: 'bg-blue-100 text-blue-700',
  溶剤:     'bg-purple-100 text-purple-700',
  原材料:   'bg-green-100 text-green-700',
  工数:     'bg-orange-100 text-orange-700',
  梱包:     'bg-gray-100 text-gray-700',
}
const KUBUN_ORDER = ['メディア', '溶剤', '原材料', '工数', '梱包']
const EMPTY_ADD = { 明細区分: '原材料', コード: '', 名称: '', 単価_snapshot: '', 数量: '' }

export default function BomViewModal({ product, masters, onClose, onTotalUpdated }) {
  const [rows, setRows] = useState([])
  const [loadingBom, setLoadingBom] = useState(true)
  const [saving, setSaving] = useState(false)

  // インライン編集
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // 追加フォーム
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD)

  const { materials, solvents, processes } = masters

  // 原価コード（なければ生成して保存）
  const [genkaCode, setGenkaCode] = useState(product['原価コード'] || null)

  async function ensureGenkaCode() {
    if (genkaCode) return genkaCode
    const newCode = `${product['商品コード']}-${Date.now()}`
    await supabase.from('T_商品マスタ').update({ 原価コード: newCode }).eq('商品コード', product['商品コード'])
    setGenkaCode(newCode)
    return newCode
  }

  async function fetchBom(code) {
    if (!code) { setLoadingBom(false); return }
    const { data } = await supabase.from('T_原価計算明細').select('*').eq('受注ID', code).order('明細区分')
    setRows(data || [])
    setLoadingBom(false)
  }

  useEffect(() => { fetchBom(genkaCode) }, [genkaCode])

  async function refreshAndSync(code) {
    const { data } = await supabase.from('T_原価計算明細').select('*').eq('受注ID', code || genkaCode).order('明細区分')
    const updated = data || []
    setRows(updated)
    const newTotal = updated.reduce((s, r) => s + Number(r['原価']), 0)
    const 本体価格 = Number(product['本体価格']) || 0
    const 原価率 = 本体価格 > 0 ? newTotal / 本体価格 : null
    await supabase.from('T_商品マスタ').update({ 最新総原価: newTotal, 原価率 }).eq('商品コード', product['商品コード'])
    onTotalUpdated(product['商品コード'], newTotal)
  }

  // ── マスタ選択ヘルパー ──
  function getMasterOptions(kubun) {
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

  function applyMasterSelect(value, kubun, setter) {
    if (!value) return
    if (kubun === '原材料' || kubun === 'メディア' || kubun === '梱包') {
      const m = materials.find((m) => m['原材料コード'] === value)
      if (m) setter((f) => ({ ...f, コード: value, 名称: m['資材名'], 単価_snapshot: String(m['最新単価']) }))
    } else if (kubun === '溶剤') {
      const s = solvents.find((s) => s.id === value)
      if (s) setter((f) => ({ ...f, コード: 'SOLVENT', 名称: s['溶剤名'], 単価_snapshot: String(s['最新単価']) }))
    } else if (kubun === '工数') {
      const p = processes.find((p) => p.id === value)
      if (p) setter((f) => ({ ...f, コード: p.id, 名称: p['ポジション名'], 単価_snapshot: String(p['分単価']) }))
    }
  }

  function getMasterValue(form) {
    if (form.明細区分 === '溶剤') return solvents.find((s) => s['溶剤名'] === form.名称)?.id || ''
    return form.コード || ''
  }

  // ── 編集 ──
  function startEdit(row) {
    setEditingId(row.id)
    setEditForm({
      明細区分: row['明細区分'] || '原材料',
      コード: row['コード'] || '',
      名称: row['名称'] || '',
      単価_snapshot: String(row['単価_snapshot'] ?? ''),
      数量: String(row['数量'] ?? ''),
    })
  }

  async function saveEdit() {
    if (!editForm.名称 || !editForm.数量) { alert('名称と数量は必須です'); return }
    setSaving(true)
    const 単価 = parseFloat(editForm.単価_snapshot) || 0
    const 数量 = parseFloat(editForm.数量) || 0
    await supabase.from('T_原価計算明細').update({
      明細区分: editForm.明細区分,
      コード: editForm.コード,
      名称: editForm.名称,
      単価_snapshot: 単価,
      数量,
      原価: 単価 * 数量,
    }).eq('id', editingId)
    setEditingId(null)
    await refreshAndSync()
    setSaving(false)
  }

  // ── 削除 ──
  async function handleDelete(id) {
    if (!confirm('この明細を削除しますか？')) return
    await supabase.from('T_原価計算明細').delete().eq('id', id)
    await refreshAndSync()
  }

  // ── 追加 ──
  async function handleAdd() {
    if (!addForm.名称 || !addForm.数量) { alert('名称と数量は必須です'); return }
    setSaving(true)
    const code = await ensureGenkaCode()
    const 単価 = parseFloat(addForm.単価_snapshot) || 0
    const 数量 = parseFloat(addForm.数量) || 0
    await supabase.from('T_原価計算明細').insert({
      受注ID: code,
      明細区分: addForm.明細区分,
      コード: addForm.コード,
      名称: addForm.名称,
      単価_snapshot: 単価,
      数量,
      原価: 単価 * 数量,
    })
    setAddForm(EMPTY_ADD)
    setShowAdd(false)
    await refreshAndSync(code)
    setSaving(false)
  }

  // ── 集計 ──
  const totalCost = rows.reduce((s, r) => s + Number(r['原価']), 0)
  const kubunMap = {}
  for (const r of rows) {
    const k = r['明細区分'] || '不明'
    if (!kubunMap[k]) kubunMap[k] = 0
    kubunMap[k] += Number(r['原価'])
  }
  const sortedKubun = KUBUN_ORDER.filter((k) => kubunMap[k] !== undefined)
    .concat(Object.keys(kubunMap).filter((k) => !KUBUN_ORDER.includes(k)))

  const addFormCost = (parseFloat(addForm.単価_snapshot) || 0) * (parseFloat(addForm.数量) || 0)
  const editFormCost = (parseFloat(editForm.単価_snapshot) || 0) * (parseFloat(editForm.数量) || 0)
  const addMasterOptions = getMasterOptions(addForm.明細区分)
  const editMasterOptions = editingId ? getMasterOptions(editForm.明細区分) : []

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl shadow-xl flex flex-col max-h-[90vh]">

        {/* ヘッダー */}
        <div className="p-5 border-b border-gray-200 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400">{product['商品コード']}</p>
              <h3 className="font-bold text-gray-800 text-lg">{product['商品名']} — BOM明細</h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">最新総原価</p>
              <p className="text-xl font-bold text-blue-600">
                ¥{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* 区分別サマリー */}
          {sortedKubun.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {sortedKubun.map((k) => (
                <div key={k} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${KUBUN_COLOR[k] || 'bg-gray-100 text-gray-600'}`}>
                    {k}
                  </span>
                  <span className="text-xs font-medium text-gray-700">
                    ¥{kubunMap[k].toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ボディ */}
        <div className="overflow-y-auto flex-1 p-5">
          {loadingBom ? (
            <p className="text-gray-400 text-sm text-center py-6">読み込み中...</p>
          ) : (
            <>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-xs">
                    {['明細区分', 'コード', '名称', '単価', '数量', '原価', '操作'].map((h) => (
                      <th key={h} className="border border-gray-200 px-2 py-2 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-gray-400 border border-gray-200">
                        明細データがありません
                      </td>
                    </tr>
                  )}
                  {rows.map((row) =>
                    editingId === row.id ? (
                      /* ── インライン編集行 ── */
                      <tr key={row.id} className="bg-blue-50">
                        <td className="border border-gray-200 px-2 py-1.5">
                          <select value={editForm.明細区分}
                            onChange={(e) => {
                              setEditForm({ ...EMPTY_ADD, 明細区分: e.target.value })
                            }}
                            className="border border-gray-300 rounded px-1 py-1 text-xs w-24">
                            {KUBUN_OPTIONS.map((k) => <option key={k}>{k}</option>)}
                          </select>
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5" colSpan={2}>
                          {editMasterOptions.length > 0 ? (
                            <select
                              value={getMasterValue(editForm)}
                              onChange={(e) => applyMasterSelect(e.target.value, editForm.明細区分, setEditForm)}
                              className="border border-gray-300 rounded px-1 py-1 text-xs w-full mb-1">
                              <option value="">マスタから選択</option>
                              {editMasterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          ) : null}
                          <input type="text" value={editForm.名称}
                            onChange={(e) => setEditForm((f) => ({ ...f, 名称: e.target.value }))}
                            placeholder="名称 *"
                            className="border border-gray-300 rounded px-1 py-1 text-xs w-full" />
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5">
                          <input type="number" value={editForm.単価_snapshot} step="0.001"
                            onChange={(e) => setEditForm((f) => ({ ...f, 単価_snapshot: e.target.value }))}
                            className="border border-gray-300 rounded px-1 py-1 text-xs w-20 text-right" />
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5">
                          <input type="number" value={editForm.数量} step="0.001"
                            onChange={(e) => setEditForm((f) => ({ ...f, 数量: e.target.value }))}
                            className="border border-gray-300 rounded px-1 py-1 text-xs w-20 text-right" />
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 text-right text-xs font-medium text-blue-700">
                          ¥{editFormCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 whitespace-nowrap">
                          <button onClick={saveEdit} disabled={saving}
                            className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 mr-1 disabled:opacity-50">
                            保存
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="text-xs text-gray-500 hover:text-gray-700">
                            取消
                          </button>
                        </td>
                      </tr>
                    ) : (
                      /* ── 通常表示行 ── */
                      <tr key={row.id} className="bg-white hover:bg-gray-50">
                        <td className="border border-gray-200 px-2 py-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${KUBUN_COLOR[row['明細区分']] || 'bg-gray-100 text-gray-600'}`}>
                            {row['明細区分']}
                          </span>
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 text-xs text-gray-500">{row['コード']}</td>
                        <td className="border border-gray-200 px-2 py-1.5">{row['名称']}</td>
                        <td className="border border-gray-200 px-2 py-1.5 text-right">
                          ¥{Number(row['単価_snapshot']).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 text-right">
                          {Number(row['数量']).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 text-right font-medium">
                          ¥{Number(row['原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="border border-gray-200 px-2 py-1.5 whitespace-nowrap">
                          <button onClick={() => startEdit(row)}
                            className="text-blue-600 hover:underline text-xs mr-2">
                            編集
                          </button>
                          <button onClick={() => handleDelete(row.id)}
                            className="text-red-500 hover:underline text-xs">
                            削除
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>

              {/* ── 追加フォーム ── */}
              {showAdd ? (
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">明細追加</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">明細区分</label>
                      <select value={addForm.明細区分}
                        onChange={(e) => setAddForm({ ...EMPTY_ADD, 明細区分: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full">
                        {KUBUN_OPTIONS.map((k) => <option key={k}>{k}</option>)}
                      </select>
                    </div>
                    {addMasterOptions.length > 0 && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          {addForm.明細区分 === '工数' ? 'ポジション' : 'マスタから選択'}
                        </label>
                        <select
                          value={getMasterValue(addForm)}
                          onChange={(e) => applyMasterSelect(e.target.value, addForm.明細区分, setAddForm)}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full">
                          <option value="">選択してください</option>
                          {addMasterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">名称 *</label>
                        <input type="text" value={addForm.名称}
                          onChange={(e) => setAddForm((f) => ({ ...f, 名称: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">単価</label>
                        <input type="number" value={addForm.単価_snapshot} step="0.001"
                          onChange={(e) => setAddForm((f) => ({ ...f, 単価_snapshot: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">数量 *</label>
                        <input type="number" value={addForm.数量} step="0.001"
                          onChange={(e) => setAddForm((f) => ({ ...f, 数量: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm text-blue-600 font-medium">
                        原価: ¥{addFormCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => { setShowAdd(false); setAddForm(EMPTY_ADD) }}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
                          取消
                        </button>
                        <button onClick={handleAdd} disabled={saving}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                          {saving ? '保存中...' : '保存'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setShowAdd(true); setAddForm(EMPTY_ADD) }}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 hover:underline">
                  ＋ 明細追加
                </button>
              )}
            </>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center shrink-0">
          <div className="text-sm text-gray-500">
            {rows.length} 件　合計原価:
            <span className="font-bold text-gray-800 ml-1">
              ¥{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
