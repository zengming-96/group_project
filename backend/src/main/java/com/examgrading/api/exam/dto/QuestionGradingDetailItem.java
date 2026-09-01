package com.examgrading.api.exam.dto;

import java.time.Instant;

/** 单题批改明细，对应 question_details 一行。 */
public record QuestionGradingDetailItem(
    long questionDetailId,
    int questionNo,
    String question,
    int questionType,
    String userAnswer,
    String correctAnswer,
    boolean correct,
    String analysis,
    Instant createdAt) {}
