package com.examgrading.api.config;

import dev.langchain4j.model.openai.OpenAiChatModel;
import java.time.Duration;

/** 根据 {@link AiProperties} 构建百炼 OpenAI 兼容 {@link OpenAiChatModel}。 */
public final class QwenChatModelFactory {

  private QwenChatModelFactory() {}

  public static OpenAiChatModel build(AiProperties props) {
    AiProperties.Qwen o = props.getQwen();
    String key = o.getApiKey().trim();
    String modelName =
        o.getModelName() == null || o.getModelName().isBlank()
            ? "qwen-max"
            : o.getModelName().trim();
    int sec = Math.max(30, o.getTimeoutSeconds());
    var b =
        OpenAiChatModel.builder()
            .apiKey(key)
            .modelName(modelName)
            .timeout(Duration.ofSeconds(sec));
    if (o.getBaseUrl() != null && !o.getBaseUrl().isBlank()) {
      b.baseUrl(o.getBaseUrl().trim());
    }
    return b.build();
  }
}
