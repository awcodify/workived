import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { getSetupStatus, getSetupTemplates, completeSetup, skipSetup } from '@/lib/api/setup'
import type {
  WorkScheduleTemplate,
  LeavePolicyTemplate,
  ClaimCategoryTemplate,
  CustomScheduleInput,
  LeavePolicyCustomization,
  ClaimCategoryCustomization,
} from '@/types/api'

// Wizard steps
import { WelcomeStep } from './steps/WelcomeStep'
import { WorkScheduleStep } from './steps/WorkScheduleStep'
import { LeavePoliciesStep } from './steps/LeavePoliciesStep'
import { ClaimCategoriesStep } from './steps/ClaimCategoriesStep'
import { PreviewStep } from './steps/PreviewStep'
import { SuccessStep } from './steps/SuccessStep'
import { AlreadyCompletedStep } from './steps/AlreadyCompletedStep'

type Step = 'welcome' | 'workSchedule' | 'leavePolicies' | 'claimCategories' | 'preview' | 'success'

export interface WizardState {
  // Work Schedule
  selectedWorkScheduleTemplate?: WorkScheduleTemplate
  customSchedule?: CustomScheduleInput
  
  // Leave Policies
  selectedLeavePolicies: LeavePolicyTemplate[]
  leavePolicyCustomizations: Record<string, LeavePolicyCustomization>
  
  // Claim Categories
  selectedClaimCategories: ClaimCategoryTemplate[]
  claimCategoryCustomizations: Record<string, ClaimCategoryCustomization>
}

export function SetupWizard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [currentStep, setCurrentStep] = useState<Step>('welcome')
  const [wizardState, setWizardState] = useState<WizardState>({
    selectedLeavePolicies: [],
    leavePolicyCustomizations: {},
    selectedClaimCategories: [],
    claimCategoryCustomizations: {},
  })

  // Check setup status first
  const { data: setupStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['setup', 'status'],
    queryFn: getSetupStatus,
    staleTime: 30000, // 30 seconds
  })

  // Fetch templates
  const { data: templates, isLoading: templatesLoading, error: templatesError, refetch } = useQuery({
    queryKey: ['setup', 'templates'],
    queryFn: getSetupTemplates,
    staleTime: Infinity, // Templates don't change during setup
    retry: 2, // Retry failed requests twice
    enabled: setupStatus?.needs_setup === true, // Only fetch templates if setup is needed
  })

  // Complete setup mutation
  const completeMutation = useMutation({
    mutationFn: completeSetup,
    onSuccess: () => {
      setCurrentStep('success')
      queryClient.invalidateQueries({ queryKey: ['setup'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to complete setup')
    },
  })

  // Skip setup mutation
  const skipMutation = useMutation({
    mutationFn: skipSetup,
    onSuccess: () => {
      toast.success('Setup skipped - you can complete it later from settings')
      navigate({ to: '/overview' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to skip setup')
    },
  })

  const updateWizardState = (updates: Partial<WizardState>) => {
    setWizardState((prev) => ({ ...prev, ...updates }))
  }

  const handleNext = (updates?: Partial<WizardState>) => {
    if (updates) {
      updateWizardState(updates)
    }

    const stepOrder: Step[] = [
      'welcome',
      'workSchedule',
      'leavePolicies',
      'claimCategories',
      'preview',
      'success',
    ]
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1]
      if (nextStep) setCurrentStep(nextStep)
    }
  }

  const handleBack = () => {
    const stepOrder: Step[] = [
      'welcome',
      'workSchedule',
      'leavePolicies',
      'claimCategories',
      'preview',
      'success',
    ]
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex > 0) {
      const prevStep = stepOrder[currentIndex - 1]
      if (prevStep) setCurrentStep(prevStep)
    }
  }

  const handleSkip = () => {
    skipMutation.mutate()
  }

  const handleComplete = async () => {
    // Build request from wizard state
    const request = {
      work_schedule: wizardState.selectedWorkScheduleTemplate
        ? { template_id: wizardState.selectedWorkScheduleTemplate.id }
        : { custom_schedule: wizardState.customSchedule! },
      leave_policies: {
        template_ids: wizardState.selectedLeavePolicies.map((p) => p.id),
        customizations: wizardState.leavePolicyCustomizations,
      },
      claim_categories: {
        template_ids: wizardState.selectedClaimCategories.map((c) => c.id),
        customizations: wizardState.claimCategoryCustomizations,
      },
    }

    completeMutation.mutate(request)
  }

  // Show loading while checking status
  if (statusLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // Show already completed message if setup is done
  if (setupStatus && !setupStatus.needs_setup) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <AlreadyCompletedStep 
          completedAt={setupStatus.completed_at}
          onContinue={() => navigate({ to: '/overview' })} 
        />
      </div>
    )
  }

  if (templatesLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (templatesError || !templates) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg text-gray-900 dark:text-white">Failed to load templates</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {templatesError instanceof Error ? templatesError.message : 'Please try again'}
        </p>
        <button
          onClick={() => refetch()}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {currentStep === 'welcome' && (
        <WelcomeStep onNext={() => handleNext()} onSkip={handleSkip} isSkipping={skipMutation.isPending} />
      )}

      {currentStep === 'workSchedule' && (
        <WorkScheduleStep
          templates={templates?.work_schedules ?? []}
          selected={wizardState.selectedWorkScheduleTemplate}
          customSchedule={wizardState.customSchedule}
          onNext={(selection) => handleNext(selection)}
          onBack={handleBack}
        />
      )}

      {currentStep === 'leavePolicies' && (
        <LeavePoliciesStep
          templates={templates?.leave_policies ?? []}
          selected={wizardState.selectedLeavePolicies}
          customizations={wizardState.leavePolicyCustomizations}
          onNext={(selection) => handleNext(selection)}
          onBack={handleBack}
        />
      )}

      {currentStep === 'claimCategories' && (
        <ClaimCategoriesStep
          templates={templates?.claim_categories ?? []}
          selected={wizardState.selectedClaimCategories}
          customizations={wizardState.claimCategoryCustomizations}
          onNext={(selection) => handleNext(selection)}
          onBack={handleBack}
        />
      )}

      {currentStep === 'preview' && (
        <PreviewStep
          wizardState={wizardState}
          templates={templates}
          onConfirm={() => handleComplete()}
          onBack={handleBack}
          isSubmitting={completeMutation.isPending}
        />
      )}

      {currentStep === 'success' && (
        <SuccessStep onContinue={() => navigate({ to: '/overview' })} />
      )}
    </div>
  )
}
