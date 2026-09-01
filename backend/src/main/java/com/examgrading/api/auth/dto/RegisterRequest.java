package com.examgrading.api.auth.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

public class RegisterRequest {

  /** 用户名/展示姓名，入库为 {@code users.username}（唯一）；登录仍使用邮箱。兼容前端字段 fullName */
  @NotBlank(message = "姓名不能为空")
  @Size(max = 200, message = "姓名长度不能超过 200")
  @JsonAlias("fullName")
  private String name;

  @NotBlank(message = "邮箱不能为空")
  @Email(message = "邮箱格式不正确")
  private String email;

  @NotBlank(message = "密码不能为空")
  @Size(min = 8, max = 128, message = "密码长度需在 8～128 位之间")
  private String password;

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

  public String getPassword() {
    return password;
  }

  public void setPassword(String password) {
    this.password = password;
  }
}
