package com.examgrading.api.exam;

import java.math.BigDecimal;

public record GradingOutcome(int totalQuestions, int correctCount, BigDecimal accuracyRate) {}
