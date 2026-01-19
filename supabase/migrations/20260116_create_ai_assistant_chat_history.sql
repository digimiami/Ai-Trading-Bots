-- Create table for AI Assistant chat history
CREATE TABLE IF NOT EXISTS ai_assistant_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes for efficient queries
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_user_id ON ai_assistant_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_created_at ON ai_assistant_chat_history(created_at DESC);

-- Enable RLS
ALTER TABLE ai_assistant_chat_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own chat history
CREATE POLICY "Users can view their own chat history"
  ON ai_assistant_chat_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own messages
CREATE POLICY "Users can insert their own messages"
  ON ai_assistant_chat_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own chat history
CREATE POLICY "Users can delete their own chat history"
  ON ai_assistant_chat_history
  FOR DELETE
  USING (auth.uid() = user_id);
