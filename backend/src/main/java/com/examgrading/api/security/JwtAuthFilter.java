package com.examgrading.api.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

  private final JwtTokenService jwtTokenService;

  public JwtAuthFilter(JwtTokenService jwtTokenService) {
    this.jwtTokenService = jwtTokenService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    String header = request.getHeader(HttpHeaders.AUTHORIZATION);
    if (header == null || !header.startsWith("Bearer ")) {
      filterChain.doFilter(request, response);
      return;
    }

    String token = header.substring(7).trim();
    if (token.isEmpty()) {
      filterChain.doFilter(request, response);
      return;
    }

    try {
      Claims claims = jwtTokenService.parseAndValidate(token);
      String subject = claims.getSubject();
      if (subject == null || subject.isBlank()) {
        writeInvalidToken(response);
        return;
      }
      try {
        Long.parseLong(subject.trim());
      } catch (NumberFormatException e) {
        writeInvalidToken(response);
        return;
      }

      String role = claims.get("role", String.class);
      var authorities =
          JwtTokenService.rolesFromClaim(role).stream()
              .map(SimpleGrantedAuthority::new)
              .collect(Collectors.toList());

      // principal = 用户 ID（与 JWT sub 一致），避免修改邮箱后仍用旧 email 查库失败
      UsernamePasswordAuthenticationToken authentication =
          new UsernamePasswordAuthenticationToken(subject.trim(), null, authorities);
      SecurityContextHolder.getContext().setAuthentication(authentication);
    } catch (JwtException | IllegalArgumentException e) {
      writeInvalidToken(response);
      return;
    }

    filterChain.doFilter(request, response);
  }

  private static void writeInvalidToken(HttpServletResponse response) throws IOException {
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.getWriter().write("{\"code\":\"INVALID_TOKEN\",\"message\":\"令牌无效或已过期\"}");
  }
}
