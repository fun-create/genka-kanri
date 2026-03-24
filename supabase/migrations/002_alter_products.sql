-- ============================================================
-- T_商品マスタ 列追加
-- ============================================================
ALTER TABLE "T_商品マスタ"
  ADD COLUMN IF NOT EXISTS "原価コード"  text,
  ADD COLUMN IF NOT EXISTS "ポジション"  text,
  ADD COLUMN IF NOT EXISTS "本体価格"    numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "原価率"      numeric DEFAULT 0;

-- ============================================================
-- T_原価計算明細 列追加（BOM対応）
-- ============================================================
ALTER TABLE "T_原価計算明細"
  ADD COLUMN IF NOT EXISTS "明細区分"  text,
  ADD COLUMN IF NOT EXISTS "コード"    text,
  ADD COLUMN IF NOT EXISTS "名称"      text;

-- 原価コードに対するインデックス（商品詳細の高速化）
CREATE INDEX IF NOT EXISTS idx_商品マスタ_原価コード
  ON "T_商品マスタ" ("原価コード");

CREATE INDEX IF NOT EXISTS idx_原価計算明細_受注ID
  ON "T_原価計算明細" ("受注ID");
