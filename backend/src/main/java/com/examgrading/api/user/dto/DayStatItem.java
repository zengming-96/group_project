package com.examgrading.api.user.dto;

import java.math.BigDecimal;

/** 某一自然日内的题目正确率（无做题为 0）。 */
public record DayStatItem(
    int year,
    int month,
    int dayOfMonth,
    /** 日历日，如 2026-04-03 */
    String date,
    long totalQuestions,
    long correctCount,
    long wrongCount,
    BigDecimal correctRatePercent,
    BigDecimal wrongRatePercent) {}
