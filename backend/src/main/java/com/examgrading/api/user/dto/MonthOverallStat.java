package com.examgrading.api.user.dto;

import java.math.BigDecimal;

/** 某自然月内全部已批改题目的总体正确/错误统计（用于折线图或表格）。 */
public record MonthOverallStat(
    int year,
    int month,
    /** 如 2026-04，便于前端作横轴标签 */
    String yearMonth,
    long totalQuestions,
    long correctCount,
    long wrongCount,
    BigDecimal correctRatePercent,
    BigDecimal wrongRatePercent) {}
