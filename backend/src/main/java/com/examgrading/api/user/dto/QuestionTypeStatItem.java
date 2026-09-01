package com.examgrading.api.user.dto;

import java.math.BigDecimal;

/** 某题型累计正确/错误及占比（百分比 0～100，两位小数）。 */
public record QuestionTypeStatItem(
    int questionType,
    String typeName,
    long totalQuestions,
    long correctCount,
    long wrongCount,
    BigDecimal correctRatePercent,
    BigDecimal wrongRatePercent) {}
