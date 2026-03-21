import type { LeaveRequestWithDetails, LeaveBalanceWithPolicy } from '@/types/api'
import { moduleThemes } from '@/design/tokens'
import { 
  RequestListItemConfig, 
  RequestListItemTheme, 
  RequestData, 
  RequestDetailsModalConfig,
  RequestDetailsField
} from '@/components/workived/shared/requests'
import { RequestDetailsModal } from '@/components/workived/shared/requests'
import { calculateAvailableDays } from '@/lib/utils/leave'

const theme = moduleThemes.leave

export const leaveRequestTheme: RequestListItemTheme = {
  text: theme.text,
  textMuted: theme.textMuted,
  surface: theme.surface,
  surfaceHover: theme.surfaceHover,
  border: theme.border,
  input: theme.input,
  inputBorder: theme.inputBorder,
}

export function createLeaveRequestConfig(balance?: LeaveBalanceWithPolicy): RequestListItemConfig {
  return {
    getTitle: (request: RequestData) => {
      const leaveRequest = request as LeaveRequestWithDetails
      return leaveRequest.policy_name
    },
    getSubtitle: (request: RequestData) => {
      const leaveRequest = request as LeaveRequestWithDetails
      return leaveRequest.employee_name || null
    },
    getExtraInfo: (request: RequestData, variant: 'my' | 'approval') => {
      // Only show balance impact for 'my' variant
      if (variant !== 'my' || !balance) return null
      
      const current = calculateAvailableDays(balance)
      const after = current - request.total_days
      
      return (
        <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
          Balance: <strong style={{ color: theme.text }}>{current} → {after}</strong>
        </p>
      )
    },
    DetailsModal: (props) => {
      const leaveRequest = props.request as LeaveRequestWithDetails
      const config: RequestDetailsModalConfig = {
        title: 'Leave Request Details',
        getFields: (request) => {
          const fields: RequestDetailsField[] = []
          if (leaveRequest.employee_name) {
            fields.push({
              label: 'Employee',
              value: <p className="font-bold">{leaveRequest.employee_name}</p>,
              show: true,
            })
          }
          fields.push({
            label: 'Leave Type',
            value: <p className="font-bold">{leaveRequest.policy_name}</p>,
            show: true,
          })
          return fields
        },
      }
      return <RequestDetailsModal request={props.request} config={config} theme={leaveRequestTheme} onClose={props.onClose} />
    },
  }
}
