package com.examgrading.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.pdf")
public class PdfProperties {

  /**
   * 当 PDF 文字层过弱时是否尝试 Tesseract OCR。为 true 时须配置有效 {@link #tesseractDataPath}，否则自动跳过
   * OCR。
   */
  private boolean ocrEnabled = true;

  private int ocrDpi = 200;
  /** 语言包，如 chi_sim+eng（需 tessdata 中有对应 traineddata） */
  private String ocrLanguage = "chi_sim+eng";
  /**
   * tessdata 目录绝对路径（内含 chi_sim.traineddata、eng.traineddata 等）。可用环境变量
   * TESSERACT_DATA_PATH。
   */
  private String tesseractDataPath = "";
  /**
   * 「有效字符」计分低于该值且文档至少一页时尝试 OCR。有效字符含中文、字母、数字。
   */
  private int ocrMinCharScore = 80;
  /** 与页数相关：阈值至少为 pages * 每页最少有效字符 */
  private int ocrMinCharScorePerPage = 15;

  public boolean isOcrEnabled() {
    return ocrEnabled;
  }

  public void setOcrEnabled(boolean ocrEnabled) {
    this.ocrEnabled = ocrEnabled;
  }

  public int getOcrDpi() {
    return ocrDpi;
  }

  public void setOcrDpi(int ocrDpi) {
    this.ocrDpi = ocrDpi;
  }

  public String getOcrLanguage() {
    return ocrLanguage;
  }

  public void setOcrLanguage(String ocrLanguage) {
    this.ocrLanguage = ocrLanguage;
  }

  public String getTesseractDataPath() {
    return tesseractDataPath;
  }

  public void setTesseractDataPath(String tesseractDataPath) {
    this.tesseractDataPath = tesseractDataPath;
  }

  public int getOcrMinCharScore() {
    return ocrMinCharScore;
  }

  public void setOcrMinCharScore(int ocrMinCharScore) {
    this.ocrMinCharScore = ocrMinCharScore;
  }

  public int getOcrMinCharScorePerPage() {
    return ocrMinCharScorePerPage;
  }

  public void setOcrMinCharScorePerPage(int ocrMinCharScorePerPage) {
    this.ocrMinCharScorePerPage = ocrMinCharScorePerPage;
  }
}
