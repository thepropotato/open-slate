import { Button, Modal } from '@/core/ui'
import { FieldRenderer } from '@/features/settings-ui/FieldRenderer'
import { Segmented } from '@/core/ui'
import { Row } from '@/core/ui'
import { SIZE_LABELS, orderSizes, type WidgetSizeName } from '@/core/widgets/sizes'
import type { AnyWidgetDefinition } from '@/core/widgets/types'
import type { WidgetInstance } from '@/core/settings/schema'

// Per-instance options, rendered from the widget's declared field descriptors.
export function WidgetConfigDialog({
  definition,
  instance,
  config,
  size,
  onChange,
  onSizeChange,
  onSurfaceChange,
  onClose,
}: {
  definition: AnyWidgetDefinition
  instance: WidgetInstance
  config: Record<string, unknown>
  size: WidgetSizeName
  onChange: (path: string, value: unknown) => void
  onSizeChange: (size: WidgetSizeName) => void
  onSurfaceChange: (surface: WidgetInstance['surface']) => void
  onClose: () => void
}) {
  const sizes = orderSizes(definition.sizes)
  return (
    <Modal
      title={`${definition.name} options`}
      width={520}
      onClose={onClose}
      footer={
        <>
          <span className="modal__spacer" />
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="settings__fields">
        <Row title="Size" help="Widgets come in a few fixed sizes, like the ones on a phone.">
          <Segmented
            value={size}
            onChange={(value) => onSizeChange(value as WidgetSizeName)}
            options={sizes.map((name) => ({ value: name, label: SIZE_LABELS[name] }))}
          />
        </Row>

        {(definition.fields ?? []).map((field, index) => (
          <FieldRenderer
            key={field.path ?? index}
            field={field}
            scope={{ values: config, write: onChange }}
          />
        ))}

        <Row title="Surface" help="Overrides the global surface style for this widget.">
          <Segmented
            value={instance.surface ?? 'inherit'}
            onChange={(value) =>
              onSurfaceChange(value === 'inherit' ? null : (value as WidgetInstance['surface']))
            }
            options={[
              { value: 'inherit', label: 'Inherit' },
              { value: 'glass', label: 'Glass' },
              { value: 'solid', label: 'Solid' },
              { value: 'outline', label: 'Outline' },
              { value: 'none', label: 'None' },
            ]}
          />
        </Row>
      </div>
    </Modal>
  )
}
