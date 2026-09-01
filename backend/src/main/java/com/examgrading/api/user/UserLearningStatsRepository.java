package com.examgrading.api.user;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class UserLearningStatsRepository {

  private final JdbcTemplate jdbcTemplate;

  public UserLearningStatsRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  /**
   * 按题型汇总（仅统计批改完成的试卷 status=3）。
   *
   * @return question_type, total, correct
   */
  public List<TypeAggRow> aggregateByQuestionType(long userId) {
    return jdbcTemplate.query(
        """
        SELECT q.question_type AS qt,
               COUNT(*) AS total,
               COALESCE(SUM(CASE WHEN q.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct
        FROM question_details q
        INNER JOIN exam_records e ON e.id = q.exam_id
        WHERE e.user_id = ? AND e.status = 3
        GROUP BY q.question_type
        ORDER BY q.question_type
        """,
        (rs, rowNum) ->
            new TypeAggRow(rs.getInt("qt"), rs.getLong("total"), rs.getLong("correct")),
        userId);
  }

  /**
   * 按试卷记录创建时间所在自然月汇总（UTC 与数据库会话时区一致；通常服务器为 UTC）。
   */
  public List<MonthAggRow> aggregateByExamMonth(long userId) {
    return jdbcTemplate.query(
        """
        SELECT CAST(EXTRACT(YEAR FROM e.created_at) AS INTEGER) AS y,
               CAST(EXTRACT(MONTH FROM e.created_at) AS INTEGER) AS m,
               COUNT(*) AS total,
               COALESCE(SUM(CASE WHEN q.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct
        FROM question_details q
        INNER JOIN exam_records e ON e.id = q.exam_id
        WHERE e.user_id = ? AND e.status = 3
        GROUP BY EXTRACT(YEAR FROM e.created_at), EXTRACT(MONTH FROM e.created_at)
        ORDER BY y, m
        """,
        (rs, rowNum) ->
            new MonthAggRow(rs.getInt("y"), rs.getInt("m"), rs.getLong("total"), rs.getLong("correct")),
        userId);
  }

  /**
   * 指定自然月内按「日」汇总（试卷创建时间落在该日内，status=3）。
   *
   * @param monthStartInclusive {@code yearMonth.atDay(1)} 00:00:00 UTC
   * @param monthEndExclusive 下月 1 日 00:00:00 UTC
   */
  public List<DayAggRow> aggregateByDayInRange(
      long userId, Instant monthStartInclusive, Instant monthEndExclusive) {
    return jdbcTemplate.query(
        """
        SELECT CAST(EXTRACT(DAY FROM e.created_at) AS INTEGER) AS dom,
               COUNT(*) AS total,
               COALESCE(SUM(CASE WHEN q.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct
        FROM question_details q
        INNER JOIN exam_records e ON e.id = q.exam_id
        WHERE e.user_id = ? AND e.status = 3
          AND e.created_at >= ? AND e.created_at < ?
        GROUP BY EXTRACT(DAY FROM e.created_at)
        ORDER BY dom
        """,
        ps -> {
          ps.setLong(1, userId);
          ps.setTimestamp(2, Timestamp.from(monthStartInclusive));
          ps.setTimestamp(3, Timestamp.from(monthEndExclusive));
        },
        (rs, rowNum) ->
            new DayAggRow(rs.getInt("dom"), rs.getLong("total"), rs.getLong("correct")));
  }

  public record TypeAggRow(int questionType, long total, long correct) {}

  public record MonthAggRow(int year, int month, long total, long correct) {}

  public record DayAggRow(int dayOfMonth, long total, long correct) {}
}
