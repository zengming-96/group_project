package com.examgrading.api.exam.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 上传 PDF 并完成批改后的响应：与 {@link ExamGradingDetailResponse} 字段一致的全量详情，外加 {@code
 * gradingMode}（如 MOCK_AI、LANGCHAIN4J）。
 *
 * <p>{@code extractedText} / {@code extractedTextTotalChars} 仅在上传时带 {@code includeExtractedText=true}
 * 时出现，用于调试 PDF 抽取质量。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExamPdfUploadCompleteResponse(
    String gradingMode,
    ExamGradingDetailResponse detail,
    String extractedText,
    Integer extractedTextTotalChars) {}
