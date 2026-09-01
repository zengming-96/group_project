package com.examgrading.api.exam.ai;

import com.examgrading.api.config.AiProperties;
import com.examgrading.api.exam.ExamQuestionType;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 使用 LangChain4j OpenAI 兼容接口：根据 PDF 提取的纯文本生成逐题批改结果（严格 JSON 解析）。
 */
public class LangChain4jExamGradingAiClient implements ExamGradingAiClient {

  private static final Logger log = LoggerFactory.getLogger(LangChain4jExamGradingAiClient.class);

  private static final String SYSTEM_PROMPT =
      """
      你是专业阅卷助手，擅长中国大陆「行政职业能力测验/行测」及一般客观题。用户将提供从 PDF 抽取的纯文本（常缺图、双栏乱序、扫描噪点；**卷面通常不附标准答案**）。

      核心要求（无参考答案场景）：
      1. **stdAnswer**：在卷面**没有**印刷「参考答案/答案表」时，你必须根据**可见题干与选项**，结合常识与学科推理，给出**你认为最可能正确**的选项字母 A-D。推理要简洁严谨；若信息严重不足、或依赖看不清的图表，**仍须填一个字母，默认填 "C"**（勿使用 "?"、"未知"），并在 aiAnalysis 首句说明「信息不足，按约定默认 C」。
      2. 若文本中**同时出现**官方答案表/KEY，可与你的推理对照，**以卷面明示答案为准**填入 stdAnswer（更可靠）。
      3. **userAnswer**：考生所选 A-D；仅从「答题卡/填涂/手写/括号内选项」等推断；**无法推断时填 "C"**（勿使用 "?"、"未知"），并在 aiAnalysis 中说明系默认占位。
      4. **correct**：userAnswer 与 stdAnswer 均为 A-D 且相同为 true。
      5. **questionDetail**：题干摘要（≤200 字），从原文摘抄压缩；禁止空话「未提供题干摘要」。仅有片段则写「第N题（原文节选：…）」。
      6. **questionType**（整型，必填）：对每道题按行测模块分类，只能填 1～5：
         1=言语判断，2=数量关系，3=判断推理，4=资料分析，5=常识判断。
         请根据题干与选项内容判断最贴切的一类；若难以区分，选最接近的一项。
      7. **aiAnalysis**：2～4 句中文。须包含：① 你如何推出 stdAnswer（关键理由）；② 与 userAnswer 比较结论。勿只写「无法判分」而不尝试推理。

      题量：questionNo 与卷面一致，勿合并、勿跳号；能识别几题输出几条。

      只输出一个 JSON 对象，禁止 Markdown 代码块。格式：
      {"questions":[{"questionNo":1,"questionDetail":"…","questionType":1,"userAnswer":"C","stdAnswer":"B","correct":false,"aiAnalysis":"…"}]}
      若完全无法识别任何题目，输出 {"questions":[]}。
      """;

  private final ChatLanguageModel chatModel;
  private final AiProperties aiProperties;
  private final ObjectMapper objectMapper;

  public LangChain4jExamGradingAiClient(
      ChatLanguageModel chatModel, AiProperties aiProperties, ObjectMapper objectMapper) {
    this.chatModel = chatModel;
    this.aiProperties = aiProperties;
    this.objectMapper = objectMapper;
  }

  @Override
  public String gradingModeLabel() {
    return aiProperties.getGradingModeLabel();
  }

  @Override
  public List<QuestionDraft> gradeFromPlainText(String plainText, long examId) {
    String raw = plainText == null ? "" : plainText;
    String normalized = normalizeExtractedText(raw);
    int max = Math.max(4_000, aiProperties.getMaxPlainTextChars());
    String body =
        normalized.length() <= max
            ? normalized
            : normalized.substring(0, max) + "\n\n...[文本已截断，全文共 " + normalized.length() + " 字符]";
    int lineCount = body.isEmpty() ? 0 : body.split("\n", -1).length;
    String userBlock =
        "examId="
            + examId
            + "\n\n【抽取文本统计】字符数约 "
            + normalized.length()
            + "，行数约 "
            + lineCount
            + "。请结合统计判断是否有大量内容丢失（如远少于预期题量）。\n"
            + "【批改说明】卷面一般**没有**标准答案；请自行推理 stdAnswer 并与考生选项比对。**凡推不出 userAnswer/stdAnswer 时一律填字母 C，禁止使用 ?。**\n"
            + "【题型】questionType 必须为 1～5："
            + ExamQuestionType.promptLine()
            + "。\n\n"
            + "以下是从 PDF 提取的纯文本：\n\n"
            + body;

    Response<dev.langchain4j.data.message.AiMessage> resp =
        chatModel.generate(
            List.of(SystemMessage.from(SYSTEM_PROMPT), UserMessage.from(userBlock)));
    String text = resp.content().text();
    if (text == null || text.isBlank()) {
      throw new IllegalStateException("模型返回空内容");
    }
    String json = stripMarkdownFence(text.trim());
    try {
      JsonNode root = objectMapper.readTree(json);
      JsonNode arr = root.get("questions");
      if (arr == null || !arr.isArray()) {
        throw new IllegalArgumentException("JSON 缺少 questions 数组");
      }
      List<LlmQuestionRow> rows =
          objectMapper.readerForListOf(LlmQuestionRow.class).readValue(arr);
      if (rows.isEmpty()) {
        throw new IllegalStateException("模型未识别到任何题目，请确认 PDF 为可读试卷内容");
      }
      rows.sort(Comparator.comparingInt(r -> r.questionNo != null ? r.questionNo : 0));
      List<QuestionDraft> out = new ArrayList<>(rows.size());
      int seq = 1;
      for (LlmQuestionRow r : rows) {
        int no = r.questionNo != null ? r.questionNo : seq;
        String detail =
            r.questionDetail == null || r.questionDetail.isBlank()
                ? "（题干未识别）"
                : sanitizeQuestionDetail(r.questionDetail.trim());
        short qtype = ExamQuestionType.normalize(r.questionType);
        String ua = normalizeAnswer(r.userAnswer);
        String sa = normalizeAnswer(r.stdAnswer);
        boolean correct = resolveCorrect(r.correct, ua, sa);
        String analysis =
            r.aiAnalysis == null || r.aiAnalysis.isBlank()
                ? (correct ? "判定为正确。" : "判定为错误。")
                : r.aiAnalysis.trim();
        out.add(new QuestionDraft(no, detail, qtype, ua, sa, correct, analysis));
        seq++;
      }
      out.sort(Comparator.comparingInt(QuestionDraft::questionNo));
      return out;
    } catch (IllegalStateException e) {
      throw e;
    } catch (Exception e) {
      log.warn(
          "LLM JSON 解析失败 examId={} snippet={}",
          examId,
          json.length() > 400 ? json.substring(0, 400) + "..." : json);
      throw new IllegalArgumentException("模型输出无法解析为题目 JSON：" + e.getMessage(), e);
    }
  }

  private static boolean resolveCorrect(Boolean llmFlag, String ua, String sa) {
    if (isChoiceLetter(ua) && isChoiceLetter(sa)) {
      return ua.equals(sa);
    }
    if (llmFlag != null) {
      return llmFlag;
    }
    return false;
  }

  private static boolean isChoiceLetter(String s) {
    return s != null && s.length() == 1 && s.charAt(0) >= 'A' && s.charAt(0) <= 'D';
  }

  /** 无法识别或模型输出 ?/未知 时统一为 C，与业务约定一致。 */
  private static final String DEFAULT_CHOICE = "C";

  private static String normalizeAnswer(String s) {
    if (s == null || s.isBlank()) {
      return DEFAULT_CHOICE;
    }
    String rawTrim = s.trim();
    String t = rawTrim.toUpperCase(Locale.ROOT);
    for (int i = 0; i < t.length(); i++) {
      char c = t.charAt(i);
      if (c >= 'A' && c <= 'D') {
        return String.valueOf(c);
      }
    }
    if ("?".equals(t)
        || "未知".equals(rawTrim)
        || "N/A".equalsIgnoreCase(rawTrim)
        || "NA".equalsIgnoreCase(rawTrim)
        || "无".equals(rawTrim)
        || "-".equals(rawTrim)) {
      return DEFAULT_CHOICE;
    }
    return DEFAULT_CHOICE;
  }

  /** 压缩空白，减轻双栏/扫描 PDF 噪声，便于模型对齐题号。 */
  private static String normalizeExtractedText(String s) {
    if (s.isEmpty()) {
      return "";
    }
    String t = s.replace('\r', '\n');
    t = t.replaceAll("[ \\t\\f]+", " ");
    t = t.replaceAll("\\n{3,}", "\n\n");
    return t.trim();
  }

  private static String sanitizeQuestionDetail(String detail) {
    String compact = detail.replaceAll("\\s+", "");
    if (compact.equals("未提供题干摘要")
        || compact.equals("题干摘要")
        || compact.equals("无题干")
        || compact.equals("暂无题干")
        || compact.equals("题目内容缺失")) {
      return "（题干在 PDF 文本中未抽取到；若为扫描版或纯图片卷，需 OCR 或上传含文字层的 PDF）";
    }
    return detail;
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
  private static class LlmQuestionRow {
    public Integer questionNo;
    public String questionDetail;
    public Integer questionType;

    @JsonProperty("stdAnswer")
    @JsonAlias({"correctAnswer", "standardAnswer"})
    public String stdAnswer;

    public String userAnswer;
    public Boolean correct;
    public String aiAnalysis;
  }
}
