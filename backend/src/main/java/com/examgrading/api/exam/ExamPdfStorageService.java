package com.examgrading.api.exam;

import com.examgrading.api.config.AiProperties;
import com.examgrading.api.config.StorageProperties;
import com.examgrading.api.error.ApiException;
import com.examgrading.api.exam.ai.ExamGradingAiClient;
import com.examgrading.api.exam.dto.ExamGradingDetailResponse;
import com.examgrading.api.exam.dto.ExamPdfUploadCompleteResponse;
import com.examgrading.api.exam.pdf.PdfTextExtractor;
import com.examgrading.api.security.PrincipalUserId;
import com.examgrading.api.user.UserRepository;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Service
public class ExamPdfStorageService {

  private static final Logger log = LoggerFactory.getLogger(ExamPdfStorageService.class);

  private final StorageProperties storageProperties;
  private final ExamPipelineService examPipelineService;
  private final ExamGradingDetailService examGradingDetailService;
  private final PdfTextExtractor pdfTextExtractor;
  private final UserRepository userRepository;
  private final ObjectProvider<S3Client> s3ClientProvider;
  private final ExamGradingAiClient examGradingAiClient;
  private final AiProperties aiProperties;

  public ExamPdfStorageService(
      StorageProperties storageProperties,
      ExamPipelineService examPipelineService,
      ExamGradingDetailService examGradingDetailService,
      PdfTextExtractor pdfTextExtractor,
      UserRepository userRepository,
      ObjectProvider<S3Client> s3ClientProvider,
      ExamGradingAiClient examGradingAiClient,
      AiProperties aiProperties) {
    this.storageProperties = storageProperties;
    this.examPipelineService = examPipelineService;
    this.examGradingDetailService = examGradingDetailService;
    this.pdfTextExtractor = pdfTextExtractor;
    this.userRepository = userRepository;
    this.s3ClientProvider = s3ClientProvider;
    this.examGradingAiClient = examGradingAiClient;
    this.aiProperties = aiProperties;
  }

  public ExamPdfUploadCompleteResponse upload(
      MultipartFile file, String principalName, boolean includeExtractedText) {
    S3Client s3 = s3ClientProvider.getIfAvailable();
    if (s3 == null) {
      throw new ApiException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "STORAGE_DISABLED",
          "对象存储未启用或未配置：设置 app.storage.enabled=true 并填写 Supabase S3 端点与密钥；local  profile 默认关闭。");
    }

    long userId = PrincipalUserId.parse(principalName);
    userRepository
        .findById(userId)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "当前账号在系统中不存在"));

    validatePdf(file);

    final byte[] pdfBytes;
    try {
      pdfBytes = file.getBytes();
    } catch (java.io.IOException e) {
      log.error("Read upload bytes failed", e);
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "UPLOAD_READ_FAILED", "读取上传文件失败。");
    }

    String extractedText = pdfTextExtractor.extractText(pdfBytes);
    if (log.isDebugEnabled()) {
      int n = Math.min(8_000, extractedText.length());
      log.debug(
          "PDF extracted length={} chars, first {} chars:\n{}",
          extractedText.length(),
          n,
          n == 0 ? "" : extractedText.substring(0, n));
    }

    StorageProperties.Supabase cfg = storageProperties.getSupabase();
    String bucket = cfg.getBucket().trim();
    String objectKey = userId + "/" + UUID.randomUUID() + ".pdf";
    String contentType =
        file.getContentType() != null && !file.getContentType().isBlank()
            ? file.getContentType().trim()
            : "application/pdf";

    try {
      s3.putObject(
          PutObjectRequest.builder()
              .bucket(bucket)
              .key(objectKey)
              .contentType(contentType)
              .contentLength((long) pdfBytes.length)
              .build(),
          RequestBody.fromBytes(pdfBytes));
    } catch (S3Exception e) {
      log.error("Supabase S3 PutObject failed: {}", e.awsErrorDetails(), e);
      throw new ApiException(
          HttpStatus.BAD_GATEWAY,
          "STORAGE_UPLOAD_FAILED",
          "写入对象存储失败，请检查桶名、策略与密钥。");
    }

    String displayName = safeDisplayFileName(file.getOriginalFilename());
    String publicUrl = buildPublicFileUrl(cfg, bucket, objectKey);

    long examId =
        examPipelineService.persistAndRunPipeline(
            userId,
            displayName,
            publicUrl,
            bucket,
            objectKey,
            contentType,
            pdfBytes.length,
            extractedText);
    ExamGradingDetailResponse detail = examGradingDetailService.getDetail(principalName, examId);
    String responseExtracted = null;
    Integer totalChars = null;
    if (includeExtractedText) {
      totalChars = extractedText.length();
      int cap = Math.max(1_000, aiProperties.getDebugMaxExtractedChars());
      if (extractedText.length() > cap) {
        responseExtracted =
            extractedText.substring(0, cap)
                + "\n\n...[extractedText 已在响应中截断；全文长度见 extractedTextTotalChars，或增大 app.ai.debug-max-extracted-chars / 看服务端 DEBUG 日志]";
      } else {
        responseExtracted = extractedText;
      }
    }
    return new ExamPdfUploadCompleteResponse(
        examGradingAiClient.gradingModeLabel(), detail, responseExtracted, totalChars);
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

  private static String safeDisplayFileName(String original) {
    if (original == null || original.isBlank()) {
      return "upload.pdf";
    }
    String base = original.replace('\\', '/');
    int slash = base.lastIndexOf('/');
    if (slash >= 0 && slash < base.length() - 1) {
      base = base.substring(slash + 1);
    }
    if (base.length() > 255) {
      base = base.substring(0, 255);
    }
    return base;
  }

  private static String buildPublicFileUrl(
      StorageProperties.Supabase cfg, String bucket, String objectKey) {
    String base = cfg.getPublicObjectBaseUrl();
    if (base == null || base.isBlank()) {
      return null;
    }
    String b = base.trim().replaceAll("/+$", "");
    return b + "/" + bucket + "/" + objectKey;
  }
}
