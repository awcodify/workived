package validate

import (
	"regexp"
	"sync"

	"github.com/go-playground/validator/v10"
)

var (
	once     sync.Once
	instance *validator.Validate

	// slugRe: lowercase letters, digits, and hyphens; no leading/trailing hyphen.
	slugRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)
)

// Get returns the shared validator instance (lazily initialised).
func Get() *validator.Validate {
	once.Do(func() {
		instance = validator.New()
		// "slug" — lowercase alphanumeric + hyphens, no leading/trailing hyphen
		_ = instance.RegisterValidation("slug", func(fl validator.FieldLevel) bool {
			return slugRe.MatchString(fl.Field().String())
		})
	})
	return instance
}

// Struct validates a struct using registered tags and returns the first error.
func Struct(s any) error {
	return Get().Struct(s)
}
