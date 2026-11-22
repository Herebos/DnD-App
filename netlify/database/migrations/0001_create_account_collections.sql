CREATE TABLE account_collections (
  account_id TEXT NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('campaigns', 'characters')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(items) = 'array'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, collection)
);
