import type { Section } from '../types'
import { appearanceSection } from './appearance'
import { layoutSection } from './layout'

/**
 * The settings sections, in sidebar order. Each feature contributes its own
 * file here, so adding a feature never means touching a shared form component.
 */
export const sections: Section[] = [appearanceSection, layoutSection]
