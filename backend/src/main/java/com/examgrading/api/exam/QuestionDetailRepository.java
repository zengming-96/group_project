package com.examgrading.api.exam;

import com.examgrading.api.exam.ai.QuestionDraft;
import com.examgrading.api.exam.dto.QuestionGradingDetailItem;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class QuestionDetailRepository {

  private final JdbcTemplate jdbcTemplate;

  public QuestionDetailRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public void insert(long examId, QuestionDraft d) {
    jdbcTemplate.update(
        """
        INSERT INTO question_details (
          exam_id, question_no, question_detail, question_type,
          user_answer, std_answer, is_correct, ai_analysis)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        examId,
        d.questionNo(),
        truncate(d.questionDetail(), 255),
        d.questionType(),
        truncate(d.userAnswer(), 10),
        truncate(d.stdAnswer(), 10),
        d.correct() ? (short) 1 : (short) 0,
        d.aiAnalysis());
  }

  public List<QuestionGradingDetailItem> listByExamId(long examId) {
    return jdbcTemplate.query(
        """
        SELECT id, question_no, question_detail, question_type,
               user_answer, std_answer, is_correct, ai_analysis, created_at
        FROM question_details
        WHERE exam_id = ?
        ORDER BY question_no ASC
        """,
        (rs, rowNum) -> {
          Timestamp ts = rs.getTimestamp("created_at");
          Instant createdAt = ts != null ? ts.toInstant() : Instant.EPOCH;
          return new QuestionGradingDetailItem(
              rs.getLong("id"),
              rs.getInt("question_no"),
              rs.getString("question_detail"),
              rs.getInt("question_type"),
              rs.getString("user_answer"),
              rs.getString("std_answer"),
              rs.getInt("is_correct") == 1,
              rs.getString("ai_analysis"),
              createdAt);
        },
        examId);
  }

  public Optional<QuestionGradingDetailItem> findByExamIdAndQuestionNo(
      long examId, int questionNo) {
    try {
      QuestionGradingDetailItem row =
          jdbcTemplate.queryForObject(
              """
              SELECT id, question_no, question_detail, question_type,
                     user_answer, std_answer, is_correct, ai_analysis, created_at
              FROM question_details
              WHERE exam_id = ? AND question_no = ?
              """,
              (rs, rowNum) -> {
                Timestamp ts = rs.getTimestamp("created_at");
                Instant createdAt = ts != null ? ts.toInstant() : Instant.EPOCH;
                return new QuestionGradingDetailItem(
                    rs.getLong("id"),
                    rs.getInt("question_no"),
                    rs.getString("question_detail"),
                    rs.getInt("question_type"),
                    rs.getString("user_answer"),
                    rs.getString("std_answer"),
                    rs.getInt("is_correct") == 1,
                    rs.getString("ai_analysis"),
                    createdAt);
              },
              examId,
              questionNo);
      return Optional.ofNullable(row);
    } catch (EmptyResultDataAccessException e) {
      return Optional.empty();
    }
  }

  private static String truncate(String s, int max) {
    if (s == null) {
      return null;
    }
    return s.length() <= max ? s : s.substring(0, max);
  }
}
