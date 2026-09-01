package com.examgrading.api.exam.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * 单次试卷批改详情：PDF 定位信息、汇总与逐题明细。
 *
 * <p>{@code pdfPath}：便于展示的存储路径，形如 {@code 桶名/对象键}；若仅有公开链接则可能与 {@link
 * #fileUrl} 相同。
 */
public record ExamGradingDetailResponse(
    long examId,
    String fileName,
    String pdfPath,
    String fileUrl,
    String storageBucket,
    String storageObjectKey,
    int status,
    BigDecimal accuracyRate,
    int totalQuestions,
    int correctCount,
    Instant examCreatedAt,
    List<QuestionGradingDetailItem> questions) {}
