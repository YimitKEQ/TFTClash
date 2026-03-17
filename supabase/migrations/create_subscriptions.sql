-- Create subscriptions table for tier management
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id uuid primary key references auth.users(id),
  plan text not null,
  status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz default now()
);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service_role (webhook) can write subscriptions
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
