package com.examgrading.api.user;

import com.examgrading.api.exam.ExamQuestionType;
import com.examgrading.api.user.dto.DayStatItem;
import com.examgrading.api.user.dto.MonthOverallStat;
import com.examgrading.api.user.dto.QuestionTypeStatItem;
import com.examgrading.api.user.dto.UserLearningStatsResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class UserLearningStatsService {

  private static final BigDecimal ZERO_PERCENT = BigDecimal.ZERO.setScale(2, RoundingMode.UNNECESSARY);

  private final UserLearningStatsRepository userLearningStatsRepository;

  public UserLearningStatsService(UserLearningStatsRepository userLearningStatsRepository) {
    this.userLearningStatsRepository = userLearningStatsRepository;
  }

  /**
   * 聚合学习统计。调用方须已确认 {@code userId} 存在（例如与 {@code GET /users/me} 共用同一次用户校验）。
   */
  public UserLearningStatsResponse aggregateForUser(long userId) {
    List<UserLearningStatsRepository.TypeAggRow> typeRows =
        userLearningStatsRepository.aggregateByQuestionType(userId);
    Map<Integer, UserLearningStatsRepository.TypeAggRow> byType = new HashMap<>();
    for (UserLearningStatsRepository.TypeAggRow r : typeRows) {
      byType.put(r.questionType(), r);
    }

    List<QuestionTypeStatItem> byQuestionType = new ArrayList<>(5);
    for (int t = ExamQuestionType.MIN; t <= ExamQuestionType.MAX; t++) {
      UserLearningStatsRepository.TypeAggRow r = byType.get(t);
      long total = r == null ? 0L : r.total();
      long correct = r == null ? 0L : r.correct();
      long wrong = Math.max(0L, total - correct);
      byQuestionType.add(
          new QuestionTypeStatItem(
              t,
              ExamQuestionType.displayName(t),
              total,
              correct,
              wrong,
              percent(correct, total),
              percent(wrong, total)));
    }

    List<UserLearningStatsRepository.MonthAggRow> monthRows =
        userLearningStatsRepository.aggregateByExamMonth(userId);
    Map<String, UserLearningStatsRepository.MonthAggRow> monthKeyToRow = new HashMap<>();
    for (UserLearningStatsRepository.MonthAggRow r : monthRows) {
      monthKeyToRow.put(key(r.year(), r.month()), r);
    }

    YearMonth now = YearMonth.now(ZoneOffset.UTC);
    List<MonthOverallStat> trend = new ArrayList<>(12);
    for (int i = 11; i >= 0; i--) {
      YearMonth ym = now.minusMonths(i);
      trend.add(toMonthStat(ym, monthKeyToRow.get(key(ym.getYear(), ym.getMonthValue()))));
    }

    MonthOverallStat currentMonth = toMonthStat(now, monthKeyToRow.get(key(now.getYear(), now.getMonthValue())));

    List<DayStatItem> currentMonthByDay = buildCurrentMonthByDay(userId, now);

    return new UserLearningStatsResponse(byQuestionType, currentMonthByDay, currentMonth, trend);
  }

  private List<DayStatItem> buildCurrentMonthByDay(long userId, YearMonth yearMonth) {
    Instant start = yearMonth.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    Instant end = yearMonth.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    List<UserLearningStatsRepository.DayAggRow> dayRows =
        userLearningStatsRepository.aggregateByDayInRange(userId, start, end);
    Map<Integer, UserLearningStatsRepository.DayAggRow> byDay = new HashMap<>();
    for (UserLearningStatsRepository.DayAggRow r : dayRows) {
      byDay.put(r.dayOfMonth(), r);
    }
    int y = yearMonth.getYear();
    int m = yearMonth.getMonthValue();
    int last = yearMonth.lengthOfMonth();
    List<DayStatItem> out = new ArrayList<>(last);
    for (int d = 1; d <= last; d++) {
      UserLearningStatsRepository.DayAggRow r = byDay.get(d);
      long total = r == null ? 0L : r.total();
      long correct = r == null ? 0L : r.correct();
      long wrong = Math.max(0L, total - correct);
      out.add(
          new DayStatItem(
              y,
              m,
              d,
              String.format("%04d-%02d-%02d", y, m, d),
              total,
              correct,
              wrong,
              percent(correct, total),
              percent(wrong, total)));
    }
    return out;
  }

  private static String key(int year, int month) {
    return year + "-" + month;
  }

  private static MonthOverallStat toMonthStat(YearMonth ym, UserLearningStatsRepository.MonthAggRow row) {
    long total = row == null ? 0L : row.total();
    long correct = row == null ? 0L : row.correct();
    long wrong = Math.max(0L, total - correct);
    return new MonthOverallStat(
        ym.getYear(),
        ym.getMonthValue(),
        String.format("%04d-%02d", ym.getYear(), ym.getMonthValue()),
        total,
        correct,
        wrong,
        percent(correct, total),
        percent(wrong, total));
  }

  private static BigDecimal percent(long part, long total) {
    if (total <= 0) {
      return ZERO_PERCENT;
    }
    return BigDecimal.valueOf(part * 100.0 / total).setScale(2, RoundingMode.HALF_UP);
  }
}
