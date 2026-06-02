-- MODULE 17: Brain — IA Knowledge Base
-- Requires pg_vector extension

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── Knowledge base entries ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id       uuid,            -- FK to product_knowledge_sources (added below)
  title           text NOT NULL,
  content         text NOT NULL,
  chunk_index     int  NOT NULL DEFAULT 0,
  embedding       vector(1536),
  token_count     int,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_base_org_idx ON ai_knowledge_base(organization_id);
CREATE INDEX IF NOT EXISTS ai_knowledge_base_embedding_idx
  ON ai_knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_knowledge" ON ai_knowledge_base
  USING (organization_id = get_user_organization(auth.uid()));

-- ── Knowledge sources (URLs / files) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_knowledge_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES products(id) ON DELETE SET NULL,
  type            text NOT NULL CHECK (type IN ('url', 'pdf', 'docx', 'text', 'sitemap')),
  title           text,
  source_url      text,
  file_path       text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  chunk_count     int DEFAULT 0,
  error_message   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE product_knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_sources" ON product_knowledge_sources
  USING (organization_id = get_user_organization(auth.uid()));

-- Back-fill FK on ai_knowledge_base
ALTER TABLE ai_knowledge_base
  ADD CONSTRAINT fk_ai_kb_source
  FOREIGN KEY (source_id) REFERENCES product_knowledge_sources(id) ON DELETE SET NULL;

-- ── Agent training materials ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_training_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id        uuid REFERENCES ai_agents(id) ON DELETE CASCADE,
  title           text NOT NULL,
  content         text NOT NULL,
  type            text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'faq', 'script', 'objection')),
  embedding       vector(1536),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_training_org_idx  ON agent_training_materials(organization_id);
CREATE INDEX IF NOT EXISTS agent_training_agent_idx ON agent_training_materials(agent_id);
CREATE INDEX IF NOT EXISTS agent_training_embedding_idx
  ON agent_training_materials USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

ALTER TABLE agent_training_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_training" ON agent_training_materials
  USING (organization_id = get_user_organization(auth.uid()));

-- ── AI Audits ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_audits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id        uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  input_text      text NOT NULL,
  output_text     text NOT NULL,
  retrieved_chunks jsonb DEFAULT '[]',
  latency_ms      int,
  token_input     int,
  token_output    int,
  score           numeric(3,2),   -- 0.00 – 1.00 quality score
  flagged         boolean DEFAULT false,
  flag_reason     text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_audits_org_idx   ON ai_audits(organization_id);
CREATE INDEX IF NOT EXISTS ai_audits_agent_idx ON ai_audits(agent_id);
CREATE INDEX IF NOT EXISTS ai_audits_flagged   ON ai_audits(organization_id, flagged) WHERE flagged = true;

ALTER TABLE ai_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_audits" ON ai_audits
  USING (organization_id = get_user_organization(auth.uid()));

-- ── Vector search function ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_knowledge(
  p_org_id    uuid,
  p_embedding vector(1536),
  p_limit     int DEFAULT 5,
  p_threshold float DEFAULT 0.75
)
RETURNS TABLE (
  id          uuid,
  title       text,
  content     text,
  similarity  float
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    id,
    title,
    content,
    1 - (embedding <=> p_embedding) AS similarity
  FROM ai_knowledge_base
  WHERE organization_id = p_org_id
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> p_embedding) >= p_threshold
  ORDER BY embedding <=> p_embedding
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION match_training_materials(
  p_org_id    uuid,
  p_agent_id  uuid,
  p_embedding vector(1536),
  p_limit     int DEFAULT 5,
  p_threshold float DEFAULT 0.75
)
RETURNS TABLE (
  id          uuid,
  title       text,
  content     text,
  similarity  float
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    id,
    title,
    content,
    1 - (embedding <=> p_embedding) AS similarity
  FROM agent_training_materials
  WHERE organization_id = p_org_id
    AND (agent_id = p_agent_id OR agent_id IS NULL)
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> p_embedding) >= p_threshold
  ORDER BY embedding <=> p_embedding
  LIMIT p_limit;
$$;

-- ── Updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_kb_updated_at
    BEFORE UPDATE ON ai_knowledge_base
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_sources_updated_at
    BEFORE UPDATE ON product_knowledge_sources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
