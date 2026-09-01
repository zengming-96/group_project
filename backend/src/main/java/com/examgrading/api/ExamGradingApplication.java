package com.examgrading.api;

import com.examgrading.api.config.AiProperties;
import com.examgrading.api.config.JwtProperties;
import com.examgrading.api.config.PdfProperties;
import com.examgrading.api.config.StorageProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({
  JwtProperties.class,
  StorageProperties.class,
  AiProperties.class,
  PdfProperties.class
})
public class ExamGradingApplication {

  public static void main(String[] args) {
    SpringApplication.run(ExamGradingApplication.class, args);
  }
}
