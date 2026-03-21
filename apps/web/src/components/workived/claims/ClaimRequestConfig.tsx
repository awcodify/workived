import type { ClaimWithDetails, ClaimBalanceWithCategory } from '@/types/api'
import { moduleThemes } from '@/design/tokens'
import { 
  RequestListItemConfig, 
  RequestListItemTheme, 
  RequestData, 
  RequestDetailsModalConfig,
  RequestDetailsField
} from '@/components/workived/shared/requests'
import { RequestDetailsModal } from '@/components/workived/shared/requests'

const theme = moduleThemes.claims

export const claimRequestTheme: RequestListItemTheme = {
  text: theme.text,
  textMuted: theme.textMuted,
  surface: theme.surface,
  surfaceHover: theme.surfaceHover,
  border: theme.border,
  input: theme.input,
  inputBorder: theme.inputBorder,
}

export function formatClaimAmount(amount: number, currencyCode: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return formatter.format(amount)
}

export function createClaimRequestConfig(balance?: ClaimBalanceWithCategory): RequestListItemConfig {
  return {
    getTitle: (request: RequestData) => {
      const claim = request as unknown as ClaimWithDetails
      return claim.category_name
    },
    getSubtitle: (request: RequestData) => {
      const claim = request as unknown as ClaimWithDetails
      return claim.employee_name || null
    },
    getExtraInfo: (request: RequestData, variant: 'my' | 'approval') => {
      // Show budget context for approval variant
      if (variant === 'approval' && balance) {
        const remaining = balance.monthly_limit ? balance.monthly_limit - balance.total_spent : null
        if (remaining !== null) {
          const claim = request as unknown as ClaimWithDetails
          const afterApproval = remaining - claim.amount
          return (
            <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
              Budget: <strong style={{ color: theme.text }}>
                {formatClaimAmount(remaining, claim.currency_code)} → {formatClaimAmount(afterApproval, claim.currency_code)}
              </strong>
            </p>
          )
        }
      }
      return null
    },
    DetailsModal: (props) => {
      const claim = props.request as unknown as ClaimWithDetails
      const config: RequestDetailsModalConfig = {
        title: 'Claim Request Details',
        getFields: (request) => {
          const fields: RequestDetailsField[] = []
          if (claim.employee_name) {
            fields.push({
              label: 'Employee',
              value: <p className="font-bold">{claim.employee_name}</p>,
              show: true,
            })
          }
          fields.push({
            label: 'Category',
            value: <p className="font-bold">{claim.category_name}</p>,
            show: true,
          })
          fields.push({
            label: 'Amount',
            value: <p className="font-bold text-lg">{formatClaimAmount(claim.amount, claim.currency_code)}</p>,
            show: true,
          })
          if (claim.receipt_url) {
            fields.push({
              label: 'Receipt',
              value: (
                <a 
                  href={claim.receipt_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm underline hover:opacity-70"
                  style={{ color: theme.text }}
                >
                  View Receipt →
                </a>
              ),
              show: true,
            })
          }
          return fields
        },
      }
      
      // Map claim to RequestData format (single date)
      const mappedRequest: RequestData = {
        ...claim,
        start_date: claim.claim_date,
        end_date: claim.claim_date,
        total_days: 1, // Claims are single-day
        reason: claim.description,
      }
      
      return <RequestDetailsModal request={mappedRequest} config={config} theme={claimRequestTheme} onClose={props.onClose} />
    },
  }
}
