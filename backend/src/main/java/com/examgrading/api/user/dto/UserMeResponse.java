package com.examgrading.api.user.dto;

/**
 * 当前用户基本信息 + 学习统计。{@code daysSinceCreated} 为自注册日起至「今天」（UTC 日历日）经过的整天数，注册当日为
 * 0。{@code learningStats} 规则同原 {@code GET /users/me/stats}（已合并进本接口）。
 */
public record UserMeResponse(
    String username,
    String email,
    Integer age,
    long daysSinceCreated,
    UserLearningStatsResponse learningStats) {}
