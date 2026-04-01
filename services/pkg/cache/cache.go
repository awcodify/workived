package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

// Store wraps a Redis client with JSON serialization and TTL helpers.
type Store struct {
	rdb *redis.Client
	log zerolog.Logger
}

// New creates a new cache Store.
func New(rdb *redis.Client, log zerolog.Logger) *Store {
	return &Store{rdb: rdb, log: log.With().Str("component", "cache").Logger()}
}

// Get retrieves a cached value and unmarshals it. Returns false on miss.
func Get[T any](ctx context.Context, s *Store, key string) (T, bool) {
	var zero T
	data, err := s.rdb.Get(ctx, key).Bytes()
	if err != nil {
		if err != redis.Nil {
			s.log.Warn().Err(err).Str("key", key).Msg("cache.get failed")
		}
		return zero, false
	}
	var val T
	if err := json.Unmarshal(data, &val); err != nil {
		s.log.Warn().Err(err).Str("key", key).Msg("cache.unmarshal failed")
		return zero, false
	}
	return val, true
}

// Set marshals val and stores it with the given TTL.
func Set[T any](ctx context.Context, s *Store, key string, val T, ttl time.Duration) {
	data, err := json.Marshal(val)
	if err != nil {
		s.log.Warn().Err(err).Str("key", key).Msg("cache.marshal failed")
		return
	}
	if err := s.rdb.Set(ctx, key, data, ttl).Err(); err != nil {
		s.log.Warn().Err(err).Str("key", key).Msg("cache.set failed")
	}
}

// Delete removes one or more keys.
func (s *Store) Delete(ctx context.Context, keys ...string) {
	if len(keys) == 0 {
		return
	}
	if err := s.rdb.Del(ctx, keys...).Err(); err != nil {
		s.log.Warn().Err(err).Strs("keys", keys).Msg("cache.delete failed")
	}
}

// DeletePattern removes all keys matching a glob pattern (e.g. "org:{id}:emp:*").
// Uses SCAN to avoid blocking Redis with KEYS.
func (s *Store) DeletePattern(ctx context.Context, pattern string) {
	var cursor uint64
	for {
		keys, nextCursor, err := s.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			s.log.Warn().Err(err).Str("pattern", pattern).Msg("cache.scan failed")
			return
		}
		if len(keys) > 0 {
			if err := s.rdb.Del(ctx, keys...).Err(); err != nil {
				s.log.Warn().Err(err).Strs("keys", keys).Msg("cache.delete_batch failed")
			}
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
}

// ── Key helpers ──────────────────────────────────────────────────────────────

// OrgKey builds "org:{orgID}:{module}:{suffix}".
func OrgKey(orgID fmt.Stringer, module, suffix string) string {
	return fmt.Sprintf("org:%s:%s:%s", orgID, module, suffix)
}

// OrgListKey builds "org:{orgID}:{module}:list".
func OrgListKey(orgID fmt.Stringer, module string) string {
	return OrgKey(orgID, module, "list")
}

// OrgItemKey builds "org:{orgID}:{module}:{itemID}".
func OrgItemKey(orgID, itemID fmt.Stringer, module string) string {
	return fmt.Sprintf("org:%s:%s:%s", orgID, module, itemID)
}

// OrgPatternKey builds "org:{orgID}:{module}:*" for pattern deletion.
func OrgPatternKey(orgID fmt.Stringer, module string) string {
	return fmt.Sprintf("org:%s:%s:*", orgID, module)
}
