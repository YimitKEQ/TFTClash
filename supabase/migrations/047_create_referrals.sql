-- Migration 047: Create referrals table
-- Tracks referral codes and who referred whom

CREATE TABLE IF NOT EXISTS referrals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  referrer_code text NOT NULL,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  UNIQUE (referred_user_id)
);

-- RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral" ON referrals
  FOR SELECT USING (referred_user_id = auth.uid());

CREATE POLICY "Service role full access" ON referrals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for referrer lookups
CREATE INDEX idx_referrals_referrer_code ON referrals (referrer_code);

COMMENT ON TABLE referrals IS 'Referral tracking for user growth';
