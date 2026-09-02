-- Profile pictures for customers. Run in the Supabase SQL editor.
--
-- The photo itself lives in Storage; the users row only keeps the public URL
-- we render and the object path, which is what lets us delete the previous
-- file when someone changes their picture instead of piling up orphans.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path TEXT;

COMMENT ON COLUMN users.avatar_url IS 'Public URL of the profile picture, or NULL for the initial-letter avatar.';
COMMENT ON COLUMN users.avatar_path IS 'Object path inside the avatars bucket, kept so the old file can be removed on replace.';

-- Public bucket: avatars are readable by URL, but only the server (service
-- role) can write, so a customer can never overwrite someone else's picture.
-- The size and MIME limits are a backstop — the API already re-encodes every
-- upload to a small JPEG before it reaches Storage.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', TRUE, 524288, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = TRUE,
      file_size_limit = 524288,
      allowed_mime_types = ARRAY['image/jpeg'];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read avatars'
  ) THEN
    CREATE POLICY "Public read avatars" ON storage.objects
      FOR SELECT USING (bucket_id = 'avatars');
  END IF;
END $$;

-- Confirm.
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'users' AND column_name IN ('avatar_url', 'avatar_path')) AS user_columns_added,
  (SELECT COUNT(*) FROM storage.buckets WHERE id = 'avatars')                    AS avatars_bucket;
