package com.examgrading.api.exam.dto;

import java.math.BigDecimal;
import java.time.Instant;

/** 归属校验后的一条 exam_records 行（供详情接口组装响应）。 */
public record ExamOwnedSummary(
    long examId,
    String fileName,
    String fileUrl,
    String storageBucket,
    String storageObjectKey,
    int status,
    int totalQuestions,
    int correctCount,
    BigDecimal accuracyRate,
    Instant createdAt) {}
