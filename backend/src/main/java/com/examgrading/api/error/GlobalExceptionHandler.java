package com.examgrading.api.error;

import java.util.stream.Collectors;
import javax.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<ErrorResponse> handleApi(ApiException ex, HttpServletRequest request) {
    return ResponseEntity.status(ex.getStatus())
        .body(new ErrorResponse(ex.getCode(), ex.getMessage(), requestId(request)));
  }

  @ExceptionHandler(MissingServletRequestPartException.class)
  public ResponseEntity<ErrorResponse> handleMissingPart(
      MissingServletRequestPartException ex, HttpServletRequest request) {
    String name = ex.getRequestPartName();
    String hint =
        "file".equals(name)
            ? "请使用 multipart/form-data，表单字段名必须为 file，并选择 PDF 文件。"
            : "缺少请求部件：" + name;
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse("MISSING_FILE_PART", hint, requestId(request)));
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ResponseEntity<ErrorResponse> handleMaxUpload(
      MaxUploadSizeExceededException ex, HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
        .body(
            new ErrorResponse(
                "FILE_TOO_LARGE", "上传体积超过服务器限制。", requestId(request)));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponse> handleValidation(
      MethodArgumentNotValidException ex, HttpServletRequest request) {
    String msg =
        ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining("; "));
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse("INVALID_PARAM", msg, requestId(request)));
  }

  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<ErrorResponse> handleMethodNotSupported(
      HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
    String[] supported = ex.getSupportedMethods();
    String methods =
        supported != null && supported.length > 0
            ? String.join(", ", supported)
            : "（见接口文档）";
    String uri = request.getRequestURI();
    String extra =
        uri != null && uri.contains("/users/me")
            ? " 修改个人信息必须使用 PATCH /api/users/me，不能使用 POST。"
            : "";
    return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
        .body(
            new ErrorResponse(
                "METHOD_NOT_ALLOWED",
                "当前请求方法为 "
                    + ex.getMethod()
                    + "，本接口仅支持："
                    + methods
                    + "。"
                    + extra,
                requestId(request)));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ErrorResponse> handleNotReadable(
      HttpMessageNotReadableException ex, HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(
            new ErrorResponse(
                "BAD_REQUEST_BODY",
                "请求体不是合法 JSON 或格式不对：" + rootMessage(ex),
                requestId(request)));
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<ErrorResponse> handleDataIntegrity(
      DataIntegrityViolationException ex, HttpServletRequest request) {
    log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(
            new ErrorResponse(
                "DATA_CONFLICT",
                "违反数据库约束（常见：邮箱或用户名与他人重复，或字段超长）。请检查输入后重试。",
                requestId(request)));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> handleOther(Exception ex, HttpServletRequest request) {
    log.error("Unhandled exception", ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(
            new ErrorResponse(
                "INTERNAL_ERROR", "服务暂时不可用，请稍后重试。", requestId(request)));
  }

  private static String requestId(HttpServletRequest request) {
    String id = request.getHeader("X-Request-Id");
    return id != null && !id.isBlank() ? id : null;
  }

  private static String rootMessage(Throwable ex) {
    Throwable t = ex;
    while (t.getCause() != null && t.getCause() != t) {
      t = t.getCause();
    }
    String m = t.getMessage();
    return m != null ? m : ex.getClass().getSimpleName();
  }
}
