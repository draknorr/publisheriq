ALTER TABLE core.entities
  ADD COLUMN IF NOT EXISTS loose_normalized_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS compact_normalized_name text NOT NULL DEFAULT '';

ALTER TABLE core.entity_aliases
  ADD COLUMN IF NOT EXISTS loose_normalized_alias text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS compact_normalized_alias text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_entities_loose_normalized_name_pattern ON core.entities (
    entity_kind,
    platform,
    loose_normalized_name text_pattern_ops
);
CREATE INDEX IF NOT EXISTS idx_entities_compact_normalized_name_pattern ON core.entities (
    entity_kind,
    platform,
    compact_normalized_name text_pattern_ops
);
CREATE INDEX IF NOT EXISTS idx_entities_loose_normalized_name_trgm ON core.entities USING gin (loose_normalized_name public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entity_aliases_loose_normalized_alias_pattern ON core.entity_aliases (
    loose_normalized_alias text_pattern_ops
);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_compact_normalized_alias_pattern ON core.entity_aliases (
    compact_normalized_alias text_pattern_ops
);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_loose_normalized_alias_trgm ON core.entity_aliases USING gin (loose_normalized_alias public.gin_trgm_ops);
