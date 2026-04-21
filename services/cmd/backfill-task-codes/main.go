package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/workived/services/internal/platform/config"
	"github.com/workived/services/internal/platform/database"
	"github.com/workived/services/internal/tasks"
)

func main() {
	dryRun := flag.Bool("dry-run", false, "Simulate backfill without making changes")
	orgID := flag.String("org", "", "Backfill only for specific organisation ID (optional)")
	flag.Parse()

	log.Logger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: "15:04:05"}).With().Timestamp().Logger()

	log.Info().
		Bool("dry_run", *dryRun).
		Str("org_id", *orgID).
		Msg("Task Code Backfill")

	if *dryRun {
		log.Warn().Msg("DRY RUN MODE: No database changes will be made")
	}

	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load config")
	}

	// Connect to database
	ctx := context.Background()
	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer db.Close()

	// Create tasks repository
	repo := tasks.NewRepository(db, log.Logger)

	// Get list of organisations to process
	orgs, err := getOrganisations(ctx, db, *orgID)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to get organisations")
	}

	log.Info().Int("org_count", len(orgs)).Msg("Found organisations to process")

	totalTasks := 0
	totalUpdated := 0

	for _, org := range orgs {
		log.Info().Str("org_id", org.ID.String()).Str("org_name", org.Name).Msg("Processing organisation")

		// Get all tasks without codes
		tasksWithoutCode, err := getTasksWithoutCode(ctx, db, org.ID)
		if err != nil {
			log.Error().Err(err).Str("org_id", org.ID.String()).Msg("Failed to get tasks")
			continue
		}

		log.Info().
			Str("org_id", org.ID.String()).
			Int("tasks_without_code", len(tasksWithoutCode)).
			Msg("Found tasks without codes")

		totalTasks += len(tasksWithoutCode)

		if len(tasksWithoutCode) == 0 {
			continue
		}

		// Backfill codes for each task
		for _, task := range tasksWithoutCode {
			if *dryRun {
				// In dry-run mode, just generate the code without saving
				code, err := repo.NextTaskCode(ctx, org.ID)
				if err != nil {
					log.Error().Err(err).Str("task_id", task.ID.String()).Msg("Failed to generate code")
					continue
				}
				log.Info().
					Str("task_id", task.ID.String()).
					Str("task_title", task.Title).
					Str("code", code).
					Msg("Would assign code (dry-run)")
				totalUpdated++
			} else {
				// Generate and assign code
				code, err := repo.NextTaskCode(ctx, org.ID)
				if err != nil {
					log.Error().Err(err).Str("task_id", task.ID.String()).Msg("Failed to generate code")
					continue
				}

				// Update task with the code
				_, err = db.Exec(ctx, `
					UPDATE tasks SET code = $1 WHERE id = $2
				`, code, task.ID)
				if err != nil {
					log.Error().Err(err).Str("task_id", task.ID.String()).Str("code", code).Msg("Failed to update task")
					continue
				}

				log.Info().
					Str("task_id", task.ID.String()).
					Str("task_title", task.Title).
					Str("code", code).
					Msg("Assigned code")
				totalUpdated++
			}
		}
	}

	log.Info().
		Int("total_tasks", totalTasks).
		Int("total_updated", totalUpdated).
		Msg("Backfill complete")

	if *dryRun {
		log.Warn().Msg("DRY RUN: No changes were made to the database")
	}
}

type Org struct {
	ID   uuid.UUID
	Name string
}

type TaskInfo struct {
	ID    uuid.UUID
	Title string
}

func getOrganisations(ctx context.Context, db *pgxpool.Pool, orgID string) ([]Org, error) {
	var query string
	var args []interface{}

	if orgID != "" {
		// Specific org
		id, err := uuid.Parse(orgID)
		if err != nil {
			return nil, fmt.Errorf("invalid organisation ID: %w", err)
		}
		query = `SELECT id, name FROM organisations WHERE id = $1 AND is_active = TRUE`
		args = []interface{}{id}
	} else {
		// All orgs
		query = `SELECT id, name FROM organisations WHERE is_active = TRUE ORDER BY name`
		args = []interface{}{}
	}

	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orgs []Org
	for rows.Next() {
		var org Org
		if err := rows.Scan(&org.ID, &org.Name); err != nil {
			return nil, err
		}
		orgs = append(orgs, org)
	}

	return orgs, rows.Err()
}

func getTasksWithoutCode(ctx context.Context, db *pgxpool.Pool, orgID uuid.UUID) ([]TaskInfo, error) {
	rows, err := db.Query(ctx, `
		SELECT id, title 
		FROM tasks 
		WHERE organisation_id = $1 AND code IS NULL
		ORDER BY created_at ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasksList []TaskInfo
	for rows.Next() {
		var task TaskInfo
		if err := rows.Scan(&task.ID, &task.Title); err != nil {
			return nil, err
		}
		tasksList = append(tasksList, task)
	}

	return tasksList, rows.Err()
}
