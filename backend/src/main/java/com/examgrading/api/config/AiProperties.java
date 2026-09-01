package com.examgrading.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.ai")
public class AiProperties {

  /** 通义千问（阿里百炼 OpenAI 兼容协议） */
  private Qwen qwen = new Qwen();
  /** 可选：截断后送入模型的 PDF 纯文本最大字符数 */
  private int maxPlainTextChars = 80_000;
  /** 可选：启用大模型时，上传接口 {@code gradingMode} 的展示值 */
  private String gradingModeLabel = "LANGCHAIN4J";
  /**
   * 上传接口 {@code includeExtractedText=true} 时，响应里 {@code extractedText} 最大字符数（防 JSON
   * 过大）。
   */
  private int debugMaxExtractedChars = 120_000;

  public Qwen getQwen() {
    return qwen;
  }

  public void setQwen(Qwen qwen) {
    this.qwen = qwen;
  }

  public int getMaxPlainTextChars() {
    return maxPlainTextChars;
  }

  public void setMaxPlainTextChars(int maxPlainTextChars) {
    this.maxPlainTextChars = maxPlainTextChars;
  }

  public String getGradingModeLabel() {
    return gradingModeLabel;
  }

  public void setGradingModeLabel(String gradingModeLabel) {
    this.gradingModeLabel = gradingModeLabel;
  }

  public int getDebugMaxExtractedChars() {
    return debugMaxExtractedChars;
  }

  public void setDebugMaxExtractedChars(int debugMaxExtractedChars) {
    this.debugMaxExtractedChars = debugMaxExtractedChars;
  }

  /** 是否已配置千问 API Key（未配置则使用内置 MOCK 批改）。 */
  public boolean isQwenConfigured() {
    String k = qwen.getApiKey();
    return k != null && !k.isBlank();
  }

  public static class Qwen {
    /**
     * 必填（否则走 MOCK）：百炼 API Key。建议环境变量 {@code DASHSCOPE_API_KEY}，勿写入 Git。
     */
    private String apiKey = "";
    /**
     * 必填：百炼「OpenAI 兼容」Base URL，须含 {@code /v1}。默认北京地域；新加坡等请改 {@code
     * DASHSCOPE_BASE_URL}。
     */
    private String baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
    /** 必填：模型名，如 qwen-max、qwen-plus（以控制台为准）。 */
    private String modelName = "qwen-max";
    /** 可选：HTTP 超时（秒）。 */
    private int timeoutSeconds = 180;

    public String getApiKey() {
      return apiKey;
    }

    public void setApiKey(String apiKey) {
      this.apiKey = apiKey;
    }

    public String getModelName() {
      return modelName;
    }

    public void setModelName(String modelName) {
      this.modelName = modelName;
    }

    public String getBaseUrl() {
      return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
      this.baseUrl = baseUrl;
    }

    public int getTimeoutSeconds() {
      return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
      this.timeoutSeconds = timeoutSeconds;
    }
  }
}
