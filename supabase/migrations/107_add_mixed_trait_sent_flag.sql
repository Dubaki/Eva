-- Migration 107: защита от двойной отправки сообщения «Вторая опора»
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mixed_trait_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mixed_trait_sent_at TIMESTAMPTZ DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
