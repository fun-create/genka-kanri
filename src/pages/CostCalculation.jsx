import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import BomViewModal from '../components/BomViewModal'

export default function CostCalculation() {
  const [tab, setTab] = useState('calc')
  const [sizes, setSizes] = useState([])
  const [materials, setMaterials] = useState([])
  const [solvents, setSolvents] = useState([])
  const [processes, setProcesses] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const [calc, setCalc] = useState({
    sizeId: '', materialCode: '', solventId: '', processId: '', printMin: '', productCode: '', productName: '',
  })
  const [result, setResult] = useState(null)

  const [productForm, setProductForm] = useState({ 商品コード: '', 商品名: '', 最新総原価: '' })
  const [editProductKey, setEditProductKey] = useState(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [bomTarget, setBomTarget] = useState(null)

  useEffect(() => {
    async function fetchAll() {
      const [s, m, sv, p, pr] = await Promise.all([
        supabase.from('T_サイズ歩留まりマスタ').select('*').order('製品名'),
        supabase.from('T_原材料マスタ').select('*').order('資材名'),
        supabase.from('T_溶剤マスタ').select('*'),
        supabase.from('T_工程マスタ').select('*').order('ポジション名'),
        supabase.from('T_商品マスタ').select('*').order('商品コード'),
      ])
      setSizes(s.data || [])
      setMaterials(m.data || [])
      setSolvents(sv.data || [])
      setProcesses(p.data || [])
      setProducts(pr.data || [])
      setLoading(false)
    }
    fetchAll()
  }, [])

  function calcCost() {
    const size = sizes.find((s) => s.id === calc.sizeId)
    const mat = materials.find((m) => m['原材料コード'] === calc.materialCode)
    const solvent = solvents.find((s) => s.id === calc.solventId)
    const process = processes.find((p) => p.id === calc.processId)
    if (!size || !mat || !solvent || !process || !calc.printMin) return

    const mediaCost = Number(mat['最新単価']) * Number(size['面積m2']) * Number(size['メディア取得係数'])
    const solventCost = Number(solvent['最新単価']) * Number(size['面積m2']) * Number(size['溶剤取得係数'])
    const processCost = Number(process['分単価']) * Number(calc.printMin)
    const total = mediaCost + solventCost + processCost

    setResult({ mediaCost, solventCost, processCost, total, size, mat, solvent, process })
  }

  async function saveCost() {
    if (!result || !calc.productCode || !calc.productName) return
    await supabase.from('T_商品マスタ').upsert({
      商品コード: calc.productCode,
      商品名: calc.productName,
      最新総原価: result.total,
    })
    const { data: prod } = await supabase.from('T_商品マスタ').select('*').order('商品コード')
    setProducts(prod || [])
    alert('商品マスタに保存しました')
  }

  async function handleProductSave() {
    const payload = {
      商品コード: productForm['商品コード'],
      商品名: productForm['商品名'],
      最新総原価: Number(productForm['最新総原価']),
    }
    if (editProductKey) {
      await supabase.from('T_商品マスタ').update(payload).eq('商品コード', editProductKey)
    } else {
      await supabase.from('T_商品マスタ').insert(payload)
    }
    setShowProductForm(false)
    const { data } = await supabase.from('T_商品マスタ').select('*').order('商品コード')
    setProducts(data || [])
  }

  async function handleProductDelete(code) {
    if (!confirm(`商品コード「${code}」を削除しますか？`)) return
    await supabase.from('T_商品マスタ').delete().eq('商品コード', code)
    const { data } = await supabase.from('T_商品マスタ').select('*').order('商品コード')
    setProducts(data || [])
  }

  if (loading) return <p className="text-gray-500">読み込み中...</p>

  const selectClass = 'border border-gray-300 rounded px-3 py-2.5 text-base md:text-sm w-full'
  const inputClass = 'border border-gray-300 rounded px-3 py-2.5 text-base md:text-sm w-full'

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">原価計算</h2>

      <div className="flex gap-2 mb-5 border-b border-gray-200">
        {[{ key: 'calc', label: '原価計算' }, { key: 'master', label: '商品マスタ' }].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px min-h-[44px] ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calc' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-gray-700 mb-4">計算条件</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">製品サイズ</label>
                <select value={calc.sizeId} onChange={(e) => setCalc({ ...calc, sizeId: e.target.value })} className={selectClass}>
                  <option value="">選択してください</option>
                  {sizes.map((s) => <option key={s.id} value={s.id}>{s['製品名']} ({s['面積m2']}m²)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">原材料（メディア）</label>
                <select value={calc.materialCode} onChange={(e) => setCalc({ ...calc, materialCode: e.target.value })} className={selectClass}>
                  <option value="">選択してください</option>
                  {materials.map((m) => (
                    <option key={m['原材料コード']} value={m['原材料コード']}>
                      {m['資材名']} (¥{Number(m['最新単価']).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">溶剤</label>
                <select value={calc.solventId} onChange={(e) => setCalc({ ...calc, solventId: e.target.value })} className={selectClass}>
                  <option value="">選択してください</option>
                  {solvents.map((s) => <option key={s.id} value={s.id}>{s['溶剤名']} (¥{Number(s['最新単価']).toLocaleString()})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">工程</label>
                <select value={calc.processId} onChange={(e) => setCalc({ ...calc, processId: e.target.value })} className={selectClass}>
                  <option value="">選択してください</option>
                  {processes.map((p) => <option key={p.id} value={p.id}>{p['ポジション名']} (¥{Number(p['分単価']).toLocaleString()}/分)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">印刷時間（分）</label>
                <input type="number" value={calc.printMin} onChange={(e) => setCalc({ ...calc, printMin: e.target.value })}
                  className={inputClass} min="0" />
              </div>
              <button onClick={calcCost}
                className="w-full bg-blue-600 text-white py-3 rounded text-base hover:bg-blue-700 font-medium min-h-[44px]">
                計算する
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-gray-700 mb-4">計算結果</h3>
            {result ? (
              <>
                <table className="w-full text-sm mb-4">
                  <tbody>
                    {[
                      { label: 'メディア原価', value: result.mediaCost },
                      { label: '溶剤原価', value: result.solventCost },
                      { label: '工程原価', value: result.processCost },
                    ].map(({ label, value }) => (
                      <tr key={label} className="border-b border-gray-100">
                        <td className="py-2 text-gray-600">{label}</td>
                        <td className="py-2 text-right font-medium">¥{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 font-bold text-gray-800">総原価</td>
                      <td className="py-2 text-right font-bold text-blue-600 text-lg">
                        ¥{result.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-500 mb-2">商品マスタへ保存</p>
                  <div className="space-y-2 mb-2">
                    <input type="text" placeholder="商品コード" value={calc.productCode}
                      onChange={(e) => setCalc({ ...calc, productCode: e.target.value })}
                      className={inputClass} />
                    <input type="text" placeholder="商品名" value={calc.productName}
                      onChange={(e) => setCalc({ ...calc, productName: e.target.value })}
                      className={inputClass} />
                  </div>
                  <button onClick={saveCost}
                    className="w-full bg-green-600 text-white py-3 rounded text-base hover:bg-green-700 min-h-[44px]">
                    商品マスタに保存
                  </button>
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-sm">左の条件を設定して計算してください</p>
            )}
          </div>
        </div>
      )}

      {tab === 'master' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setProductForm({ 商品コード: '', 商品名: '', 最新総原価: '' }); setEditProductKey(null); setShowProductForm(true) }}
              className="bg-blue-600 text-white px-4 py-2.5 rounded text-sm hover:bg-blue-700 min-h-[44px]">
              ＋ 追加
            </button>
          </div>

          {/* デスクトップ テーブル */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  {['商品コード', '商品名', '最新総原価', '操作'].map((h) => (
                    <th key={h} className="border border-gray-200 px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p['商品コード']} className="bg-white hover:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">{p['商品コード']}</td>
                    <td className="border border-gray-200 px-3 py-2 font-medium">{p['商品名']}</td>
                    <td className="border border-gray-200 px-3 py-2 text-right">
                      ¥{Number(p['最新総原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 whitespace-nowrap">
                      <button onClick={() => setBomTarget(p)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded mr-2">BOM確認</button>
                      <button onClick={() => {
                        setProductForm({ 商品コード: p['商品コード'], 商品名: p['商品名'], 最新総原価: String(p['最新総原価']) })
                        setEditProductKey(p['商品コード'])
                        setShowProductForm(true)
                      }} className="text-blue-600 hover:underline mr-2 text-xs">編集</button>
                      <button onClick={() => handleProductDelete(p['商品コード'])} className="text-red-500 hover:underline text-xs">削除</button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* モバイル カード */}
          <div className="md:hidden space-y-3">
            {products.length === 0 && <p className="text-center py-8 text-gray-400">データがありません</p>}
            {products.map((p) => (
              <div key={p['商品コード']} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-800">{p['商品名']}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p['商品コード']}</p>
                  </div>
                  <p className="text-lg font-bold text-blue-600 ml-2">
                    ¥{Number(p['最新総原価']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => setBomTarget(p)}
                    className="flex-1 py-2.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded min-h-[44px]">BOM確認</button>
                  <button onClick={() => {
                    setProductForm({ 商品コード: p['商品コード'], 商品名: p['商品名'], 最新総原価: String(p['最新総原価']) })
                    setEditProductKey(p['商品コード'])
                    setShowProductForm(true)
                  }} className="flex-1 py-2.5 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 min-h-[44px]">編集</button>
                  <button onClick={() => handleProductDelete(p['商品コード'])}
                    className="flex-1 py-2.5 text-sm text-red-500 border border-red-200 rounded hover:bg-red-50 min-h-[44px]">削除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bomTarget && (
        <BomViewModal
          product={bomTarget}
          masters={{ materials, solvents, processes }}
          onClose={() => setBomTarget(null)}
          onTotalUpdated={(code, newTotal) => {
            setProducts((prev) =>
              prev.map((p) => p['商品コード'] === code ? { ...p, 最新総原価: newTotal } : p)
            )
          }}
        />
      )}

      {showProductForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full rounded-t-2xl md:rounded-lg md:max-w-sm shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="p-5">
              <h3 className="font-bold text-gray-800 mb-4">{editProductKey ? '商品編集' : '商品追加'}</h3>
              <div className="space-y-3">
                {[{ key: '商品コード', type: 'text', disabled: !!editProductKey }, { key: '商品名', type: 'text' }, { key: '最新総原価', type: 'number' }].map(({ key, type, disabled }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{key}</label>
                    <input type={type} value={productForm[key]} disabled={disabled}
                      onChange={(e) => setProductForm({ ...productForm, [key]: e.target.value })}
                      className="border border-gray-300 rounded px-3 py-2.5 text-base w-full disabled:bg-gray-100" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowProductForm(false)} className="flex-1 py-3 text-sm border border-gray-300 rounded hover:bg-gray-50 min-h-[44px]">キャンセル</button>
                <button onClick={handleProductSave} className="flex-1 py-3 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 min-h-[44px]">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
