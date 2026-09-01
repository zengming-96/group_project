package com.examgrading.api.exam;

import com.examgrading.api.exam.dto.SimilarPracticeResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 举一反三：根据当前用户已上传试卷中的某一题，由大模型生成 5 道相似四选一练习题。
 */
@RestController
@RequestMapping("/exams")
public class SimilarPracticeController {

  private final SimilarPracticeService similarPracticeService;

  public SimilarPracticeController(SimilarPracticeService similarPracticeService) {
    this.similarPracticeService = similarPracticeService;
  }

  /**
   * 试卷 ID（examId）与题号（questionNo）在路径中；返回 5 道相似题（题干、A～D、正确答案）。仅试卷所有者可调用；需已配置
   * 千问。每次请求会调用大模型（计费），浏览器或中间件请勿对 URL 做长期缓存。
   */
  @GetMapping("/{examId}/questions/{questionNo}/similar-practice")
  public SimilarPracticeResponse similarPractice(
      @PathVariable long examId,
      @PathVariable int questionNo,
      Authentication authentication) {
    return similarPracticeService.generate(authentication.getName(), examId, questionNo);
  }
}
