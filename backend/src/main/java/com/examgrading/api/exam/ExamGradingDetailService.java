package com.examgrading.api.exam;

import com.examgrading.api.error.ApiException;
import com.examgrading.api.exam.dto.ExamGradingDetailResponse;
import com.examgrading.api.exam.dto.ExamOwnedSummary;
import com.examgrading.api.exam.dto.QuestionGradingDetailItem;
import com.examgrading.api.security.PrincipalUserId;
import com.examgrading.api.user.UserRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ExamGradingDetailService {

  private final UserRepository userRepository;
  private final ExamRecordRepository examRecordRepository;
  private final QuestionDetailRepository questionDetailRepository;

  public ExamGradingDetailService(
      UserRepository userRepository,
      ExamRecordRepository examRecordRepository,
      QuestionDetailRepository questionDetailRepository) {
    this.userRepository = userRepository;
    this.examRecordRepository = examRecordRepository;
    this.questionDetailRepository = questionDetailRepository;
  }

  public ExamGradingDetailResponse getDetail(String principalName, long examId) {
    long userId = PrincipalUserId.parse(principalName);
    userRepository
        .findById(userId)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "当前账号在系统中不存在"));

    ExamOwnedSummary exam =
        examRecordRepository
            .findOwnedByIdAndUserId(examId, userId)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.NOT_FOUND,
                        "EXAM_NOT_FOUND",
                        "试卷不存在或无权查看"));

    List<QuestionGradingDetailItem> questions = questionDetailRepository.listByExamId(examId);

    return new ExamGradingDetailResponse(
        exam.examId(),
        exam.fileName(),
        buildPdfPath(exam),
        exam.fileUrl(),
        exam.storageBucket(),
        exam.storageObjectKey(),
        exam.status(),
        exam.accuracyRate(),
        exam.totalQuestions(),
        exam.correctCount(),
        exam.createdAt(),
        questions);
  }

  /** 优先返回 {@code bucket/objectKey}，否则退回公开 {@code fileUrl}。 */
  private static String buildPdfPath(ExamOwnedSummary e) {
    String b = e.storageBucket();
    String k = e.storageObjectKey();
    if (b != null && !b.isBlank() && k != null && !k.isBlank()) {
      return b.trim() + "/" + k.trim();
    }
    String url = e.fileUrl();
    if (url != null && !url.isBlank()) {
      return url.trim();
    }
    return null;
  }
}
