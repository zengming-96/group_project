package com.examgrading.api.auth.dto;

/** 注册成功：用户信息 + JWT；请求头仍使用 {@code Authorization: Bearer <token>}（Bearer 为 HTTP 惯例，不必在 JSON 重复）。 */
public class RegisterResponse {

  private final String id;
  private final String email;
  private final String name;
  private final String token;
  private final long expiresIn;

  public RegisterResponse(String id, String email, String name, String token, long expiresIn) {
    this.id = id;
    this.email = email;
    this.name = name;
    this.token = token;
    this.expiresIn = expiresIn;
  }

  public String getId() {
    return id;
  }

  public String getEmail() {
    return email;
  }

  public String getName() {
    return name;
  }

  public String getToken() {
    return token;
  }

  public long getExpiresIn() {
    return expiresIn;
  }
}
