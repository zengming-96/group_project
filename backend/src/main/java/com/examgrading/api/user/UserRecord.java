package com.examgrading.api.user;

public record UserRecord(Long id, String username, String email, String passwordHash, Integer age) {}
