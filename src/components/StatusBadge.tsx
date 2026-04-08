import { daysCzech } from '@/lib/csPlural'
import type { Lot } from '@/types'
import { Badge } from '@/components/ui/badge'

export function StatusBadge({ lot }: { lot: Lot }) {
  if (lot.isExempt) {
    return <Badge variant="success">Osvobozeno</Badge>
  }
  if (lot.daysUntilExempt > 0 && lot.daysUntilExempt <= 180) {
    return (
      <Badge variant="warning">
        Za {lot.daysUntilExempt} {daysCzech(lot.daysUntilExempt)}
      </Badge>
    )
  }
  return <Badge variant="destructive">Zdanitelné</Badge>
}
