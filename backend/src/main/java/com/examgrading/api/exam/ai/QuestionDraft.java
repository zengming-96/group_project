package com.examgrading.api.exam.ai;

/** 单题批改草稿，由 AI 客户端生成后写入 question_details */
public record QuestionDraft(
    int questionNo,
    String questionDetail,
    short questionType,
    String userAnswer,
    String stdAnswer,
    boolean correct,
    String aiAnalysis) {}
