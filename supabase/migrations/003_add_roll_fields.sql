-- ============================================================
-- T_原材料マスタ ロール仕入れ情報 列追加
-- ============================================================
ALTER TABLE "T_原材料マスタ"
  ADD COLUMN IF NOT EXISTS "仕入れ単位"  text,
  ADD COLUMN IF NOT EXISTS "ロール単価"  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ロール面積"  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "歩留まり率"  numeric NOT NULL DEFAULT 1;

-- ============================================================
-- T_サイズ歩留まりマスタ m単価 列追加
-- （原材料マスタのロール情報から算出したm²あたり単価を保持）
-- ============================================================
ALTER TABLE "T_サイズ歩留まりマスタ"
  ADD COLUMN IF NOT EXISTS "m単価"  numeric NOT NULL DEFAULT 0;

-- ============================================================
-- m単価 自動計算トリガー関数
-- 計算式: m単価 = ロール単価 / ロール面積 / 歩留まり率
-- ロール面積または歩留まり率が0の場合は0とする
-- ============================================================
CREATE OR REPLACE FUNCTION fn_update_m_unit_price()
RETURNS TRIGGER AS $$
DECLARE
  v_m_price numeric;
BEGIN
  -- m単価を計算
  IF NEW."ロール面積" > 0 AND NEW."歩留まり率" > 0 THEN
    v_m_price := NEW."ロール単価" / NEW."ロール面積" / NEW."歩留まり率";
  ELSE
    v_m_price := 0;
  END IF;

  -- 最新単価 を m単価 で上書き
  NEW."最新単価" := v_m_price;

  -- T_サイズ歩留まりマスタ の関連行 m単価 を一括更新
  UPDATE "T_サイズ歩留まりマスタ"
     SET "m単価" = v_m_price
   WHERE "メディアコード" = NEW."原材料コード";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- トリガー登録（INSERT / UPDATE 時に実行）
-- ============================================================
DROP TRIGGER IF EXISTS trg_update_m_unit_price ON "T_原材料マスタ";

CREATE TRIGGER trg_update_m_unit_price
BEFORE INSERT OR UPDATE OF "ロール単価", "ロール面積", "歩留まり率"
ON "T_原材料マスタ"
FOR EACH ROW
EXECUTE FUNCTION fn_update_m_unit_price();

-- ============================================================
-- 既存データの m単価 を再計算（初回マイグレーション用）
-- ============================================================
UPDATE "T_原材料マスタ"
   SET "最新単価" = CASE
                     WHEN "ロール面積" > 0 AND "歩留まり率" > 0
                     THEN "ロール単価" / "ロール面積" / "歩留まり率"
                     ELSE "最新単価"   -- ロール情報未設定の行はそのまま
                   END;

UPDATE "T_サイズ歩留まりマスタ" s
   SET "m単価" = (
     SELECT CASE
              WHEN m."ロール面積" > 0 AND m."歩留まり率" > 0
              THEN m."ロール単価" / m."ロール面積" / m."歩留まり率"
              ELSE m."最新単価"
            END
       FROM "T_原材料マスタ" m
      WHERE m."原材料コード" = s."メディアコード"
   )
 WHERE "メディアコード" IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM "T_原材料マスタ" m WHERE m."原材料コード" = s."メディアコード"
   );
