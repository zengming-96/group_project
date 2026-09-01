-- username 存用户注册的「姓名/昵称」，可与邮箱不同；长度与 RegisterRequest.name 上限一致
ALTER TABLE users ALTER COLUMN username TYPE VARCHAR(200);
