package com.examgrading.api.exam.ai;

import com.examgrading.api.exam.ExamQuestionType;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * 模拟 AI：按文本长度估算题量并随机生成对错；在 {@code app.ai.qwen.api-key} 未配置时由 {@link
 * com.examgrading.api.config.ExamAiConfig} 注册。
 */
public class MockExamGradingAiClient implements ExamGradingAiClient {

  @Override
  public List<QuestionDraft> gradeFromPlainText(String plainText, long examId) {
    String t = plainText == null ? "" : plainText;
    int n =
        t.isBlank()
            ? 5
            : Math.min(25, Math.max(3, Math.min(t.length(), 200_000) / 400));
    Random rnd = new Random(examId * 31L + t.length());
    List<QuestionDraft> out = new ArrayList<>(n);
    for (int i = 1; i <= n; i++) {
      short type =
          (short)
              (ExamQuestionType.MIN + rnd.nextInt(ExamQuestionType.MAX - ExamQuestionType.MIN + 1));
      char ua = (char) ('A' + rnd.nextInt(4));
      boolean correct = rnd.nextDouble() < 0.55;
      char sa = ua;
      if (!correct) {
        while (sa == ua) {
          sa = (char) ('A' + rnd.nextInt(4));
        }
      }
      String analysis =
          "【模拟 AI】第 "
              + i
              + " 题：根据提取文本要点比对，判定为"
              + (correct ? "正确" : "错误")
              + "。（后续将接入真实大模型）";
      out.add(
          new QuestionDraft(
              i,
              "第 " + i + " 题（模拟）",
              type,
              String.valueOf(ua),
              String.valueOf(sa),
              correct,
              analysis));
    }
    return out;
  }
}
