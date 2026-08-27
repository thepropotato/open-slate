import type { Section } from '../types'
import { appearanceSection } from './appearance'
import { backgroundSection } from './background'
import { behaviorSection } from './behavior'
import { dataSection } from './data'
import { layoutSection } from './layout'
import { searchSection } from './search'
import { tilesSection } from './tiles'
import { widgetsSection } from './widgets'

/**
 * The settings sections, in sidebar order. Each feature contributes its own
 * file here, so adding a feature never means touching a shared form component.
 */
export const sections: Section[] = [
  appearanceSection,
  backgroundSection,
  layoutSection,
  searchSection,
  tilesSection,
  widgetsSection,
  behaviorSection,
  dataSection,
]
