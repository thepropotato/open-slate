/**
 * Widget registration.
 *
 * Importing this module is what makes widgets available. Each widget registers
 * itself as a side effect of its own import, so adding one is a single line here
 * and no changes anywhere else.
 */
import './greeting/GreetingWidget'
import './clock/ClockWidget'
import './weather/WeatherWidget'
import './continue/ContinueWidget'
import './calendar/CalendarWidget'
import './notes/NotesWidget'
import './todo/TodoWidget'
import './browser/TopSitesWidget'
import './browser/TabsWidget'
import './browser/BookmarksWidget'
import './browser/HistoryWidget'
import './browser/DownloadsWidget'

export { WidgetCanvas } from './WidgetCanvas'
