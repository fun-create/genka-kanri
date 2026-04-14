import { supabase } from './supabase'

/**
 * サイズ歩留まり計算：m単価を算出し、BOM・商品マスタ・履歴を一括更新する
 *
 * STEP1: 仕入れ単位に応じてm単価を計算
 *   - ロール: m単価 = ロール単価 ÷ ロール面積
 *   - 枚   : m単価 = 最新単価 × 歩留まり率
 * STEP2: T_サイズ歩留まりマスタの「メディア単価」をm単価で更新（メディア区分で紐づけ）
 * STEP3: T_原材料マスタの「最新単価」をm単価で更新
 * STEP4: BOMの「コード」= 原材料コード の明細から影響受注IDを全件特定
 * STEP5: 受注IDごとに商品を特定し、BOM全明細の「単価_snapshot × 数量」合計で最新総原価を更新
 * STEP6: T_単価更新履歴に記録
 *
 * @param {Object} materialRow - T_原材料マスタ の行データ（フォーム値を反映済みのもの）
 * @returns {{ affectedProductCount: number, mPrice: number, method: string }}
 */
export async function calcAndApplyMPrice(materialRow) {
  const code       = materialRow['原材料コード']
  const unit       = materialRow['仕入れ単位']
  const mediaKubun = materialRow['メディア区分']

  // STEP1: m単価を計算
  let mPrice, method
  if (unit === 'ロール') {
    const rollPrice = Number(materialRow['ロール単価'] || 0)
    const rollArea  = Number(materialRow['ロール面積'] || 0)
    if (rollArea === 0) throw new Error('ロール面積が0です。ロール面積を入力してください。')
    mPrice = rollPrice / rollArea
    method = 'ロール計算'
  } else {
    const latestPrice = Number(materialRow['最新単価'] || 0)
    const yieldRate   = Number(materialRow['歩留まり率'] || 1)
    mPrice = latestPrice * yieldRate
    method = '枚計算'
  }

  const oldPrice = Number(materialRow['最新単価'] || 0)

  // STEP2: T_サイズ歩留まりマスタの「メディア単価」を更新（メディア区分が一致するレコード）
  if (mediaKubun) {
    await supabase
      .from('T_サイズ歩留まりマスタ')
      .update({ 'メディア単価': mPrice })
      .eq('メディア区分', mediaKubun)
  }

  // STEP3: T_原材料マスタの「最新単価」をm単価で更新
  await supabase
    .from('T_原材料マスタ')
    .update({ '最新単価': mPrice })
    .eq('原材料コード', code)

  // STEP4: BOMの「コード」= 原材料コード の明細を検索 → 影響受注IDを全件特定
  const { data: bomRows } = await supabase
    .from('T_原価計算明細')
    .select('受注ID')
    .eq('コード', code)

  const juchiIds = [...new Set((bomRows || []).map((r) => r['受注ID']))]

  // STEP5: 受注IDごとに商品を特定し、BOM全明細の合計でT_商品マスタ.最新総原価を更新
  let affectedProductCount = 0
  for (const juchiId of juchiIds) {
    const { data: products } = await supabase
      .from('T_商品マスタ')
      .select('商品コード')
      .eq('原価コード', juchiId)

    if (!products || products.length === 0) continue

    const { data: allBom } = await supabase
      .from('T_原価計算明細')
      .select('単価_snapshot, 数量')
      .eq('受注ID', juchiId)

    const totalCost = (allBom || []).reduce(
      (sum, r) => sum + Number(r['単価_snapshot']) * Number(r['数量']),
      0
    )

    for (const product of products) {
      await supabase
        .from('T_商品マスタ')
        .update({ '最新総原価': Math.ceil(totalCost) })
        .eq('商品コード', product['商品コード'])
      affectedProductCount++
    }
  }

  // STEP6: T_単価更新履歴に記録
  await supabase.from('T_単価更新履歴').insert({
    原材料コード:  code,
    資材名:        materialRow['資材名'],
    更新前単価:    oldPrice,
    更新後単価:    mPrice,
    計算方式:      method,
    更新件数_BOM:  (bomRows || []).length,
    更新件数_商品: affectedProductCount,
  })

  return { affectedProductCount, mPrice, method }
}
