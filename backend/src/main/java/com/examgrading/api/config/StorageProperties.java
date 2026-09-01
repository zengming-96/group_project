package com.examgrading.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.storage")
public class StorageProperties {

  /** 为 false 时不创建 S3 客户端（如 local profile）；上传接口返回 STORAGE_DISABLED */
  private boolean enabled = false;

  /** 单文件上限（字节），与 spring.servlet.multipart.max-file-size 保持一致为宜 */
  private long maxFileBytes = 52_428_800L;

  private final Supabase supabase = new Supabase();

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public long getMaxFileBytes() {
    return maxFileBytes;
  }

  public void setMaxFileBytes(long maxFileBytes) {
    this.maxFileBytes = maxFileBytes;
  }

  public Supabase getSupabase() {
    return supabase;
  }

  public static class Supabase {

    /**
     * S3 端点，形如 https://&lt;project-ref&gt;.supabase.co/storage/v1/s3（控制台 Storage → S3
     * connection）
     */
    private String endpoint = "";

    /** 签名用区域，Supabase 文档建议 us-east-1 */
    private String region = "us-east-1";

    private String accessKey = "";
    private String secretKey = "";
    private String bucket = "exam-pdfs";

    /**
     * 若桶为 public，可填公开对象前缀（无尾斜杠），例如
     * https://xxx.supabase.co/storage/v1/object/public，用于写入 exam_records.file_url
     */
    private String publicObjectBaseUrl = "";

    public String getEndpoint() {
      return endpoint;
    }

    public void setEndpoint(String endpoint) {
      this.endpoint = endpoint;
    }

    public String getRegion() {
      return region;
    }

    public void setRegion(String region) {
      this.region = region;
    }

    public String getAccessKey() {
      return accessKey;
    }

    public void setAccessKey(String accessKey) {
      this.accessKey = accessKey;
    }

    public String getSecretKey() {
      return secretKey;
    }

    public void setSecretKey(String secretKey) {
      this.secretKey = secretKey;
    }

    public String getBucket() {
      return bucket;
    }

    public void setBucket(String bucket) {
      this.bucket = bucket;
    }

    public String getPublicObjectBaseUrl() {
      return publicObjectBaseUrl;
    }

    public void setPublicObjectBaseUrl(String publicObjectBaseUrl) {
      this.publicObjectBaseUrl = publicObjectBaseUrl;
    }
  }
}
