-- White-label engine values without changing upstream logic.
-- 1) Replace standardized rule code prefixes in persisted data.
UPDATE "ComplianceRule"
SET "code" = regexp_replace("code", '^prowler_', 'shield_')
WHERE "code" ~ '^prowler_';

UPDATE "ComplianceRule"
SET "code" = regexp_replace("code", '^cloudsploit_', 'guard_')
WHERE "code" ~ '^cloudsploit_';

UPDATE "Finding"
SET "ruleCode" = regexp_replace("ruleCode", '^prowler_', 'shield_')
WHERE "ruleCode" ~ '^prowler_';

UPDATE "Finding"
SET "ruleCode" = regexp_replace("ruleCode", '^cloudsploit_', 'guard_')
WHERE "ruleCode" ~ '^cloudsploit_';

-- 2) Update any engine_type column in the public schema.
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'engine_type'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET engine_type = ''shield'' WHERE engine_type = ''prowler''',
      t.table_schema, t.table_name
    );
    EXECUTE format(
      'UPDATE %I.%I SET engine_type = ''guard'' WHERE engine_type = ''cloudsploit''',
      t.table_schema, t.table_name
    );
  END LOOP;
END $$;
