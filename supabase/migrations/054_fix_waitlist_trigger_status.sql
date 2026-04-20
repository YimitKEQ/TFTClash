-- 054_fix_waitlist_trigger_status.sql
-- Migration 052 trigger used 'waitlist' but the actual status value in use is 'waitlisted'
-- (see 002_create_registrations.sql and 029_add_game_number_and_perf_columns.sql).
-- Fix the promote_waitlist_on_drop function so the trigger fires against real rows.

CREATE OR REPLACE FUNCTION public.promote_waitlist_on_drop()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_reg_id BIGINT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('registered','checked_in')
     AND NEW.status IN ('dropped','cancelled','waitlisted','disqualified','no_show') THEN

    SELECT id INTO target_reg_id
    FROM public.registrations
    WHERE tournament_id = NEW.tournament_id
      AND status = 'waitlisted'
    ORDER BY waitlist_position NULLS LAST, registered_at ASC
    LIMIT 1;

    IF target_reg_id IS NOT NULL THEN
      UPDATE public.registrations
      SET status = 'registered',
          waitlist_position = NULL,
          waitlist_notified_at = NOW()
      WHERE id = target_reg_id;
    END IF;
  END IF;

  -- Also promote when a registration is deleted outright.
  IF TG_OP = 'DELETE' AND OLD.status IN ('registered','checked_in') THEN
    SELECT id INTO target_reg_id
    FROM public.registrations
    WHERE tournament_id = OLD.tournament_id
      AND status = 'waitlisted'
    ORDER BY waitlist_position NULLS LAST, registered_at ASC
    LIMIT 1;

    IF target_reg_id IS NOT NULL THEN
      UPDATE public.registrations
      SET status = 'registered',
          waitlist_position = NULL,
          waitlist_notified_at = NOW()
      WHERE id = target_reg_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS registrations_promote_waitlist ON public.registrations;
CREATE TRIGGER registrations_promote_waitlist
  AFTER UPDATE OR DELETE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.promote_waitlist_on_drop();
