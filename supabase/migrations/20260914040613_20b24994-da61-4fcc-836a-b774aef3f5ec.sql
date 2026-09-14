
-- 1) SECURITY DEFINER function handle_new_user must not be callable via the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- 2) Storage policies for the private 'clips' bucket, scoped to the owner's folder
CREATE POLICY "Users can read their own clips"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload their own clips"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own clips"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own clips"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3) cron_tokens holds secrets: keep it fail-closed, explicitly revoke all client access
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.cron_tokens FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.cron_tokens FROM authenticated;
