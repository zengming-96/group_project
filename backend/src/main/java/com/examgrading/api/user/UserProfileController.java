package com.examgrading.api.user;

import com.examgrading.api.user.dto.UpdateProfileRequest;
import com.examgrading.api.user.dto.UpdateProfileResponse;
import com.examgrading.api.user.dto.UserMeResponse;
import javax.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
public class UserProfileController {

  private final UserProfileService userProfileService;

  public UserProfileController(UserProfileService userProfileService) {
    this.userProfileService = userProfileService;
  }

  /**
   * 当前用户：用户名、邮箱、年龄、注册天数（UTC），以及 {@code learningStats}（题型统计、当月每日、当月汇总、近 12
   * 月趋势；原 {@code GET /users/me/stats} 已合并至此）。仅需 token。
   */
  @GetMapping("/me")
  public UserMeResponse getMe(Authentication authentication) {
    return userProfileService.getCurrentProfile(authentication.getName());
  }

  /** 修改当前登录用户的展示名（username，≤200）、邮箱、年龄（至少传一项）；改邮箱后响应内会返回新 token。 */
  @PatchMapping("/me")
  public UpdateProfileResponse updateMe(
      @Valid @RequestBody UpdateProfileRequest request, Authentication authentication) {
    return userProfileService.updateProfile(authentication.getName(), request);
  }
}
