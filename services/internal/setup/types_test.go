package setup

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestSetupStatus(t *testing.T) {
	status := SetupStatus{
		NeedsSetup:           true,
		Skipped:              false,
		CompletedAt:          nil,
		WorkScheduleExists:   false,
		LeavePoliciesCount:   0,
		ClaimCategoriesCount: 0,
		MembersCount:         1,
	}

	assert.True(t, status.NeedsSetup)
	assert.False(t, status.Skipped)
	assert.Nil(t, status.CompletedAt)
	assert.Equal(t, 0, status.LeavePoliciesCount)
}

func TestWorkScheduleTemplate(t *testing.T) {
	template := WorkScheduleTemplate{
		ID:          uuid.New(),
		CountryCode: "ID",
		Name:        "Standard Office Hours",
		Description: "Monday to Friday, 8 AM to 5 PM",
		WorkDays:    []int{1, 2, 3, 4, 5},
		StartTime:   "08:00:00",
		EndTime:     "17:00:00",
		SortOrder:   1,
	}

	assert.Equal(t, "ID", template.CountryCode)
	assert.Equal(t, 5, len(template.WorkDays))
	assert.Equal(t, "08:00:00", template.StartTime)
}

func TestLeavePolicyTemplate(t *testing.T) {
	maxCarryOver := 5.0
	template := LeavePolicyTemplate{
		ID:                  uuid.New(),
		CountryCode:         "ID",
		Name:                "Annual Leave",
		Description:         "Standard annual leave",
		EntitledDaysPerYear: 12.0,
		IsCarryOverAllowed:  true,
		MaxCarryOverDays:    &maxCarryOver,
		IsAccrued:           false,
		RequiresApproval:    true,
		SortOrder:           1,
	}

	assert.Equal(t, 12.0, template.EntitledDaysPerYear)
	assert.True(t, template.IsCarryOverAllowed)
	assert.NotNil(t, template.MaxCarryOverDays)
	assert.Equal(t, 5.0, *template.MaxCarryOverDays)
}

func TestClaimCategoryTemplate(t *testing.T) {
	monthlyLimit := int64(50000000)
	currencyCode := "IDR"

	template := ClaimCategoryTemplate{
		ID:              uuid.New(),
		CountryCode:     "ID",
		Name:            "Transport",
		Description:     "Transportation reimbursement",
		MonthlyLimit:    &monthlyLimit,
		CurrencyCode:    &currencyCode,
		RequiresReceipt: true,
		SortOrder:       1,
	}

	assert.Equal(t, "ID", template.CountryCode)
	assert.NotNil(t, template.MonthlyLimit)
	assert.Equal(t, int64(50000000), *template.MonthlyLimit)
	assert.True(t, template.RequiresReceipt)
}

func TestCompleteSetupRequest(t *testing.T) {
	templateID := uuid.New()
	leavePolicyID := uuid.New()
	claimCategoryID := uuid.New()

	req := CompleteSetupRequest{
		WorkSchedule: WorkScheduleChoice{
			TemplateID:     &templateID,
			CustomSchedule: nil,
		},
		LeavePolicies: LeavePolicySelection{
			TemplateIDs:    []uuid.UUID{leavePolicyID},
			Customizations: make(map[string]LeavePolicyCustomization),
		},
		ClaimCategories: ClaimCategorySelection{
			TemplateIDs:    []uuid.UUID{claimCategoryID},
			Customizations: make(map[string]ClaimCategoryCustomization),
		},
		Invitations: []InvitationInput{
			{Email: "team@example.com", Role: "member"},
		},
	}

	assert.NotNil(t, req.WorkSchedule.TemplateID)
	assert.Nil(t, req.WorkSchedule.CustomSchedule)
	assert.Equal(t, 1, len(req.LeavePolicies.TemplateIDs))
	assert.Equal(t, 1, len(req.Invitations))
}

func TestCustomScheduleInput(t *testing.T) {
	custom := CustomScheduleInput{
		Name:      "Custom Schedule",
		WorkDays:  []int{1, 2, 3, 4, 5},
		StartTime: "09:00",
		EndTime:   "18:00",
	}

	assert.Equal(t, "Custom Schedule", custom.Name)
	assert.Equal(t, 5, len(custom.WorkDays))
	assert.Equal(t, "09:00", custom.StartTime)
}

func TestCompleteSetupResponse(t *testing.T) {
	workScheduleID := uuid.New()
	leavePolicyID := uuid.New()
	claimCategoryID := uuid.New()
	invitationID := uuid.New()

	response := CompleteSetupResponse{
		Success:          true,
		WorkScheduleID:   workScheduleID,
		LeavePolicyIDs:   []uuid.UUID{leavePolicyID},
		ClaimCategoryIDs: []uuid.UUID{claimCategoryID},
		InvitationIDs:    []uuid.UUID{invitationID},
	}

	assert.True(t, response.Success)
	assert.Equal(t, workScheduleID, response.WorkScheduleID)
	assert.Equal(t, 1, len(response.LeavePolicyIDs))
	assert.Equal(t, 1, len(response.ClaimCategoryIDs))
	assert.Equal(t, 1, len(response.InvitationIDs))
}
