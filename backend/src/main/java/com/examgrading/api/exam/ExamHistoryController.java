package com.examgrading.api.exam;

import com.examgrading.api.exam.dto.ExamHistoryResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/exams")
public class ExamHistoryController {

  private final ExamHistoryService examHistoryService;

  public ExamHistoryController(ExamHistoryService examHistoryService) {
    this.examHistoryService = examHistoryService;
  }

  /** 当前登录用户上传过的全部试卷及 PDF 文件名等摘要；仅需 Bearer token。 */
  @GetMapping("/history")
  public ExamHistoryResponse history(Authentication authentication) {
    return examHistoryService.listMyExams(authentication.getName());
  }
}
