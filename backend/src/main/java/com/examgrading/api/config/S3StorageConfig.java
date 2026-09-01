package com.examgrading.api.config;

import java.net.URI;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

@Configuration
public class S3StorageConfig {

  @Bean
  @ConditionalOnProperty(name = "app.storage.enabled", havingValue = "true")
  public S3Client supabaseS3Client(StorageProperties properties) {
    StorageProperties.Supabase s = properties.getSupabase();
    if (s.getEndpoint() == null || s.getEndpoint().isBlank()) {
      throw new IllegalStateException(
          "app.storage.enabled=true 但未配置 app.storage.supabase.endpoint");
    }
    if (s.getAccessKey() == null || s.getAccessKey().isBlank()
        || s.getSecretKey() == null || s.getSecretKey().isBlank()) {
      throw new IllegalStateException(
          "app.storage.enabled=true 但未配置 access-key / secret-key（Supabase Storage S3 密钥）");
    }
    AwsBasicCredentials credentials =
        AwsBasicCredentials.create(s.getAccessKey().trim(), s.getSecretKey().trim());
    return S3Client.builder()
        .endpointOverride(URI.create(s.getEndpoint().trim()))
        .region(Region.of(s.getRegion().trim().isEmpty() ? "us-east-1" : s.getRegion().trim()))
        .credentialsProvider(StaticCredentialsProvider.create(credentials))
        .serviceConfiguration(
            S3Configuration.builder().pathStyleAccessEnabled(true).build())
        .build();
  }
}
