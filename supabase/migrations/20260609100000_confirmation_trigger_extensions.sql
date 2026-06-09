-- Extend confirmation_trigger enum for CVD, VWAP, and volume profile confirmations
ALTER TYPE public.confirmation_trigger ADD VALUE IF NOT EXISTS 'CVD_Alignment';
ALTER TYPE public.confirmation_trigger ADD VALUE IF NOT EXISTS 'Delta_Shift';
ALTER TYPE public.confirmation_trigger ADD VALUE IF NOT EXISTS 'VWAP_Acceptance';
ALTER TYPE public.confirmation_trigger ADD VALUE IF NOT EXISTS 'VWAP_Rejection';
ALTER TYPE public.confirmation_trigger ADD VALUE IF NOT EXISTS 'Anchored_VWAP_Hold';
ALTER TYPE public.confirmation_trigger ADD VALUE IF NOT EXISTS 'POC_Rejection';
ALTER TYPE public.confirmation_trigger ADD VALUE IF NOT EXISTS 'VA_Edge_Rejection';
ALTER TYPE public.confirmation_trigger ADD VALUE IF NOT EXISTS 'Value_Area_Acceptance';
