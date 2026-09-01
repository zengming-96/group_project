package com.examgrading.api.exam;

import com.examgrading.api.error.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * 先落库试卷记录，再进入事务性批改；批改失败则将记录标为 status=4。
 */
@Service
public class ExamPipelineService {

  private static final Logger log = LoggerFactory.getLogger(ExamPipelineService.class);

  private final ExamRecordRepository examRecordRepository;
  private final ExamGradingTxService examGradingTxService;

  public ExamPipelineService(
      ExamRecordRepository examRecordRepository, ExamGradingTxService examGradingTxService) {
    this.examRecordRepository = examRecordRepository;
    this.examGradingTxService = examGradingTxService;
  }

  /**
   * @return 成功的 {@code exam_records.id}；失败抛 {@link ApiException} 并将记录标为 status=4
   */
  public long persistAndRunPipeline(
      long userId,
      String fileName,
      String fileUrl,
      String storageBucket,
      String storageObjectKey,
      String contentType,
      long byteSize,
      String extractedPlainText) {
    long examId =
        examRecordRepository.insert(
            userId,
            fileName,
            fileUrl,
            storageBucket,
            storageObjectKey,
            contentType,
            byteSize);
    try {
      examGradingTxService.runMockGrading(examId, userId, extractedPlainText);
      return examId;
    } catch (Exception e) {
      log.error("Exam pipeline failed examId={}", examId, e);
      examRecordRepository.updateStatus(examId, 4);
      String msg =
          e.getMessage() != null && !e.getMessage().isBlank()
              ? e.getMessage()
              : "批改流程异常";
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY, "PROCESSING_FAILED", "解析或批改失败：" + msg);
    }
  }
}
