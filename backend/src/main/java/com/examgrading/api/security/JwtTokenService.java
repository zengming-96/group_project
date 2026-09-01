package com.examgrading.api.security;

import com.examgrading.api.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {

  private final JwtProperties jwtProperties;

  public JwtTokenService(JwtProperties jwtProperties) {
    this.jwtProperties = jwtProperties;
  }

  public String createAccessToken(long userId, String email, String role) {
    Date now = new Date();
    Date exp = new Date(now.getTime() + jwtProperties.getExpirationMs());
    return Jwts.builder()
        .setSubject(Long.toString(userId))
        .setIssuedAt(now)
        .setExpiration(exp)
        .claim("email", email)
        .claim("role", role)
        .signWith(signingKey(), SignatureAlgorithm.HS256)
        .compact();
  }

  public Claims parseAndValidate(String token) {
    return Jwts.parserBuilder()
        .setSigningKey(signingKey())
        .build()
        .parseClaimsJws(token)
        .getBody();
  }

  private SecretKey signingKey() {
    String secret = jwtProperties.getSecret();
    byte[] keyBytes;
    try {
      // 仅当值为合法 Base64 时才按二进制密钥解析；否则 JJWT 会抛 DecodingException（非 IllegalArgumentException）
      keyBytes = Decoders.BASE64.decode(secret.trim());
    } catch (RuntimeException e) {
      keyBytes = secret.getBytes(StandardCharsets.UTF_8);
    }
    return Keys.hmacShaKeyFor(keyBytes);
  }

  public static List<String> rolesFromClaim(String role) {
    if (role == null || role.isBlank()) {
      return List.of("ROLE_STUDENT");
    }
    return List.of("ROLE_" + role.trim().toUpperCase());
  }
}
