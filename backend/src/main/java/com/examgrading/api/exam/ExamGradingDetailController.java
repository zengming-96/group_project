package com.examgrading.api.exam;

import com.examgrading.api.exam.dto.ExamGradingDetailResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/exams")
public class ExamGradingDetailController {

  private final ExamGradingDetailService examGradingDetailService;

  public ExamGradingDetailController(ExamGradingDetailService examGradingDetailService) {
    this.examGradingDetailService = examGradingDetailService;
  }

  /**
   * 单次批改详情：PDF 路径/名称、状态、正确率、题量及逐题（题干、作答、标答、是否正确、解析等）。仅试卷所有者可查。
   */
  @GetMapping("/{examId}/detail")
  public ExamGradingDetailResponse detail(
      @PathVariable long examId, Authentication authentication) {
    return examGradingDetailService.getDetail(authentication.getName(), examId);
  }
}
