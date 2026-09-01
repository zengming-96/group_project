package com.examgrading.api.security;

import com.examgrading.api.error.ApiException;
import org.springframework.http.HttpStatus;

/** JWT 认证后 {@link org.springframework.security.core.Authentication#getName()} 为用户 ID 字符串（与 token {@code sub} 一致）。 */
public final class PrincipalUserId {

  private PrincipalUserId() {}

  public static long parse(String principalName) {
    if (principalName == null || principalName.isBlank()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "未认证");
    }
    try {
      return Long.parseLong(principalName.trim());
    } catch (NumberFormatException e) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_TOKEN_SUB", "令牌主体无效");
    }
  }
}
