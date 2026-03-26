-- スプレッドシート連携設定テーブル
CREATE TABLE IF NOT EXISTS "T_スプレッドシート連携設定" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "スプレッドシートID" text NOT NULL,
  "スプレッドシートURL" text NOT NULL,
  "商品コード" text,
  "商品名" text,
  "最終同期日時" timestamp with time zone,
  "同期結果" text,
  "作成日時" timestamp with time zone DEFAULT now()
);

-- T_工程マスタの工程コードにユニーク制約を追加（upsert用）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'T_工程マスタ_工程コード_key'
  ) THEN
    ALTER TABLE "T_工程マスタ" ADD CONSTRAINT "T_工程マスタ_工程コード_key" UNIQUE ("工程コード");
  END IF;
END $$;
