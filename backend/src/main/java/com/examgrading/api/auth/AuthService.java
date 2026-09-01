package com.examgrading.api.auth;

import com.examgrading.api.auth.dto.LoginRequest;
import com.examgrading.api.auth.dto.LoginResponse;
import com.examgrading.api.auth.dto.RegisterRequest;
import com.examgrading.api.auth.dto.RegisterResponse;
import com.examgrading.api.config.JwtProperties;
import com.examgrading.api.error.ApiException;
import com.examgrading.api.security.JwtTokenService;
import com.examgrading.api.user.UserRecord;
import com.examgrading.api.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private static final String DEFAULT_ROLE = "student";

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final JwtTokenService jwtTokenService;
  private final JwtProperties jwtProperties;

  public AuthService(
      UserRepository userRepository,
      PasswordEncoder passwordEncoder,
      JwtTokenService jwtTokenService,
      JwtProperties jwtProperties) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.jwtTokenService = jwtTokenService;
    this.jwtProperties = jwtProperties;
  }

  /**
   * 注册：{@code name} → {@code users.username}（唯一展示名）；{@code email} → 邮箱与登录账号；登录始终用邮箱+密码。
   */
  @Transactional
  public RegisterResponse register(RegisterRequest req) {
    String email = req.getEmail().trim().toLowerCase();
    String username = req.getName().trim();

    if (userRepository.existsByEmail(email)) {
      throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "该邮箱已被注册");
    }
    if (userRepository.existsByUsername(username)) {
      throw new ApiException(HttpStatus.CONFLICT, "USERNAME_TAKEN", "该用户名已被占用，请换一个姓名");
    }

    String hash = passwordEncoder.encode(req.getPassword());
    long id = userRepository.insert(username, email, hash);
    String token = jwtTokenService.createAccessToken(id, email, DEFAULT_ROLE);
    long expiresInSec = Math.max(1L, jwtProperties.getExpirationMs() / 1000);
    return new RegisterResponse(Long.toString(id), email, username, token, expiresInSec);
  }

  public LoginResponse login(LoginRequest req) {
    String email = req.getEmail().trim().toLowerCase();
    UserRecord user =
        userRepository
            .findByEmail(email)
            .orElseThrow(
                () ->
                    new ApiException(
                        HttpStatus.UNAUTHORIZED,
                        "INVALID_CREDENTIALS",
                        "邮箱或密码错误"));

    if (!passwordEncoder.matches(req.getPassword(), user.passwordHash())) {
      throw new ApiException(
          HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "邮箱或密码错误");
    }

    String token =
        jwtTokenService.createAccessToken(user.id(), user.email(), DEFAULT_ROLE);
    long expiresInSec = Math.max(1L, jwtProperties.getExpirationMs() / 1000);
    return new LoginResponse(token, expiresInSec);
  }
}
