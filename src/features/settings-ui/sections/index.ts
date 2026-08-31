import type { Section } from '../types'
import { appearanceSection } from './appearance'
import { backgroundSection } from './background'
import { behaviorSection } from './behavior'
import { dataSection } from './data'
import { layoutSection } from './layout'
import { searchSection } from './search'
import { tilesSection } from './tiles'
import { widgetsSection } from './widgets'

// The settings sections, in sidebar order; each feature contributes its own file.
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
