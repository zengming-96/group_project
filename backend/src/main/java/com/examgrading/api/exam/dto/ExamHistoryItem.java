package com.examgrading.api.exam.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 用户上传的一份试卷摘要；{@code fileName} 为上传时的 PDF 文件名（exam_records.file_name）。
 */
public record ExamHistoryItem(
    long examId,
    String fileName,
    int status,
    Instant createdAt,
    int totalQuestions,
    int correctCount,
    BigDecimal accuracyRate) {}
