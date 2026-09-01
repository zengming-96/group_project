-- PDF 实际字节在 Supabase Storage（S3 兼容）；库内仅存定位信息与业务字段
ALTER TABLE exam_records
  ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(64),
  ADD COLUMN IF NOT EXISTS storage_object_key VARCHAR(512),
  ADD COLUMN IF NOT EXISTS content_type VARCHAR(127),
  ADD COLUMN IF NOT EXISTS byte_size BIGINT;

COMMENT ON COLUMN exam_records.storage_bucket IS 'Supabase Storage 桶名';
COMMENT ON COLUMN exam_records.storage_object_key IS '桶内对象路径，如 {userId}/{uuid}.pdf';
COMMENT ON COLUMN exam_records.content_type IS '上传时的 MIME，如 application/pdf';
COMMENT ON COLUMN exam_records.byte_size IS '对象大小（字节）';
COMMENT ON COLUMN exam_records.file_url IS '可选：公开访问 URL 或业务侧展示用链接；私有桶可留空';
