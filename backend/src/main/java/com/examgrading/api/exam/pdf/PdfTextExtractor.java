package com.examgrading.api.exam.pdf;

import com.examgrading.api.config.PdfProperties;
import com.examgrading.api.error.ApiException;
import java.io.IOException;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * 从 PDF 提取纯文本。
 *
 * <p>原理说明：<b>Apache PDFBox 只读取 PDF 内嵌的「文字层」</b>（可选中复制的文字）。若文件是扫描件、照片或
 * 纯图片页面，则没有文字层，直接 {@link PDFTextStripper} 会得到空串。此时在配置允许且本机已安装 Tesseract
 * 语言包时，会<b>将每页渲染成图片再做 OCR</b> 作为补救。
 */
@Component
public class PdfTextExtractor {

  private static final Logger log = LoggerFactory.getLogger(PdfTextExtractor.class);

  private final PdfProperties pdfProperties;
  private final PdfOcrExtractor pdfOcrExtractor;

  public PdfTextExtractor(PdfProperties pdfProperties, PdfOcrExtractor pdfOcrExtractor) {
    this.pdfProperties = pdfProperties;
    this.pdfOcrExtractor = pdfOcrExtractor;
  }

  /**
   * 从 PDF 字节提取纯文本，供批改与测试接口使用。
   *
   * @throws ApiException PDF 损坏、加密或无法读取时
   */
  public String extractText(byte[] pdfBytes) {
    if (pdfBytes == null || pdfBytes.length == 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_PDF", "PDF 内容为空");
    }
    try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
      if (doc.isEncrypted()) {
        throw new ApiException(
            HttpStatus.BAD_REQUEST, "PDF_ENCRYPTED", "暂不支持加密 PDF，请先解密后上传");
      }
      int pages = doc.getNumberOfPages();
      String fromTextLayer = extractBestTextLayer(doc);
      int score = charScore(fromTextLayer);
      int threshold =
          Math.max(
              pdfProperties.getOcrMinCharScore(),
              pages * Math.max(1, pdfProperties.getOcrMinCharScorePerPage()));

      if (pages > 0 && score < threshold && pdfOcrExtractor.isReady()) {
        try {
          String ocr = pdfOcrExtractor.extract(doc);
          int ocrScore = charScore(ocr);
          if (ocrScore > score) {
            log.info(
                "PDF 文字层较弱(score={})，已改用 OCR(score={})，页数={}",
                score,
                ocrScore,
                pages);
            return ocr;
          }
          log.info("PDF OCR 未优于文字层(score ocr={} vs text={})，保留文字层结果", ocrScore, score);
        } catch (TesseractException e) {
          log.warn("PDF Tesseract OCR 失败：{} — 请检查 tessdata 路径与语言包", e.getMessage());
        } catch (Exception e) {
          log.warn("PDF OCR 过程异常", e);
        }
      } else if (pages > 0 && score < threshold && !pdfOcrExtractor.isReady()) {
        log.warn(
            "PDF 文字层较弱(score={} < 阈值 {})，但未配置有效 tessdata 或已关闭 ocr-enabled；扫描件请安装 "
                + "Tesseract，并设置环境变量 TESSERACT_DATA_PATH 指向 tessdata 目录",
            score,
            threshold);
      }

      return fromTextLayer.trim();
    } catch (ApiException e) {
      throw e;
    } catch (IOException e) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "PDF_PARSE_FAILED",
          "无法解析 PDF：" + e.getMessage());
    }
  }

  /**
   * 多种 PDFBox 策略取「有效字符」最多的一种（改善双栏/顺序错乱导致的漏字）。
   */
  private static String extractBestTextLayer(PDDocument doc) throws IOException {
    String a = strip(doc, true, false);
    String b = strip(doc, false, false);
    String c = strip(doc, true, true);
    String d = strip(doc, false, true);
    String best = a;
    int bestScore = charScore(best);
    for (String candidate : new String[] {b, c, d}) {
      int s = charScore(candidate);
      if (s > bestScore) {
        bestScore = s;
        best = candidate;
      }
    }
    return best != null ? best : "";
  }

  private static String strip(PDDocument doc, boolean sortByPosition, boolean perPage)
      throws IOException {
    PDFTextStripper stripper = new PDFTextStripper();
    stripper.setSortByPosition(sortByPosition);
    stripper.setLineSeparator("\n");
    stripper.setWordSeparator(" ");
    stripper.setSuppressDuplicateOverlappingText(false);
    stripper.setShouldSeparateByBeads(false);
    int n = doc.getNumberOfPages();
    if (n <= 0) {
      return "";
    }
    if (!perPage) {
      stripper.setStartPage(1);
      stripper.setEndPage(n);
      String t = stripper.getText(doc);
      return t != null ? t : "";
    }
    StringBuilder sb = new StringBuilder();
    for (int p = 1; p <= n; p++) {
      stripper.setStartPage(p);
      stripper.setEndPage(p);
      String page = stripper.getText(doc);
      if (page != null && !page.isBlank()) {
        if (sb.length() > 0) {
          sb.append("\n\n");
        }
        sb.append(page);
      }
    }
    return sb.toString();
  }

  /** 字母、数字、中文常用区计 1 分，用于比较哪种抽取方式更有内容。 */
  private static int charScore(String s) {
    if (s == null || s.isEmpty()) {
      return 0;
    }
    int score = 0;
    for (int i = 0; i < s.length(); ) {
      int cp = s.codePointAt(i);
      i += Character.charCount(cp);
      if ((cp >= '0' && cp <= '9')
          || (cp >= 'A' && cp <= 'Z')
          || (cp >= 'a' && cp <= 'z')) {
        score++;
        continue;
      }
      if (cp >= 0x4E00 && cp <= 0x9FFF) {
        score++;
        continue;
      }
      if ((cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0x20000 && cp <= 0x2CEAF)) {
        score++;
      }
    }
    return score;
  }
}
