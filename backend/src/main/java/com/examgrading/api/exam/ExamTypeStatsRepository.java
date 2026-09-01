package com.examgrading.api.exam;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ExamTypeStatsRepository {

  private final JdbcTemplate jdbcTemplate;

  public ExamTypeStatsRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public void deleteByExamId(long examId) {
    jdbcTemplate.update("DELETE FROM exam_type_stats WHERE exam_id = ?", examId);
  }

  public void insert(
      long examId, long userId, short questionType, int typeTotal, int typeCorrect) {
    jdbcTemplate.update(
        """
        INSERT INTO exam_type_stats (
          exam_id, user_id, question_type, type_total_count, type_correct_count)
        VALUES (?, ?, ?, ?, ?)
        """,
        examId,
        userId,
        questionType,
        typeTotal,
        typeCorrect);
  }
}
