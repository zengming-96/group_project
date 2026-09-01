-- 用户展示姓名、年龄；注册时的 name 写入 full_name
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS age SMALLINT;

ALTER TABLE users
  ADD CONSTRAINT users_age_range_check CHECK (age IS NULL OR (age >= 1 AND age <= 150));

COMMENT ON COLUMN users.full_name IS '用户姓名（展示用），可与 username 不同';
COMMENT ON COLUMN users.age IS '年龄，1～150，可为空';
