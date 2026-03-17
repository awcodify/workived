package validate

import (
	"sync"

	"github.com/go-playground/validator/v10"
)

var (
	once     sync.Once
	instance *validator.Validate
)

// Get returns the shared validator instance (lazily initialised).
func Get() *validator.Validate {
	once.Do(func() {
		instance = validator.New()
	})
	return instance
}

// Struct validates a struct using registered tags and returns the first error.
func Struct(s any) error {
	return Get().Struct(s)
}
