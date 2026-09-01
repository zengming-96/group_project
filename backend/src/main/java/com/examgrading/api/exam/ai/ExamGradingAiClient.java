package com.examgrading.api.exam.ai;

import java.util.List;

/**
 * 根据试卷纯文本生成逐题批改结果。未配置 {@code app.ai.qwen.api-key} 时使用 {@link
 * MockExamGradingAiClient}，否则通过 LangChain4j 调用百炼 OpenAI 兼容接口（如千问）。
 */
public interface ExamGradingAiClient {

  List<QuestionDraft> gradeFromPlainText(String plainText, long examId);

  /** 上传完成接口中 {@code gradingMode} 字段，用于区分模拟与真实模型。 */
  default String gradingModeLabel() {
    return "MOCK_AI";
  }
}
