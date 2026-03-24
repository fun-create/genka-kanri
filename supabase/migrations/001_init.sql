-- ============================================================
-- 原価管理・在庫管理システム DB初期化SQL
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. T_原材料マスタ
CREATE TABLE IF NOT EXISTS "T_原材料マスタ" (
  "原材料コード" text PRIMARY KEY,
  "資材名"       text NOT NULL,
  "最新単価"     numeric NOT NULL DEFAULT 0,
  "メディア区分" text,
  "仕入先URL"    text,
  "発注点"       numeric NOT NULL DEFAULT 0,
  "現在庫"       numeric NOT NULL DEFAULT 0
);

-- 2. T_サイズ歩留まりマスタ（CSVの全列対応）
CREATE TABLE IF NOT EXISTS "T_サイズ歩留まりマスタ" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "メディアコード"   text,
  "製品名"           text NOT NULL,
  "面積m2"           numeric NOT NULL DEFAULT 0,
  "メディア取得係数" numeric NOT NULL DEFAULT 1,
  "溶剤取得係数"     numeric NOT NULL DEFAULT 1,
  "メディア区分"     text
);

-- 3. T_工程マスタ（CSVの全列対応）
CREATE TABLE IF NOT EXISTS "T_工程マスタ" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "工程コード"   text,
  "商品名"       text,
  "ポジション名" text NOT NULL,
  "標準工数_分"  numeric DEFAULT 0,
  "人件費_1個"   numeric DEFAULT 0,
  "分単価"       numeric NOT NULL DEFAULT 0
);

-- 4. T_溶剤マスタ
CREATE TABLE IF NOT EXISTS "T_溶剤マスタ" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "溶剤名"       text NOT NULL DEFAULT '標準溶剤',
  "最新単価"     numeric NOT NULL DEFAULT 0
);

-- 5. T_商品マスタ
CREATE TABLE IF NOT EXISTS "T_商品マスタ" (
  "商品コード"   text PRIMARY KEY,
  "商品名"       text NOT NULL,
  "最新総原価"   numeric NOT NULL DEFAULT 0
);

-- 6. T_原価計算明細
CREATE TABLE IF NOT EXISTS "T_原価計算明細" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "受注ID"       text NOT NULL,
  "原材料コード" text,
  "単価_snapshot" numeric NOT NULL DEFAULT 0,
  "数量"         numeric NOT NULL DEFAULT 0,
  "原価"         numeric NOT NULL DEFAULT 0,
  "作成日時"     timestamp with time zone DEFAULT now()
);

-- 7. T_在庫履歴
CREATE TABLE IF NOT EXISTS "T_在庫履歴" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "原材料コード" text NOT NULL,
  "日時"         timestamp with time zone DEFAULT now(),
  "区分"         text NOT NULL CHECK ("区分" IN ('入庫', '出庫', '調整')),
  "数量"         numeric NOT NULL DEFAULT 0,
  "備考"         text
);

-- ============================================================
-- Row Level Security (RLS) を無効化（開発用）
-- 本番環境では適切なポリシーを設定してください
-- ============================================================
ALTER TABLE "T_原材料マスタ" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "T_サイズ歩留まりマスタ" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "T_工程マスタ" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "T_溶剤マスタ" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "T_商品マスタ" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "T_原価計算明細" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "T_在庫履歴" DISABLE ROW LEVEL SECURITY;
