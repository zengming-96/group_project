package com.examgrading.api.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import javax.validation.constraints.Email;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.Size;

public class UpdateProfileRequest {

  @Size(max = 200, message = "用户名/姓名长度不能超过 200（与库表 username 一致）")
  @JsonAlias("fullName")
  private String name;

  @Email(message = "邮箱格式不正确")
  private String email;

  @Min(value = 1, message = "年龄不能小于 1")
  @Max(value = 150, message = "年龄不能大于 150")
  private Integer age;

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public Integer getAge() {
    return age;
  }

  public void setAge(Integer age) {
    this.age = age;
  }
}
