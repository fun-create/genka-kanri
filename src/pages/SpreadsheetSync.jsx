import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY

// URLからスプレッドシートIDを抽出
function extractId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : null
}

// 数値パース（¥, , 円, % を除去）
function parseNum(v) {
  if (v === undefined || v === null || v === '') return null
  const n = parseFloat(String(v).replace(/[¥,円%\s]/g, ''))
  return isNaN(n) ? null : n
}

// Sheets APIフェッチ共通
async function apiFetch(url) {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`)
  return data
}

// シートのメタデータ取得
async function getSheetMeta(spreadsheetId) {
  return apiFetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties&key=${API_KEY}`)
}

// シートの値を取得
async function getSheetValues(spreadsheetId, sheetTitle) {
  const data = await apiFetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}?key=${API_KEY}`
  )
  return data.values || []
}

// タイトルにキーワードを含むシートを検索
function findSheet(sheets, keyword) {
  return sheets.find(s => s.properties.title.includes(keyword))
}

// キーワードが全て含まれるヘッダー行インデックスを探す（上位15行まで）
function findHeaderIdx(rows, keywords) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (keywords.every(kw => rows[i].some(c => String(c || '').includes(kw)))) return i
  }
  return -1
}

// ヘッダー配列からキーワードを含む列インデックスを取得
function colIdx(headers, ...keywords) {
  return headers.findIndex(h => keywords.every(kw => String(h || '').includes(kw)))
}

// ---- シート別パーサー ----

// ④資材の検討・決定 → T_原材料マスタ用レコード配列
function parseMaterials(rows) {
  const hi = findHeaderIdx(rows, ['原材料コード'])
  if (hi < 0) throw new Error('ヘッダー行（原材料コード列）が見つかりません')
  const h = rows[hi]
  const cCode  = colIdx(h, '原材料コード')
  const cName  = colIdx(h, '資材名（社内）') >= 0 ? colIdx(h, '資材名（社内）') : colIdx(h, '資材名')
  const cPrice = colIdx(h, '仕入れ価格', '税抜')
  const cLot   = colIdx(h, '発注ロット')
  const cURL   = colIdx(h, '商品URL')

  const records = rows.slice(hi + 1)
    .filter(r => String(r[cCode] || '').trim())
    .map(r => {
      const rec = {
        原材料コード: String(r[cCode]).trim(),
        資材名: String(r[cName] || '').trim(),
      }
      const price = parseNum(r[cPrice])
      const lot   = parseNum(r[cLot])
      if (price !== null) rec.最新単価 = price
      if (lot   !== null) rec.発注点   = lot
      if (cURL >= 0 && r[cURL]) rec.仕入先URL = String(r[cURL]).trim()
      return rec
    })

  if (!records.length) throw new Error('有効なデータ行が見つかりません')
  return records
}

// ⑦-1 製造工程（マニュアル） → T_工程マスタ用レコード配列
// 各セクションの「小計」行からその商品の所要時間（秒）を取得し分に変換
function parseProcesses(rows, productName) {
  // 商品名の列インデックスを探す（先頭5行内）
  let productCol = -1
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const idx = rows[i].findIndex(c =>
      String(c || '').trim() === productName.trim() ||
      String(c || '').includes(productName.trim())
    )
    if (idx >= 0) { productCol = idx; break }
  }
  if (productCol < 0) throw new Error(`「${productName}」列が見つかりません`)

  const records = []
  let sectionName = ''

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const firstCell = String(row[0] || '').trim()

    // 小計の前の行 = セクション名
    if (i + 1 < rows.length && String(rows[i + 1][0] || '').includes('小計')) {
      sectionName = firstCell
    }

    // 小計行 → そのセクションの合計時間(秒)
    if (firstCell.includes('小計') && sectionName) {
      const sec = parseNum(row[productCol])
      if (sec !== null && sec > 0) {
        records.push({
          工程コード: `${productName}_${sectionName}`.replace(/[　\s\/（）()]/g, '_').substring(0, 50),
          商品名: productName,
          ポジション名: sectionName,
          標準工数_分: Math.round((sec / 60) * 100) / 100,
        })
      }
    }
  }

  if (!records.length) throw new Error(`「${productName}」の工程データが見つかりません`)
  return records
}

// ⑧原価算出 → T_商品マスタ更新用データ
function parseCostData(rows) {
  const result = {}

  // ヘッダー行形式（横方向）を試みる
  const hi = findHeaderIdx(rows, ['製造原価'])
  if (hi >= 0 && rows[hi + 1]) {
    const h = rows[hi]
    const r = rows[hi + 1]
    const cCost  = colIdx(h, '製造原価')
    const cPrice = colIdx(h, '販売価格')
    const cRatio = colIdx(h, '原価率')
    if (cCost  >= 0) result.最新総原価 = parseNum(r[cCost])
    if (cPrice >= 0) result.本体価格   = parseNum(r[cPrice])
    if (cRatio >= 0) result.原価率     = parseNum(r[cRatio])
  }

  // キーバリュー形式（縦方向）でも補完
  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i++) {
      const cell = String(row[i] || '')
      if (!result.最新総原価 && cell.includes('製造原価')) result.最新総原価 = parseNum(row[i + 1])
      if (!result.本体価格   && cell.includes('販売価格')) result.本体価格   = parseNum(row[i + 1])
      if (!result.原価率     && cell.includes('原価率'))   result.原価率     = parseNum(row[i + 1])
    }
  }

  if (!result.最新総原価 && !result.本体価格) {
    throw new Error('製造原価・販売価格のデータが見つかりません')
  }
  return result
}

// ---- メインコンポーネント ----

export default function SpreadsheetSync() {
  const [connections, setConnections] = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState({ url: '', 商品コード: '', 商品名: '' })
  const [syncResults, setSyncResults] = useState({})
  const [syncingAll, setSyncingAll]   = useState(false)
  const [products, setProducts]       = useState([])

  useEffect(() => {
    loadConnections()
    loadProducts()
  }, [])

  async function loadConnections() {
    const { data } = await supabase
      .from('T_スプレッドシート連携設定')
      .select('*')
      .order('作成日時', { ascending: false })
    setConnections(data || [])
    setLoading(false)
  }

  async function loadProducts() {
    const { data } = await supabase.from('T_商品マスタ').select('商品コード, 商品名')
    setProducts(data || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    const id = extractId(form.url)
    if (!id) return alert('有効なスプレッドシートURLを入力してください')

    const { error } = await supabase.from('T_スプレッドシート連携設定').insert({
      スプレッドシートID: id,
      スプレッドシートURL: form.url,
      商品コード: form.商品コード || null,
      商品名: form.商品名 || null,
    })
    if (!error) {
      setShowForm(false)
      setForm({ url: '', 商品コード: '', 商品名: '' })
      loadConnections()
    }
  }

  async function handleDelete(id) {
    if (!confirm('この連携設定を削除しますか？')) return
    await supabase.from('T_スプレッドシート連携設定').delete().eq('id', id)
    loadConnections()
  }

  // 1件同期
  async function syncOne(conn) {
    if (!API_KEY) {
      setSyncResults(prev => ({ ...prev, [conn.id]: { status: 'error', message: 'VITE_GOOGLE_SHEETS_API_KEY が設定されていません' } }))
      return
    }
    setSyncResults(prev => ({ ...prev, [conn.id]: { status: 'loading', message: '同期中...' } }))

    const result = { 原材料: 0, 工程: 0, 商品: 0, errors: [] }

    try {
      const meta   = await getSheetMeta(conn.スプレッドシートID)
      const sheets = meta.sheets || []

      // ④資材 → T_原材料マスタ
      const matSheet = findSheet(sheets, '④')
      if (matSheet) {
        try {
          const rows    = await getSheetValues(conn.スプレッドシートID, matSheet.properties.title)
          const records = parseMaterials(rows)
          const { error } = await supabase
            .from('T_原材料マスタ')
            .upsert(records, { onConflict: '原材料コード' })
          if (error) throw error
          result.原材料 = records.length
        } catch (e) {
          result.errors.push(`原材料マスタ: ${e.message}`)
        }
      }

      // ⑦-1 製造工程 → T_工程マスタ
      const procSheet = findSheet(sheets, '⑦-1')
      if (procSheet && conn.商品名) {
        try {
          const rows    = await getSheetValues(conn.スプレッドシートID, procSheet.properties.title)
          const records = parseProcesses(rows, conn.商品名)

          // 既存の分単価を保持（上書きしない）
          const { data: existing } = await supabase
            .from('T_工程マスタ')
            .select('工程コード, 分単価')
            .eq('商品名', conn.商品名)
          const 分単価Map = Object.fromEntries((existing || []).map(r => [r.工程コード, r.分単価]))

          const upsertData = records.map(r => {
            const 分単価 = 分単価Map[r.工程コード] ?? null
            return {
              ...r,
              分単価,
              人件費_1個: 分単価 ? Math.round(r.標準工数_分 * 分単価 * 100) / 100 : null,
            }
          })

          const { error } = await supabase
            .from('T_工程マスタ')
            .upsert(upsertData, { onConflict: '工程コード' })
          if (error) throw error
          result.工程 = records.length
        } catch (e) {
          result.errors.push(`工程マスタ: ${e.message}`)
        }
      }

      // ⑧原価算出 → T_商品マスタ
      const costSheet = findSheet(sheets, '⑧')
      if (costSheet && conn.商品コード) {
        try {
          const rows     = await getSheetValues(conn.スプレッドシートID, costSheet.properties.title)
          const costData = parseCostData(rows)
          const updateObj = Object.fromEntries(
            Object.entries(costData).filter(([, v]) => v !== null)
          )
          const { error } = await supabase
            .from('T_商品マスタ')
            .update(updateObj)
            .eq('商品コード', conn.商品コード)
          if (error) throw error
          result.商品 = 1
        } catch (e) {
          result.errors.push(`商品原価: ${e.message}`)
        }
      }

      // 最終同期日時・結果を更新
      await supabase
        .from('T_スプレッドシート連携設定')
        .update({
          最終同期日時: new Date().toISOString(),
          同期結果: JSON.stringify(result),
        })
        .eq('id', conn.id)

      const summary = `原材料 ${result.原材料}件・工程 ${result.工程}件・商品原価 ${result.商品}件 更新`
      setSyncResults(prev => ({
        ...prev,
        [conn.id]: {
          status: result.errors.length ? 'partial' : 'success',
          message: summary,
          errors: result.errors,
        },
      }))
    } catch (e) {
      setSyncResults(prev => ({ ...prev, [conn.id]: { status: 'error', message: e.message } }))
    }

    loadConnections()
  }

  async function syncAll() {
    setSyncingAll(true)
    for (const conn of connections) {
      await syncOne(conn)
    }
    setSyncingAll(false)
  }

  const statusBadge = (id) => {
    const r = syncResults[id]
    if (!r) return null
    const colors = {
      loading: 'bg-blue-100 text-blue-700',
      success: 'bg-green-100 text-green-700',
      partial: 'bg-yellow-100 text-yellow-700',
      error:   'bg-red-100 text-red-700',
    }
    return (
      <div className={`mt-2 rounded p-2 text-xs ${colors[r.status]}`}>
        <p>{r.status === 'loading' ? '⏳' : r.status === 'success' ? '✅' : r.status === 'partial' ? '⚠️' : '❌'} {r.message}</p>
        {r.errors?.map((e, i) => <p key={i} className="mt-0.5 text-red-600">• {e}</p>)}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">スプレッドシート連携</h1>
          <p className="text-sm text-gray-500 mt-0.5">Googleスプレッドシートのデータをマスタへ同期</p>
        </div>
        <div className="flex gap-2">
          {connections.length > 0 && (
            <button
              onClick={syncAll}
              disabled={syncingAll}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              {syncingAll ? '同期中...' : '全件同期'}
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            + 追加
          </button>
        </div>
      </div>

      {/* API KEY 警告 */}
      {!API_KEY && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
          ⚠️ <strong>VITE_GOOGLE_SHEETS_API_KEY</strong> が未設定です。
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="underline ml-1"
          >Google Cloud Console</a> でAPIキーを取得し、<code>.env.local</code> に設定してください。
        </div>
      )}

      {/* 追加フォーム */}
      {showForm && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">スプレッドシート追加</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">スプレッドシートURL <span className="text-red-500">*</span></label>
              <input
                type="url"
                required
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">「リンクを知っている全員が閲覧可能」に設定してください</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">紐付ける商品コード（任意）</label>
                <select
                  value={form.商品コード}
                  onChange={e => setForm(f => ({ ...f, 商品コード: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">選択しない</option>
                  {products.map(p => (
                    <option key={p.商品コード} value={p.商品コード}>{p.商品コード} - {p.商品名}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">シート内の商品名（⑦-1工程同期に使用）</label>
                <input
                  type="text"
                  value={form.商品名}
                  onChange={e => setForm(f => ({ ...f, 商品名: e.target.value }))}
                  placeholder="例: ブロックメモ"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                追加
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 同期対象の説明 */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700">
        <p className="font-semibold mb-1">同期対象シートと連携先マスタ</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
          <div className="bg-white rounded p-2">
            <p className="font-medium">④ 資材の検討・決定</p>
            <p className="text-blue-500">↓ 原材料マスタ（単価・発注点）</p>
          </div>
          <div className="bg-white rounded p-2">
            <p className="font-medium">⑦-1 製造工程（マニュアル）</p>
            <p className="text-blue-500">↓ 工程マスタ（標準工数）</p>
          </div>
          <div className="bg-white rounded p-2">
            <p className="font-medium">⑧ 原価算出</p>
            <p className="text-blue-500">↓ 商品マスタ（製造原価・販売価格）</p>
          </div>
        </div>
      </div>

      {/* 連携一覧 */}
      {loading ? (
        <p className="text-sm text-gray-500">読み込み中...</p>
      ) : connections.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-400 text-sm">連携設定がありません</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            最初のスプレッドシートを追加
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map(conn => (
            <div key={conn.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              {/* デスクトップ: 横並び */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {conn.商品コード && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                        {conn.商品コード}
                      </span>
                    )}
                    {conn.商品名 && (
                      <span className="text-sm font-medium text-gray-800">{conn.商品名}</span>
                    )}
                  </div>
                  <a
                    href={conn.スプレッドシートURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline mt-1 block truncate"
                  >
                    {conn.スプレッドシートURL}
                  </a>
                  {conn.最終同期日時 && (
                    <p className="text-xs text-gray-400 mt-1">
                      最終同期: {new Date(conn.最終同期日時).toLocaleString('ja-JP')}
                    </p>
                  )}
                  {statusBadge(conn.id)}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => syncOne(conn)}
                    disabled={syncResults[conn.id]?.status === 'loading'}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 min-h-[36px]"
                  >
                    {syncResults[conn.id]?.status === 'loading' ? '...' : '同期'}
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="px-3 py-1.5 bg-red-100 text-red-600 text-xs rounded hover:bg-red-200 min-h-[36px]"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* セットアップガイド */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
        <p className="font-semibold text-gray-700 mb-2">Google Sheets APIキーの取得方法</p>
        <ol className="list-decimal list-inside space-y-1">
          <li><a href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google Cloud Console</a> で「Google Sheets API」を有効化</li>
          <li>「認証情報」→「APIキーを作成」でAPIキーを発行</li>
          <li>APIキーの制限: 「APIの制限」→「Google Sheets API」のみ許可（推奨）</li>
          <li>プロジェクトの <code className="bg-gray-200 px-1 rounded">.env.local</code> に <code className="bg-gray-200 px-1 rounded">VITE_GOOGLE_SHEETS_API_KEY=取得したキー</code> を追加</li>
          <li>Vercelにデプロイする場合は環境変数にも同様に追加</li>
        </ol>
      </div>
    </div>
  )
}
