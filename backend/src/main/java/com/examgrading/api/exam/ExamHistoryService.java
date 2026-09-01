package com.examgrading.api.exam;

import com.examgrading.api.error.ApiException;
import com.examgrading.api.exam.dto.ExamHistoryResponse;
import com.examgrading.api.security.PrincipalUserId;
import com.examgrading.api.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ExamHistoryService {

  private final UserRepository userRepository;
  private final ExamRecordRepository examRecordRepository;

  public ExamHistoryService(UserRepository userRepository, ExamRecordRepository examRecordRepository) {
    this.userRepository = userRepository;
    this.examRecordRepository = examRecordRepository;
  }

  public ExamHistoryResponse listMyExams(String principalName) {
    long userId = PrincipalUserId.parse(principalName);
    userRepository
        .findById(userId)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "当前账号在系统中不存在"));
    return new ExamHistoryResponse(examRecordRepository.listByUserId(userId));
  }
}
