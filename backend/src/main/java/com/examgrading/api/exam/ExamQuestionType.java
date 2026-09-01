package com.examgrading.api.exam;

/**
 * 行测类试卷题目分类，写入 {@code question_details.question_type} 与 {@code exam_type_stats.question_type}。
 */
public final class ExamQuestionType {

  public static final short YANYU_PANDUAN = 1;
  public static final short SHULIANG_GUANXI = 2;
  public static final short PANDUAN_TUILI = 3;
  public static final short ZILIAO_FENXI = 4;
  public static final short CHANGSHI_PANDUAN = 5;

  public static final short MIN = 1;
  public static final short MAX = 5;

  private ExamQuestionType() {}

  /** 将模型输出规范到 1～5；非法或 null 时默认为 {@link #YANYU_PANDUAN}。 */
  public static short normalize(Integer value) {
    if (value == null) {
      return YANYU_PANDUAN;
    }
    int v = value;
    if (v >= MIN && v <= MAX) {
      return (short) v;
    }
    return YANYU_PANDUAN;
  }

  /** 供大模型 system prompt 使用的一行说明。 */
  public static String promptLine() {
    return "1=言语判断，2=数量关系，3=判断推理，4=资料分析，5=常识判断";
  }

  /** 统计接口展示用中文名；非法类型返回「其它」。 */
  public static String displayName(int type) {
    return switch (type) {
      case YANYU_PANDUAN -> "言语判断";
      case SHULIANG_GUANXI -> "数量关系";
      case PANDUAN_TUILI -> "判断推理";
      case ZILIAO_FENXI -> "资料分析";
      case CHANGSHI_PANDUAN -> "常识判断";
      default -> "其它";
    };
  }
}
