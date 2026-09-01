package com.examgrading.api.exam;

import com.examgrading.api.config.AiProperties;
import com.examgrading.api.config.QwenChatModelFactory;
import com.examgrading.api.error.ApiException;
import com.examgrading.api.exam.dto.QuestionGradingDetailItem;
import com.examgrading.api.exam.dto.SimilarPracticeQuestionItem;
import com.examgrading.api.exam.dto.SimilarPracticeResponse;
import com.examgrading.api.security.PrincipalUserId;
import com.examgrading.api.user.UserRepository;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.openai.OpenAiChatModel;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class SimilarPracticeService {

  private static final Logger log = LoggerFactory.getLogger(SimilarPracticeService.class);

  private static final String SYSTEM_PROMPT =
      """
      你是资深命题老师，擅长根据一道已有客观题「举一反三」出辨析型相似题，帮助考生巩固知识点。

      用户会提供一道题的题干摘要、题型、考生作答、参考正确选项及解析（可能不完整）。请你：
      1. 先理解考查的知识与能力点；
      2. 新编 **恰好 5 道** 单选题，难度与风格尽量接近原题但**不得照抄原文**；
      3. 每道题须含完整题干、四个互斥选项 A/B/C/D、**唯一**正确答案字母；
      4. 用中文表述，选项不要过短（避免无意义占位）。

      只输出一个 JSON 对象，禁止 Markdown 代码块。严格格式：
      {"questions":[{"no":1,"question":"题干","optionA":"…","optionB":"…","optionC":"…","optionD":"…","correctAnswer":"A"},{"no":2,...},...,{"no":5,...}]}
      no 必须为 1～5；correctAnswer 只能是 A、B、C、D 之一。
      """;

  private final UserRepository userRepository;
  private final ExamRecordRepository examRecordRepository;
  private final QuestionDetailRepository questionDetailRepository;
  private final AiProperties aiProperties;
  private final ObjectMapper objectMapper;

  public SimilarPracticeService(
      UserRepository userRepository,
      ExamRecordRepository examRecordRepository,
      QuestionDetailRepository questionDetailRepository,
      AiProperties aiProperties,
      ObjectMapper objectMapper) {
    this.userRepository = userRepository;
    this.examRecordRepository = examRecordRepository;
    this.questionDetailRepository = questionDetailRepository;
    this.aiProperties = aiProperties;
    this.objectMapper = objectMapper;
  }

  public SimilarPracticeResponse generate(String principalName, long examId, int questionNo) {
    if (questionNo < 1) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_QUESTION_NO", "题目号须为正整数");
    }
    if (!aiProperties.isQwenConfigured()) {
      throw new ApiException(
          HttpStatus.SERVICE_UNAVAILABLE,
          "LLM_NOT_CONFIGURED",
          "未配置大模型（app.ai.qwen.api-key / DASHSCOPE_API_KEY），无法生成举一反三题目。");
    }

    long userId = PrincipalUserId.parse(principalName);
    userRepository
        .findById(userId)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "当前账号在系统中不存在"));

    examRecordRepository
        .findOwnedByIdAndUserId(examId, userId)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "EXAM_NOT_FOUND", "试卷不存在或无权访问"));

    QuestionGradingDetailItem source =
        questionDetailRepository
            .findByExamIdAndQuestionNo(examId, questionNo)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.NOT_FOUND,
                        "QUESTION_NOT_FOUND",
                        "该试卷中不存在题号为 " + questionNo + " 的题目"));

    String userBlock = buildUserBlock(source);
    OpenAiChatModel model = QwenChatModelFactory.build(aiProperties);
    String raw =
        model
            .generate(List.of(SystemMessage.from(SYSTEM_PROMPT), UserMessage.from(userBlock)))
            .content()
            .text();
    if (raw == null || raw.isBlank()) {
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY, "LLM_EMPTY", "模型未返回内容，请稍后重试");
    }
    String json = stripMarkdownFence(raw.trim());
    List<SimilarPracticeQuestionItem> similar;
    try {
      similar = parseSimilarQuestions(json);
    } catch (Exception e) {
      log.warn("举一反三 JSON 解析失败: {}", e.getMessage());
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "LLM_PARSE_FAILED",
          "模型输出无法解析为题目列表：" + e.getMessage());
    }
    if (similar.size() != 5) {
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "LLM_OUTPUT_INVALID",
          "模型应返回恰好 5 道相似题，实际为 " + similar.size() + " 道");
    }

    return new SimilarPracticeResponse(
        examId,
        questionNo,
        nullToEmpty(source.question()),
        nullToEmpty(source.userAnswer()),
        nullToEmpty(source.correctAnswer()),
        similar);
  }

  private static String buildUserBlock(QuestionGradingDetailItem q) {
    return "【原题信息】\n"
        + "题型代码："
        + q.questionType()
        + "（"
        + ExamQuestionType.promptLine()
        + "）\n"
        + "题干摘要：\n"
        + nullToEmpty(q.question())
        + "\n考生作答："
        + nullToEmpty(q.userAnswer())
        + "\n参考正确选项："
        + nullToEmpty(q.correctAnswer())
        + "\n是否判对："
        + q.correct()
        + "\n解析/说明：\n"
        + nullToEmpty(q.analysis());
  }

  private static String nullToEmpty(String s) {
    return s == null ? "" : s;
  }

  private List<SimilarPracticeQuestionItem> parseSimilarQuestions(String json) throws Exception {
    JsonNode root = objectMapper.readTree(json);
    JsonNode arr = root.get("questions");
    if (arr == null || !arr.isArray()) {
      throw new IllegalArgumentException("缺少 questions 数组");
    }
    List<LlmSimilarRow> rows =
        objectMapper.readerForListOf(LlmSimilarRow.class).readValue(arr);
    rows.sort(Comparator.comparingInt(r -> r.no != null ? r.no : 0));
    List<SimilarPracticeQuestionItem> out = new ArrayList<>(5);
    for (LlmSimilarRow r : rows) {
      int idx = r.no != null ? r.no : out.size() + 1;
      String letter = normalizeCorrect(r.correctAnswer);
      out.add(
          new SimilarPracticeQuestionItem(
              idx,
              trimOrEmpty(r.question),
              trimOrEmpty(r.optionA),
              trimOrEmpty(r.optionB),
              trimOrEmpty(r.optionC),
              trimOrEmpty(r.optionD),
              letter));
    }
    return out;
  }

  private static String trimOrEmpty(String s) {
    return s == null ? "" : s.trim();
  }

  private static String normalizeCorrect(String s) {
    if (s == null || s.isBlank()) {
      return "C";
    }
    String t = s.trim().toUpperCase(Locale.ROOT);
    for (int i = 0; i < t.length(); i++) {
      char c = t.charAt(i);
      if (c >= 'A' && c <= 'D') {
        return String.valueOf(c);
      }
    }
    return "C";
  }

  private static String stripMarkdownFence(String s) {
    if (!s.startsWith("```")) {
      return s;
    }
    int firstNl = s.indexOf('\n');
    String rest = firstNl > 0 ? s.substring(firstNl + 1) : s;
    int end = rest.lastIndexOf("```");
    if (end > 0) {
      rest = rest.substring(0, end);
    }
    return rest.trim();
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private static class LlmSimilarRow {
    public Integer no;

    @JsonProperty("question")
    @JsonAlias({"stem", "title"})
    public String question;

    public String optionA;
    public String optionB;
    public String optionC;
    public String optionD;

    @JsonProperty("correctAnswer")
    @JsonAlias({"answer", "stdAnswer"})
    public String correctAnswer;
  }
}
