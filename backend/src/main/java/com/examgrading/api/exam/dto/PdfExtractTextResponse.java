package com.examgrading.api.exam.dto;

/** 仅提取 PDF 纯文本的测试接口响应（不入库、不调大模型）。 */
public record PdfExtractTextResponse(String text, int charCount) {}
