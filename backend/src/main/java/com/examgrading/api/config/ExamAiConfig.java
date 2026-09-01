package com.examgrading.api.config;

import com.examgrading.api.exam.ai.ExamGradingAiClient;
import com.examgrading.api.exam.ai.LangChain4jExamGradingAiClient;
import com.examgrading.api.exam.ai.MockExamGradingAiClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.model.openai.OpenAiChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ExamAiConfig {

  private static final Logger log = LoggerFactory.getLogger(ExamAiConfig.class);

  @Bean
  public ExamGradingAiClient examGradingAiClient(
      AiProperties aiProperties, ObjectMapper objectMapper) {
    if (!aiProperties.isQwenConfigured()) {
      log.warn(
          "大模型批改未启用：app.ai.qwen.api-key 为空。请设置环境变量 DASHSCOPE_API_KEY（勿为空字符串）；"
              + "当前将使用 MOCK_AI。");
      return new MockExamGradingAiClient();
    }
    AiProperties.Qwen q = aiProperties.getQwen();
    log.info(
        "千问批改已启用：model={} baseUrl={}",
        q.getModelName(),
        q.getBaseUrl() != null && !q.getBaseUrl().isBlank() ? "[已配置]" : "[空]");
    OpenAiChatModel model = QwenChatModelFactory.build(aiProperties);
    return new LangChain4jExamGradingAiClient(model, aiProperties, objectMapper);
  }
}
