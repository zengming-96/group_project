package com.examgrading.api.exam.dto;

import java.util.List;

/** 根据某卷某题生成的「举一反三」练习题列表。 */
public record SimilarPracticeResponse(
    long examId,
    int sourceQuestionNo,
    String sourceQuestion,
    String sourceUserAnswer,
    String sourceCorrectAnswer,
    List<SimilarPracticeQuestionItem> similarQuestions) {}
