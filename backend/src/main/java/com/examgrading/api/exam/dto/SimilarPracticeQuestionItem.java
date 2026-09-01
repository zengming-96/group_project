package com.examgrading.api.exam.dto;

/** 举一反三生成的单道相似题（四选一）。 */
public record SimilarPracticeQuestionItem(
    int index,
    String question,
    String optionA,
    String optionB,
    String optionC,
    String optionD,
    String correctAnswer) {}
