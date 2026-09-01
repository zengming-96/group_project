package com.examgrading.api.user.dto;

import java.util.List;

/**
 * 当前用户学习统计：题型 1～5 必有项（无题为 0）、当月每日正确率（当月每一天一条，无题为 0）、当月汇总、近 12
 * 月趋势。
 */
public record UserLearningStatsResponse(
    List<QuestionTypeStatItem> byQuestionType,
    List<DayStatItem> currentMonthByDay,
    MonthOverallStat currentMonth,
    List<MonthOverallStat> monthlyTrendLast12) {}
