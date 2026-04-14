-- ============================================================
-- T_単価更新履歴 テーブル作成
-- ============================================================
CREATE TABLE IF NOT EXISTS "T_単価更新履歴" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "更新日時"       timestamp with time zone DEFAULT now(),
  "原材料コード"   text NOT NULL,
  "資材名"         text,
  "更新前単価"     numeric,
  "更新後単価"     numeric,
  "計算方式"       text,
  "更新件数_BOM"   integer DEFAULT 0,
  "更新件数_商品"  integer DEFAULT 0,
  "更新者メモ"     text
);
ALTER TABLE "T_単価更新履歴" DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- T_サイズ歩留まりマスタ に メディア単価 列追加
-- （原材料マスタのm単価から算出したm²あたりメディア単価を保持）
-- ============================================================
ALTER TABLE "T_サイズ歩留まりマスタ"
  ADD COLUMN IF NOT EXISTS "メディア単価" numeric NOT NULL DEFAULT 0;
