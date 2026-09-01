package com.examgrading.api.exam;

import com.examgrading.api.exam.dto.ExamHistoryItem;
import com.examgrading.api.exam.dto.ExamOwnedSummary;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class ExamRecordRepository {

  private final JdbcTemplate jdbcTemplate;

  public ExamRecordRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  /**
   * 新建一条「待解析」试卷记录，PDF 已在 Storage 就位。
   *
   * @return 生成的 exam_records.id
   */
  public long insert(
      long userId,
      String fileName,
      String fileUrl,
      String storageBucket,
      String storageObjectKey,
      String contentType,
      long byteSize) {
    KeyHolder keyHolder = new GeneratedKeyHolder();
    jdbcTemplate.update(
        connection -> {
          PreparedStatement ps =
              connection.prepareStatement(
                  """
                  INSERT INTO exam_records (
                    user_id, file_name, file_url, storage_bucket, storage_object_key,
                    content_type, byte_size, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                  """,
                  new String[] {"id"});
          ps.setLong(1, userId);
          ps.setString(2, fileName);
          ps.setString(3, fileUrl);
          ps.setString(4, storageBucket);
          ps.setString(5, storageObjectKey);
          ps.setString(6, contentType);
          ps.setLong(7, byteSize);
          return ps;
        },
        keyHolder);
    Number key = keyHolder.getKey();
    if (key == null) {
      throw new IllegalStateException("Failed to obtain generated exam_records.id");
    }
    return key.longValue();
  }

  public void updateStatus(long examId, int status) {
    jdbcTemplate.update(
        "UPDATE exam_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        status,
        examId);
  }

  /** 当前用户全部试卷，按上传时间倒序。 */
  public List<ExamHistoryItem> listByUserId(long userId) {
    return jdbcTemplate.query(
        """
        SELECT id, file_name, status, created_at, total_questions, correct_count, accuracy_rate
        FROM exam_records
        WHERE user_id = ?
        ORDER BY created_at DESC
        """,
        (rs, rowNum) -> {
          Timestamp ts = rs.getTimestamp("created_at");
          Instant createdAt = ts != null ? ts.toInstant() : Instant.EPOCH;
          return new ExamHistoryItem(
              rs.getLong("id"),
              rs.getString("file_name"),
              rs.getInt("status"),
              createdAt,
              rs.getInt("total_questions"),
              rs.getInt("correct_count"),
              rs.getBigDecimal("accuracy_rate"));
        },
        userId);
  }

  /** 仅当试卷属于指定用户时返回，用于详情接口鉴权。 */
  public Optional<ExamOwnedSummary> findOwnedByIdAndUserId(long examId, long userId) {
    try {
      return Optional.ofNullable(
          jdbcTemplate.queryForObject(
              """
              SELECT id, file_name, file_url, storage_bucket, storage_object_key,
                     status, total_questions, correct_count, accuracy_rate, created_at
              FROM exam_records
              WHERE id = ? AND user_id = ?
              """,
              (rs, rowNum) -> {
                Timestamp ts = rs.getTimestamp("created_at");
                Instant createdAt = ts != null ? ts.toInstant() : Instant.EPOCH;
                return new ExamOwnedSummary(
                    rs.getLong("id"),
                    rs.getString("file_name"),
                    rs.getString("file_url"),
                    rs.getString("storage_bucket"),
                    rs.getString("storage_object_key"),
                    rs.getInt("status"),
                    rs.getInt("total_questions"),
                    rs.getInt("correct_count"),
                    rs.getBigDecimal("accuracy_rate"),
                    createdAt);
              },
              examId,
              userId));
    } catch (EmptyResultDataAccessException e) {
      return Optional.empty();
    }
  }

  public void updateSummary(
      long examId, int totalQuestions, int correctCount, java.math.BigDecimal accuracyRate, int status) {
    jdbcTemplate.update(
        """
        UPDATE exam_records SET
          total_questions = ?,
          correct_count = ?,
          accuracy_rate = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        totalQuestions,
        correctCount,
        accuracyRate,
        status,
        examId);
  }
}
