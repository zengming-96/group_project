-- full_name 与 username 职责重复，仅保留 username 作为展示/登录名
ALTER TABLE users DROP COLUMN IF EXISTS full_name;
