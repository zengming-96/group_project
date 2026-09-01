package com.examgrading.api.exam;

import com.examgrading.api.exam.dto.PdfExtractTextResponse;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 测试用接口：只抽取 PDF 文本，便于核对 {@link com.examgrading.api.exam.pdf.PdfTextExtractor} 效果。
 */
@RestController
@RequestMapping("/exams")
public class ExamPdfTextExtractController {

  private final ExamPdfTextExtractService examPdfTextExtractService;

  public ExamPdfTextExtractController(ExamPdfTextExtractService examPdfTextExtractService) {
    this.examPdfTextExtractService = examPdfTextExtractService;
  }

  /**
   * 表单字段名：{@code file}；需登录 JWT。不写入对象存储、不调用大模型、不写数据库。
   *
   * @return {@link PdfExtractTextResponse#text()} 为抽取的纯文本，{@link PdfExtractTextResponse#charCount()}
   *     为其 {@link String#length()}（UTF-16 代码单元数）。
   */
  @PostMapping(value = "/test/extract-text", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public PdfExtractTextResponse extractText(@RequestPart("file") MultipartFile file) {
    return examPdfTextExtractService.extract(file);
  }
}
