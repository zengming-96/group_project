package com.examgrading.api.user;

import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

  private final JdbcTemplate jdbcTemplate;

  public UserRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public Optional<UserRecord> findByEmail(String email) {
    try {
      return Optional.ofNullable(
          jdbcTemplate.queryForObject(
              """
              SELECT id, username, email, password_hash, age
              FROM users WHERE email = ?
              """,
              (rs, rowNum) -> mapRow(rs),
              email));
    } catch (EmptyResultDataAccessException e) {
      return Optional.empty();
    }
  }

  /** 不含密码；用于资料展示。 */
  public Optional<UserProfileRow> findProfileById(long id) {
    try {
      return Optional.ofNullable(
          jdbcTemplate.queryForObject(
              """
              SELECT username, email, age, created_at
              FROM users WHERE id = ?
              """,
              (rs, rowNum) -> {
                int ageVal = rs.getInt("age");
                boolean ageNull = rs.wasNull();
                Timestamp ts = rs.getTimestamp("created_at");
                Instant createdAt = ts != null ? ts.toInstant() : Instant.EPOCH;
                return new UserProfileRow(
                    rs.getString("username"),
                    rs.getString("email"),
                    ageNull ? null : ageVal,
                    createdAt);
              },
              id));
    } catch (EmptyResultDataAccessException e) {
      return Optional.empty();
    }
  }

  public Optional<UserRecord> findById(long id) {
    try {
      return Optional.ofNullable(
          jdbcTemplate.queryForObject(
              """
              SELECT id, username, email, password_hash, age
              FROM users WHERE id = ?
              """,
              (rs, rowNum) -> mapRow(rs),
              id));
    } catch (EmptyResultDataAccessException e) {
      return Optional.empty();
    }
  }

  private static UserRecord mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
    int ageVal = rs.getInt("age");
    boolean ageNull = rs.wasNull();
    return new UserRecord(
        rs.getLong("id"),
        rs.getString("username"),
        rs.getString("email"),
        rs.getString("password_hash"),
        ageNull ? null : ageVal);
  }

  public boolean existsByEmail(String email) {
    Long count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM users WHERE email = ?", Long.class, email);
    return count != null && count > 0;
  }

  public boolean existsByEmailExcludingId(String email, long excludeUserId) {
    Long count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM users WHERE email = ? AND id <> ?",
            Long.class,
            email,
            excludeUserId);
    return count != null && count > 0;
  }

  public boolean existsByUsername(String username) {
    Long count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM users WHERE username = ?", Long.class, username);
    return count != null && count > 0;
  }

  public boolean existsByUsernameExcludingId(String username, long excludeUserId) {
    Long count =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM users WHERE username = ? AND id <> ?",
            Long.class,
            username,
            excludeUserId);
    return count != null && count > 0;
  }

  public long insert(String username, String email, String passwordHash) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbcTemplate.update(
        connection -> {
          PreparedStatement ps =
              connection.prepareStatement(
                  "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                  new String[] {"id"});
          ps.setString(1, username);
          ps.setString(2, email);
          ps.setString(3, passwordHash);
          return ps;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new IllegalStateException("Failed to obtain generated user id");
    }
    return key.longValue();
  }

  /** 仅更新非 null 字段；{@code username} 对应资料里的「姓名/用户名」。 */
  public void updateProfile(long userId, String username, String email, Integer age) {
    jdbcTemplate.update(
        """
        UPDATE users SET
          username = COALESCE(?, username),
          email = COALESCE(?, email),
          age = COALESCE(?, age),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        username,
        email,
        age,
        userId);
  }
}
