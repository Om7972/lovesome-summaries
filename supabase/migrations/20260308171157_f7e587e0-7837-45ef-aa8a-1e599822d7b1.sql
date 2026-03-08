
ALTER TABLE public.summaries 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'english',
ADD COLUMN IF NOT EXISTS translated_summary text DEFAULT '';
