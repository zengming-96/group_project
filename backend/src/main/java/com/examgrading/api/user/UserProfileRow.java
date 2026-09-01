package com.examgrading.api.user;

import java.time.Instant;

/** 用户对外展示字段（不含密码），用于 GET /users/me。 */
record UserProfileRow(String username, String email, Integer age, Instant createdAt) {}
