package com.examgrading.api.exam.pdf;

import com.examgrading.api.config.PdfProperties;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Component;

/**
 * 将 PDF 页渲染为位图后调用 Tesseract。需本机安装语言包并配置 {@code app.pdf.tesseract-data-path}。
 */
@Component
public class PdfOcrExtractor {

  private final PdfProperties pdfProperties;

  public PdfOcrExtractor(PdfProperties pdfProperties) {
    this.pdfProperties = pdfProperties;
  }

  /** 是否具备 OCR 条件（开关打开且 tessdata 路径为可读目录）。 */
  public boolean isReady() {
    if (!pdfProperties.isOcrEnabled()) {
      return false;
    }
    String p = pdfProperties.getTesseractDataPath();
    if (p == null || p.isBlank()) {
      return false;
    }
    Path dir = Paths.get(p.trim());
    return Files.isDirectory(dir) && Files.isReadable(dir);
  }

  /**
   * 全页 OCR，页与页之间用双换行分隔。
   *
   * @throws IOException 渲染失败
   * @throws TesseractException Tesseract 未正确安装或语言包缺失
   */
  public String extract(PDDocument doc) throws IOException, TesseractException {
    Tesseract tesseract = new Tesseract();
    tesseract.setDatapath(pdfProperties.getTesseractDataPath().trim());
    tesseract.setLanguage(pdfProperties.getOcrLanguage());
    tesseract.setOcrEngineMode(1);
    tesseract.setPageSegMode(1);

    PDFRenderer renderer = new PDFRenderer(doc);
    int pages = doc.getNumberOfPages();
    int dpi = Math.max(72, Math.min(400, pdfProperties.getOcrDpi()));
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < pages; i++) {
      BufferedImage img = renderer.renderImageWithDPI(i, dpi, ImageType.RGB);
      String pageText = tesseract.doOCR(img);
      if (pageText != null && !pageText.isBlank()) {
        if (sb.length() > 0) {
          sb.append("\n\n");
        }
        sb.append(pageText.trim());
      }
    }
    return sb.toString().trim();
  }
}
