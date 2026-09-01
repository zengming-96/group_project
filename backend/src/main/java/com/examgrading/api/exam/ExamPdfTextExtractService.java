package com.examgrading.api.exam;

import com.examgrading.api.config.StorageProperties;
import com.examgrading.api.error.ApiException;
import com.examgrading.api.exam.dto.PdfExtractTextResponse;
import com.examgrading.api.exam.pdf.PdfTextExtractor;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * 测试用：仅校验并抽取 PDF 文本，不写存储、不批改。
 */
@Service
public class ExamPdfTextExtractService {

  private final StorageProperties storageProperties;
  private final PdfTextExtractor pdfTextExtractor;

  public ExamPdfTextExtractService(
      StorageProperties storageProperties, PdfTextExtractor pdfTextExtractor) {
    this.storageProperties = storageProperties;
    this.pdfTextExtractor = pdfTextExtractor;
  }

  public PdfExtractTextResponse extract(MultipartFile file) {
    validatePdf(file);
    final byte[] pdfBytes;
    try {
      pdfBytes = file.getBytes();
    } catch (java.io.IOException e) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "UPLOAD_READ_FAILED", "读取上传文件失败。");
    }
    String text = pdfTextExtractor.extractText(pdfBytes);
    return new PdfExtractTextResponse(text, text.length());
  }

  private void validatePdf(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_FILE", "请上传非空 PDF 文件");
    }
    if (file.getSize() > storageProperties.getMaxFileBytes()) {
      throw new ApiException(
          HttpStatus.PAYLOAD_TOO_LARGE,
          "FILE_TOO_LARGE",
          "文件超过大小限制（"
              + (storageProperties.getMaxFileBytes() / 1024 / 1024)
              + " MB）");
    }
    String name = file.getOriginalFilename();
    String ct = file.getContentType();
    boolean looksPdf =
        (ct != null && ct.toLowerCase(Locale.ROOT).contains("pdf"))
            || (name != null && name.toLowerCase(Locale.ROOT).endsWith(".pdf"));
    if (!looksPdf) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE_TYPE", "仅支持 PDF 文件");
    }
  }
}
