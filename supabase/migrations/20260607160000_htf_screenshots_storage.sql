-- HTF chart journal screenshot storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-screenshots',
  'trade-screenshots',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trade_screenshots_select_own'
  ) THEN
    CREATE POLICY "trade_screenshots_select_own"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trade_screenshots_insert_own'
  ) THEN
    CREATE POLICY "trade_screenshots_insert_own"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'trade_screenshots_delete_own'
  ) THEN
    CREATE POLICY "trade_screenshots_delete_own"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'trade-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
