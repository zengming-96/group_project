package com.examgrading.api.user;

import com.examgrading.api.config.JwtProperties;
import com.examgrading.api.error.ApiException;
import com.examgrading.api.security.JwtTokenService;
import com.examgrading.api.security.PrincipalUserId;
import com.examgrading.api.user.dto.UpdateProfileRequest;
import com.examgrading.api.user.dto.UpdateProfileResponse;
import com.examgrading.api.user.dto.UserMeResponse;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserProfileService {

  private static final String DEFAULT_ROLE = "student";

  private final UserRepository userRepository;
  private final JwtTokenService jwtTokenService;
  private final JwtProperties jwtProperties;
  private final UserLearningStatsService userLearningStatsService;

  public UserProfileService(
      UserRepository userRepository,
      JwtTokenService jwtTokenService,
      JwtProperties jwtProperties,
      UserLearningStatsService userLearningStatsService) {
    this.userRepository = userRepository;
    this.jwtTokenService = jwtTokenService;
    this.jwtProperties = jwtProperties;
    this.userLearningStatsService = userLearningStatsService;
  }

  public UserMeResponse getCurrentProfile(String principalName) {
    long userId = PrincipalUserId.parse(principalName);
    UserProfileRow row =
        userRepository
            .findProfileById(userId)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "当前账号在系统中不存在"));
    return new UserMeResponse(
        row.username(),
        row.email(),
        row.age(),
        daysSinceCreated(row.createdAt()),
        userLearningStatsService.aggregateForUser(userId));
  }

  private static long daysSinceCreated(Instant createdAt) {
    if (createdAt == null) {
      return 0;
    }
    var start = createdAt.atZone(ZoneOffset.UTC).toLocalDate();
    var end = Instant.now().atZone(ZoneOffset.UTC).toLocalDate();
    return ChronoUnit.DAYS.between(start, end);
  }

  @Transactional
  public UpdateProfileResponse updateProfile(String principalName, UpdateProfileRequest req) {
    long userId = PrincipalUserId.parse(principalName);
    UserRecord user =
        userRepository
            .findById(userId)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "当前账号在系统中不存在"));

    boolean hasName = req.getName() != null && !req.getName().isBlank();
    boolean hasEmail = req.getEmail() != null && !req.getEmail().isBlank();
    boolean hasAge = req.getAge() != null;
    if (!hasName && !hasEmail && !hasAge) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "NO_CHANGES", "至少提供一项要修改的字段（name / email / age）");
    }

    String newName = hasName ? req.getName().trim() : null;
    String newEmail = hasEmail ? req.getEmail().trim().toLowerCase() : null;
    Integer newAge = hasAge ? req.getAge() : null;

    if (newEmail != null
        && !newEmail.equals(user.email())
        && userRepository.existsByEmailExcludingId(newEmail, user.id())) {
      throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "该邮箱已被其他账号使用");
    }

    if (newName != null
        && !newName.equals(user.username())
        && userRepository.existsByUsernameExcludingId(newName, user.id())) {
      throw new ApiException(HttpStatus.CONFLICT, "USERNAME_TAKEN", "该用户名已被占用");
    }

    userRepository.updateProfile(user.id(), newName, newEmail, newAge);

    UserRecord updated =
        userRepository
            .findById(user.id())
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "INTERNAL_ERROR",
                        "更新后读取用户失败"));

    String newToken = null;
    Long expiresIn = null;
    if (newEmail != null && !newEmail.equals(user.email())) {
      newToken = jwtTokenService.createAccessToken(updated.id(), updated.email(), DEFAULT_ROLE);
      expiresIn = Math.max(1L, jwtProperties.getExpirationMs() / 1000);
    }

    return new UpdateProfileResponse(
        Long.toString(updated.id()),
        updated.email(),
        updated.username(),
        updated.age(),
        newToken,
        expiresIn);
  }
}
