package com.examgrading.api.exam;

import com.examgrading.api.exam.ai.ExamGradingAiClient;
import com.examgrading.api.exam.ai.QuestionDraft;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExamGradingTxService {

  private final ExamRecordRepository examRecordRepository;
  private final QuestionDetailRepository questionDetailRepository;
  private final ExamTypeStatsRepository examTypeStatsRepository;
  private final ExamGradingAiClient examGradingAiClient;

  public ExamGradingTxService(
      ExamRecordRepository examRecordRepository,
      QuestionDetailRepository questionDetailRepository,
      ExamTypeStatsRepository examTypeStatsRepository,
      ExamGradingAiClient examGradingAiClient) {
    this.examRecordRepository = examRecordRepository;
    this.questionDetailRepository = questionDetailRepository;
    this.examTypeStatsRepository = examTypeStatsRepository;
    this.examGradingAiClient = examGradingAiClient;
  }

  @Transactional(rollbackFor = Exception.class)
  public GradingOutcome runMockGrading(long examId, long userId, String extractedPlainText) {
    examRecordRepository.updateStatus(examId, 1);
    examRecordRepository.updateStatus(examId, 2);

    List<QuestionDraft> drafts =
        examGradingAiClient.gradeFromPlainText(extractedPlainText, examId);
    for (QuestionDraft d : drafts) {
      questionDetailRepository.insert(examId, d);
    }

    int total = drafts.size();
    int correct = (int) drafts.stream().filter(QuestionDraft::correct).count();
    BigDecimal accuracy =
        total == 0
            ? BigDecimal.ZERO
            : BigDecimal.valueOf(correct * 100.0 / total).setScale(2, RoundingMode.HALF_UP);

    Map<Short, int[]> byType = new HashMap<>();
    for (QuestionDraft d : drafts) {
      int[] agg = byType.computeIfAbsent(d.questionType(), k -> new int[] {0, 0});
      agg[0]++;
      if (d.correct()) {
        agg[1]++;
      }
    }
    examTypeStatsRepository.deleteByExamId(examId);
    for (Map.Entry<Short, int[]> e : byType.entrySet()) {
      examTypeStatsRepository.insert(
          examId, userId, e.getKey(), e.getValue()[0], e.getValue()[1]);
    }

    examRecordRepository.updateSummary(examId, total, correct, accuracy, 3);
    return new GradingOutcome(total, correct, accuracy);
  }
}
