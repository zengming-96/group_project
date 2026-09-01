package com.examgrading.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

  /** HS256 signing secret; use at least 32 bytes in production. */
  private String secret = "change-me-use-at-least-256-bits-in-production-please";

  private long expirationMs = 7_200_000L;

  public String getSecret() {
    return secret;
  }

  public void setSecret(String secret) {
    this.secret = secret;
  }

  public long getExpirationMs() {
    return expirationMs;
  }

  public void setExpirationMs(long expirationMs) {
    this.expirationMs = expirationMs;
  }
}
