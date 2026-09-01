package com.examgrading.api.user.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 修改成功后的资料；若修改了邮箱，会附带新 JWT（字段 token / expiresIn）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateProfileResponse {

  private final String id;
  private final String email;
  private final String name;
  private final Integer age;
  private final String token;
  private final Long expiresIn;

  public UpdateProfileResponse(
      String id, String email, String name, Integer age, String token, Long expiresIn) {
    this.id = id;
    this.email = email;
    this.name = name;
    this.age = age;
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

  public Integer getAge() {
    return age;
  }

  public String getToken() {
    return token;
  }

  public Long getExpiresIn() {
    return expiresIn;
  }
}
