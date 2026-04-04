import { useState } from 'react'
import { Trash2, Edit2, Plus, Briefcase, Building2 } from 'lucide-react'
import { useDepartments, useDeleteDepartment } from '@/lib/hooks/useDepartments'
import { useJobTitles, useDeleteJobTitle } from '@/lib/hooks/useJobTitles'
import { useCanManageEmployees } from '@/lib/hooks/useRole'
import { DepartmentModal } from './DepartmentModal'
import { JobTitleModal } from './JobTitleModal'
import { moduleThemes, typography } from '@/design/tokens'
import type { Department, JobTitle } from '@/types/api'

const t = moduleThemes.people

interface ManagementPanelProps {
  onClose: () => void
}

export function ManagementPanel({ onClose }: ManagementPanelProps) {
  const canManageEmployees = useCanManageEmployees()
  const [activeTab, setActiveTab] = useState<'departments' | 'jobtitles'>('departments')
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [selectedJobTitle, setSelectedJobTitle] = useState<JobTitle | null>(null)
  const [showDepartmentModal, setShowDepartmentModal] = useState(false)
  const [showJobTitleModal, setShowJobTitleModal] = useState(false)

  const { data: departments = [], isLoading: loadingDepts } = useDepartments()
  const { data: jobTitles = [], isLoading: loadingTitles } = useJobTitles()
  const deleteDepartment = useDeleteDepartment()
  const deleteJobTitle = useDeleteJobTitle()

  // Safely handle null/undefined data
  const safeDepartments = departments ?? []
  const safeJobTitles = jobTitles ?? []

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return
    await deleteDepartment.mutateAsync(id)
  }

  const handleDeleteJobTitle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job title?')) return
    await deleteJobTitle.mutateAsync(id)
  }

  const handleEditDepartment = (dept: Department) => {
    setSelectedDepartment(dept)
    setShowDepartmentModal(true)
  }

  const handleEditJobTitle = (jobTitle: JobTitle) => {
    setSelectedJobTitle(jobTitle)
    setShowJobTitleModal(true)
  }

  const handleNewDepartment = () => {
    setSelectedDepartment(null)
    setShowDepartmentModal(true)
  }

  const handleNewJobTitle = () => {
    setSelectedJobTitle(null)
    setShowJobTitleModal(true)
  }

  const handleModalClose = () => {
    setShowDepartmentModal(false)
    setShowJobTitleModal(false)
    setSelectedDepartment(null)
    setSelectedJobTitle(null)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl max-h-[80vh] flex flex-col"
          style={{
            background: t.surface,
            borderRadius: 16,
            border: `1px solid ${t.border}`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: `1px solid ${t.border}` }}
          >
            <h2
              className="font-bold"
              style={{ fontSize: typography.h2.size, color: t.text }}
            >
              Manage Organization Data
            </h2>
            <button
              onClick={onClose}
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-70"
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                color: t.text,
              }}
            >
              Close
            </button>
          </div>

          {/* Tabs */}
          <div
            className="flex gap-4 px-6 py-3"
            style={{ borderBottom: `1px solid ${t.border}` }}
          >
            <button
              onClick={() => setActiveTab('departments')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-all"
              style={{
                background: activeTab === 'departments' ? t.accent : 'transparent',
                color: activeTab === 'departments' ? '#ffffff' : t.textMuted,
              }}
            >
              <Building2 size={16} />
              Departments ({safeDepartments.length})
            </button>
            <button
              onClick={() => setActiveTab('jobtitles')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-all"
              style={{
                background: activeTab === 'jobtitles' ? t.accent : 'transparent',
                color: activeTab === 'jobtitles' ? '#ffffff' : t.textMuted,
              }}
            >
              <Briefcase size={16} />
              Job Titles ({safeJobTitles.length})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {activeTab === 'departments' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm" style={{ color: t.textMuted }}>
                    Manage departments for organizational structure
                  </p>
                  {canManageEmployees && (
                    <button
                      onClick={handleNewDepartment}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90"
                      style={{
                        background: t.accent,
                        color: '#ffffff',
                      }}
                    >
                      <Plus size={16} />
                      New Department
                    </button>
                  )}
                </div>

                {loadingDepts ? (
                  <p className="text-sm text-center py-8" style={{ color: t.textMuted }}>
                    Loading...
                  </p>
                ) : safeDepartments.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 size={48} className="mx-auto mb-3" style={{ color: t.textMuted }} />
                    <p className="text-sm" style={{ color: t.textMuted }}>
                      No departments yet. Create one to get started.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {safeDepartments.map((dept) => (
                      <div
                        key={dept.id}
                        className="flex items-center justify-between px-4 py-3 rounded-lg"
                        style={{
                          background: t.input,
                          border: `1px solid ${t.inputBorder}`,
                        }}
                      >
                        <span className="text-sm font-medium" style={{ color: t.text }}>
                          {dept.name}
                        </span>
                        {canManageEmployees && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditDepartment(dept)}
                              className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                              style={{ color: t.textMuted }}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteDepartment(dept.id)}
                              disabled={deleteDepartment.isPending}
                              className="p-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-50"
                              style={{ color: '#ef4444' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'jobtitles' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm" style={{ color: t.textMuted }}>
                    Standardized job titles for workforce analytics
                  </p>
                  {canManageEmployees && (
                    <button
                      onClick={handleNewJobTitle}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90"
                      style={{
                        background: t.accent,
                        color: '#ffffff',
                      }}
                    >
                      <Plus size={16} />
                      New Job Title
                    </button>
                  )}
                </div>

                {loadingTitles ? (
                  <p className="text-sm text-center py-8" style={{ color: t.textMuted }}>
                    Loading...
                  </p>
                ) : safeJobTitles.length === 0 ? (
                  <div className="text-center py-12">
                    <Briefcase size={48} className="mx-auto mb-3" style={{ color: t.textMuted }} />
                    <p className="text-sm" style={{ color: t.textMuted }}>
                      No job titles yet. Create one to get started.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobTitles.map((title: JobTitle) => (
                      <div
                        key={title.id}
                        className="flex items-center justify-between px-4 py-3 rounded-lg"
                        style={{
                          background: t.input,
                          border: `1px solid ${t.inputBorder}`,
                        }}
                      >
                        <span className="text-sm font-medium" style={{ color: t.text }}>
                          {title.name}
                        </span>
                        {canManageEmployees && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditJobTitle(title)}
                              className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                              style={{ color: t.textMuted }}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteJobTitle(title.id)}
                              disabled={deleteJobTitle.isPending}
                              className="p-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-50"
                              style={{ color: '#ef4444' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDepartmentModal && (
        <DepartmentModal
          department={selectedDepartment ?? undefined}
          onClose={handleModalClose}
          onSuccess={handleModalClose}
        />
      )}
      {showJobTitleModal && (
        <JobTitleModal
          jobTitle={selectedJobTitle ?? undefined}
          onClose={handleModalClose}
          onSuccess={handleModalClose}
        />
      )}
    </>
  )
}
