package com.examgrading.api.exam;

import com.examgrading.api.exam.dto.ExamPdfUploadCompleteResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/exams")
public class ExamPdfUploadController {

  private final ExamPdfStorageService examPdfStorageService;

  public ExamPdfUploadController(ExamPdfStorageService examPdfStorageService) {
    this.examPdfStorageService = examPdfStorageService;
  }

  /**
   * 上传 PDF 至 Storage 并完成批改；响应含 {@code gradingMode} 及 {@code detail}，字段与 GET
   * {@code /exams/{id}/detail} 一致（路径、状态、正确率、逐题解析等）。
   *
   * <p>表单字段名：{@code file}；需登录 JWT。
   *
   * <p>调试：查询参数 {@code includeExtractedText=true} 时，响应中附带 PDF 抽取的纯文本（及全文长度），便于核对大模型
   * 输入；生产环境慎用（体积与隐私）。
   */
  @PostMapping(value = "/upload-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ExamPdfUploadCompleteResponse uploadPdf(
      @RequestPart("file") MultipartFile file,
      @RequestParam(value = "includeExtractedText", defaultValue = "false") boolean includeExtractedText,
      Authentication authentication) {
    return examPdfStorageService.upload(file, authentication.getName(), includeExtractedText);
  }
}
