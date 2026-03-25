import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const KUBUN_OPTIONS = ['原材料', 'メディア', '溶剤', '工数', '梱包']
const KUBUN_COLOR = {
  メディア: 'bg-blue-100 text-blue-700',
  溶剤: 'bg-purple-100 text-purple-700',
  原材料: 'bg-green-100 text-green-700',
  工数: 'bg-orange-100 text-orange-700',
  梱包: 'bg-gray-100 text-gray-700',
}

const EMPTY_SUB = { 明細区分: '原材料', コード: '', 名称: '', 単価_snapshot: '', 数量: '' }

export default function ProductWizard({ onClose, onSaved }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [info, setInfo] = useState({ 商品コード: '', 商品名: '', ポジション: '', 本体価格: '' })

  // Step 2
  const [bomItems, setBomItems] = useState([])
  const [masters, setMasters] = useState({ materials: [], solvents: [], processes: [] })
  const [mastersLoaded, setMastersLoaded] = useState(false)
  const [subForm, setSubForm] = useState(EMPTY_SUB)
  const [positions, setPositions] = useState([])

  useEffect(() => {
    async function fetchMasters() {
      const [matRes, solRes, procRes, prodRes] = await Promise.all([
        supabase.from('T_原材料マスタ').select('原材料コード, 資材名, 最新単価, メディア区分').order('資材名'),
        supabase.from('T_溶剤マスタ').select('*'),
        supabase.from('T_工程マスタ').select('id, ポジション名, 分単価').order('ポジション名'),
        supabase.from('T_商品マスタ').select('ポジション'),
      ])
      setMasters({ materials: matRes.data || [], solvents: solRes.data || [], processes: procRes.data || [] })
      const pos = [...new Set((prodRes.data || []).map((r) => r['ポジション']).filter(Boolean))].sort()
      setPositions(pos)
      setMastersLoaded(true)
    }
    fetchMasters()
  }, [])

  function getMasterOptions(kubun) {
    const { materials, solvents, processes } = masters
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

  function handleSubKubunChange(kubun) {
    setSubForm({ ...EMPTY_SUB, 明細区分: kubun })
  }

  function handleSubMasterSelect(value) {
    if (!value) return
    const { materials, solvents, processes } = masters
    const kubun = subForm.明細区分
    if (kubun === '原材料' || kubun === 'メディア' || kubun === '梱包') {
      const mat = materials.find((m) => m['原材料コード'] === value)
      if (mat) setSubForm((f) => ({ ...f, コード: value, 名称: mat['資材名'], 単価_snapshot: String(mat['最新単価']) }))
    } else if (kubun === '溶剤') {
      const sol = solvents.find((s) => s.id === value)
      if (sol) setSubForm((f) => ({ ...f, コード: 'SOLVENT', 名称: sol['溶剤名'], 単価_snapshot: String(sol['最新単価']) }))
    } else if (kubun === '工数') {
      const proc = processes.find((p) => p.id === value)
      if (proc) setSubForm((f) => ({ ...f, コード: proc.id, 名称: proc['ポジション名'], 単価_snapshot: String(proc['分単価']) }))
    }
  }

  function getSubMasterValue() {
    if (subForm.明細区分 === '溶剤') return masters.solvents.find((s) => s['溶剤名'] === subForm.名称)?.id || ''
    return subForm.コード
  }

  function addBomItem() {
    if (!subForm.名称 || !subForm.数量) { alert('名称と数量は必須です'); return }
    const 原価 = (parseFloat(subForm.単価_snapshot) || 0) * (parseFloat(subForm.数量) || 0)
    setBomItems((items) => [
      ...items,
      { ...subForm, 単価_snapshot: parseFloat(subForm.単価_snapshot) || 0, 数量: parseFloat(subForm.数量) || 0, 原価, _tempId: Date.now() },
    ])
    setSubForm({ ...EMPTY_SUB, 明細区分: subForm.明細区分 })
  }

  function removeBomItem(tempId) {
    setBomItems((items) => items.filter((i) => i._tempId !== tempId))
  }

  const subFormCost = (parseFloat(subForm.単価_snapshot) || 0) * (parseFloat(subForm.数量) || 0)
  const totalBomCost = bomItems.reduce((sum, i) => sum + i.原価, 0)
  const subMasterOptions = getMasterOptions(subForm.明細区分)

  function goNext() {
    if (step === 1) {
      if (!info.商品コード.trim() || !info.商品名.trim()) { alert('商品コードと商品名は必須です'); return }
    }
    setStep((s) => s + 1)
  }

  async function handleSave() {
    setSaving(true)
    const 原価コード = `${info.商品コード}-${Date.now()}`
    const 本体価格 = Number(info.本体価格) || null
    const 原価率 = 本体価格 && 本体価格 > 0 ? totalBomCost / 本体価格 : null

    const { error: prodErr } = await supabase.from('T_商品マスタ').insert({
      商品コード: info.商品コード.trim(),
      商品名: info.商品名.trim(),
      ポジション: info.ポジション.trim() || null,
      本体価格,
      最新総原価: totalBomCost,
      原価率,
      原価コード,
    })
    if (prodErr) { alert('商品登録に失敗しました: ' + prodErr.message); setSaving(false); return }

    if (bomItems.length > 0) {
      const payload = bomItems.map((item) => ({
        受注ID: 原価コード,
        明細区分: item.明細区分,
        コード: item.コード,
        名称: item.名称,
        単価_snapshot: item.単価_snapshot,
        数量: item.数量,
        原価: item.原価,
      }))
      const { error: bomErr } = await supabase.from('T_原価計算明細').insert(payload)
      if (bomErr) { alert('BOM明細登録に失敗しました: ' + bomErr.message); setSaving(false); return }
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-5 border-b border-gray-200 shrink-0">
          <h3 className="font-bold text-gray-800 text-lg">新商品登録</h3>
          <div className="flex items-center gap-1 mt-3">
            {[
              { n: 1, label: '基本情報' },
              { n: 2, label: 'BOM明細' },
              { n: 3, label: '確認・保存' },
            ].map(({ n, label }, i, arr) => (
              <div key={n} className="flex items-center gap-1.5">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold shrink-0 ${step >= n ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {step > n ? '✓' : n}
                </div>
                <span className={`text-sm whitespace-nowrap ${step === n ? 'font-semibold text-blue-600' : 'text-gray-400'}`}>{label}</span>
                {i < arr.length - 1 && <div className={`h-0.5 w-6 mx-1 ${step > n ? 'bg-blue-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">商品コード *</label>
                <input type="text" value={info.商品コード}
                  onChange={(e) => setInfo((v) => ({ ...v, 商品コード: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
                  placeholder="例: SKU-001" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">商品名 *</label>
                <input type="text" value={info.商品名}
                  onChange={(e) => setInfo((v) => ({ ...v, 商品名: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
                  placeholder="例: サンプル商品A" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ポジション</label>
                <input type="text" list="wizard-positions" value={info.ポジション}
                  onChange={(e) => setInfo((v) => ({ ...v, ポジション: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                <datalist id="wizard-positions">
                  {positions.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">本体価格（円）</label>
                <input type="number" value={info.本体価格}
                  onChange={(e) => setInfo((v) => ({ ...v, 本体価格: e.target.value }))}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
                  placeholder="例: 1500" />
              </div>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Add form */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">明細追加</h4>
                {!mastersLoaded ? (
                  <p className="text-gray-400 text-sm text-center py-2">マスタ読み込み中...</p>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">明細区分</label>
                      <select value={subForm.明細区分} onChange={(e) => handleSubKubunChange(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full">
                        {KUBUN_OPTIONS.map((k) => <option key={k}>{k}</option>)}
                      </select>
                    </div>
                    {subMasterOptions.length > 0 && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          {subForm.明細区分 === '工数' ? 'ポジション' : 'マスタから選択'}
                        </label>
                        <select value={getSubMasterValue()} onChange={(e) => handleSubMasterSelect(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full">
                          <option value="">選択してください</option>
                          {subMasterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">名称 *</label>
                        <input type="text" value={subForm.名称}
                          onChange={(e) => setSubForm((f) => ({ ...f, 名称: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">単価</label>
                        <input type="number" value={subForm.単価_snapshot} step="0.001"
                          onChange={(e) => setSubForm((f) => ({ ...f, 単価_snapshot: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">数量 *</label>
                        <input type="number" value={subForm.数量} step="0.001"
                          onChange={(e) => setSubForm((f) => ({ ...f, 数量: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm text-blue-600 font-medium">
                        原価: ¥{subFormCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                      <button onClick={addBomItem}
                        className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
                        ＋ 追加
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* BOM list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">追加済み明細（{bomItems.length}件）</h4>
                  <span className="text-sm font-bold text-blue-700">
                    合計: ¥{totalBomCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {bomItems.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4 border border-dashed border-gray-300 rounded">
                    まだ明細が追加されていません
                  </p>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        {['区分', '名称', '単価', '数量', '原価', ''].map((h, i) => (
                          <th key={i} className="border border-gray-200 px-2 py-1.5 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bomItems.map((item) => (
                        <tr key={item._tempId} className="bg-white hover:bg-gray-50">
                          <td className="border border-gray-200 px-2 py-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${KUBUN_COLOR[item.明細区分] || 'bg-gray-100 text-gray-700'}`}>
                              {item.明細区分}
                            </span>
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5">{item.名称}</td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right">
                            ¥{item.単価_snapshot.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right">{item.数量}</td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right font-medium">
                            ¥{item.原価.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-center">
                            <button onClick={() => removeBomItem(item._tempId)}
                              className="text-red-400 hover:text-red-600 text-xs">削除</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">商品情報</h4>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500 mb-0.5">商品コード</dt>
                    <dd className="font-semibold">{info.商品コード}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 mb-0.5">商品名</dt>
                    <dd className="font-semibold">{info.商品名}</dd>
                  </div>
                  {info.ポジション && (
                    <div>
                      <dt className="text-xs text-gray-500 mb-0.5">ポジション</dt>
                      <dd>{info.ポジション}</dd>
                    </div>
                  )}
                  {info.本体価格 && (
                    <div>
                      <dt className="text-xs text-gray-500 mb-0.5">本体価格</dt>
                      <dd>¥{Number(info.本体価格).toLocaleString()}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-700">BOM合計原価</span>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-700">
                    ¥{totalBomCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  {info.本体価格 && Number(info.本体価格) > 0 && (
                    <p className="text-xs text-blue-500 mt-0.5">
                      原価率 {(totalBomCost / Number(info.本体価格) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>

              {bomItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">BOM明細（{bomItems.length}件）</h4>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        {['区分', '名称', '単価', '数量', '原価'].map((h) => (
                          <th key={h} className="border border-gray-200 px-2 py-1.5 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bomItems.map((item) => (
                        <tr key={item._tempId} className="bg-white">
                          <td className="border border-gray-200 px-2 py-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${KUBUN_COLOR[item.明細区分] || 'bg-gray-100 text-gray-700'}`}>
                              {item.明細区分}
                            </span>
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5">{item.名称}</td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right">
                            ¥{item.単価_snapshot.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right">{item.数量}</td>
                          <td className="border border-gray-200 px-2 py-1.5 text-right font-medium">
                            ¥{item.原価.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {bomItems.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-2">BOM明細なし（後から追加可能）</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 flex justify-between shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
            キャンセル
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                ← 戻る
              </button>
            )}
            {step < 3 ? (
              <button onClick={goNext}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                次へ →
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                {saving ? '登録中...' : '登録する'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
