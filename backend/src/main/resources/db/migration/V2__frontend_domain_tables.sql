-- 依据 app/src/types.ts 与 app/docs/api-contract.md 中的接口与类型构造的业务表
-- 与 V1 users 表兼容；PostgreSQL / Supabase

-- ---------- UserProfile 扩展字段（GET /users/profile）----------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS school VARCHAR(200),
    ADD COLUMN IF NOT EXISTS age INT,
    ADD COLUMN IF NOT EXISTS learning_time_display VARCHAR(100);

COMMENT ON COLUMN users.learning_time_display IS '展示用学习时长文案，如「6个月」';

-- ---------- 试卷上传与分析结果（POST /papers/analyze → DashboardResponse）----------
CREATE TABLE papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    client_paper_id VARCHAR(128) NOT NULL,
    title VARCHAR(500) NOT NULL,
    storage_object_key TEXT,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT papers_user_client_unique UNIQUE (user_id, client_paper_id)
);

CREATE INDEX idx_papers_user_id ON papers (user_id);
CREATE INDEX idx_papers_analyzed_at ON papers (analyzed_at DESC);

CREATE TABLE paper_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers (id) ON DELETE CASCADE,
    question_id VARCHAR(64) NOT NULL,
    question_number INT NOT NULL,
    status VARCHAR(16) NOT NULL,
    explanation TEXT,
    knowledge_point VARCHAR(500),
    practice_questions JSONB,
    CONSTRAINT paper_questions_status_check CHECK (status IN ('correct', 'wrong')),
    CONSTRAINT paper_questions_paper_qid_unique UNIQUE (paper_id, question_id)
);

CREATE INDEX idx_paper_questions_paper_id ON paper_questions (paper_id);

-- ---------- 学习统计上报（POST /reports/learning/ingest）----------
CREATE TABLE learning_stat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    client_paper_id VARCHAR(128) NOT NULL,
    paper_title VARCHAR(500) NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL,
    total_questions INT NOT NULL,
    correct_questions INT NOT NULL,
    wrong_questions INT NOT NULL,
    accuracy NUMERIC(6, 2) NOT NULL,
    error_rate NUMERIC(6, 2) NOT NULL,
    paper_id UUID REFERENCES papers (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_learning_stat_sessions_user_submitted ON learning_stat_sessions (user_id, submitted_at DESC);

CREATE TABLE learning_stat_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_session_id UUID NOT NULL REFERENCES learning_stat_sessions (id) ON DELETE CASCADE,
    question_id VARCHAR(64) NOT NULL,
    question_number INT NOT NULL,
    status VARCHAR(16) NOT NULL,
    knowledge_point VARCHAR(500),
    question_type VARCHAR(32),
    CONSTRAINT learning_stat_questions_status_check CHECK (status IN ('correct', 'wrong'))
);

CREATE INDEX idx_learning_stat_questions_session ON learning_stat_questions (stat_session_id);

COMMENT ON COLUMN learning_stat_questions.question_type IS '可选：言语理解/数量关系等，供 /reports/learning-insights 聚合';

-- ---------- AI 引导对话（POST /ai/guidance）----------
CREATE TABLE ai_guidance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    client_session_id VARCHAR(128),
    paper_client_id VARCHAR(128) NOT NULL,
    question_id VARCHAR(64) NOT NULL,
    question_number INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_guidance_sessions_user ON ai_guidance_sessions (user_id);

CREATE UNIQUE INDEX ai_guidance_sessions_user_client_sess_uq
    ON ai_guidance_sessions (user_id, client_session_id)
    WHERE client_session_id IS NOT NULL;

CREATE TABLE ai_guidance_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES ai_guidance_sessions (id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_guidance_messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX idx_ai_guidance_messages_session ON ai_guidance_messages (session_id, created_at);

-- ---------- 学习报告周期快照（GET /reports/learning → ReportItem[]）----------
-- 可由 learning_stat_sessions 聚合生成；也可由后端定期写入简化查询
CREATE TABLE report_period_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    period_label VARCHAR(64) NOT NULL,
    papers INT NOT NULL DEFAULT 0,
    error_rate NUMERIC(6, 2) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT report_period_user_label UNIQUE (user_id, period_label)
);

CREATE INDEX idx_report_period_user ON report_period_snapshots (user_id, sort_order);
