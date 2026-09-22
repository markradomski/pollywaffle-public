export { BalloonRace } from './components/BalloonRace'
export type { BalloonRaceProps } from './components/BalloonRace'

export type { BalloonDatum } from './model/BalloonDatum'
export type { BalloonMapping } from './model/BalloonMapping'
export type {
  BalloonRaceConfig,
  BalloonRaceMargins,
  BalloonOrientation,
  SemanticScaleMode,
} from './model/BalloonConfig'
export { DEFAULT_BALLOON_RACE_CONFIG, resolveBalloonRaceConfig } from './model/BalloonConfig'
export type { BalloonReferenceLine } from './model/ReferenceLine'
export type { BalloonFilter, BalloonFilterOption, BalloonFilterValues } from './model/BalloonFilter'

export { normalizeData } from './data/normalize'
export type { NormalizeIssue, NormalizeResult } from './data/normalize'
export { filterBalloonData } from './data/filterData'

export { validateBalloonData, balloonDatumSchema } from './data/validation'
export type { BalloonDataValidationResult } from './data/validation'

export { parseCsv, loadTextResource, loadCsvResource } from './data/loaders'

export { createValueScale, createRadiusScale, createGroupColorScale } from './scales/createScales'

export { useContainerSize } from './hooks/useContainerSize'
export type { ContainerSize } from './hooks/useContainerSize'
export { useBalloonFilters } from './hooks/useBalloonFilters'
export type { UseBalloonFiltersResult } from './hooks/useBalloonFilters'

export type { BalloonNode, SemanticPositionScale } from './layout/types'
export { createBalloonNodes } from './layout/createBalloonNodes'
export {
  runBalloonSimulation,
  clampNodesToBounds,
  DEFAULT_VALUE_STRENGTH,
  DEFAULT_PACKING_STRENGTH,
  DEFAULT_VERTICAL_VALUE_STRENGTH,
  DEFAULT_VERTICAL_PACKING_STRENGTH,
  DEFAULT_SIMULATION_TICKS,
} from './layout/runBalloonSimulation'
export type { BalloonSimulationOptions } from './layout/runBalloonSimulation'
export { computeBalloonLayout } from './layout/computeBalloonLayout'
export type { BalloonLayoutOptions } from './layout/computeBalloonLayout'
export { selectLabeledNodes } from './layout/selectLabeledNodes'
export { calculateLayoutHeight } from './layout/calculateLayoutHeight'
export type { LayoutHeightOptions } from './layout/calculateLayoutHeight'
export { calculateSemanticBands } from './layout/calculateSemanticBands'
export type { SemanticBand, SemanticBandsOptions, SemanticBandsResult } from './layout/calculateSemanticBands'
export { calculateInitialPackingPositions, goldenRatioSequence } from './layout/calculatePackingSeed'
export type { PackingSeedMember } from './layout/calculatePackingSeed'

export type { LayoutSnapshotNode, RenderNode } from './motion/types'
export { interpolateLayout } from './motion/interpolateLayout'
export { easeOutCubic } from './motion/easing'
export { useLayoutTransition } from './motion/useLayoutTransition'
export type { LayoutTransitionOptions } from './motion/useLayoutTransition'

export { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'

export { BalloonTooltip } from './components/BalloonTooltip'
export type { BalloonTooltipProps } from './components/BalloonTooltip'
export { defaultTooltipFormatter, isSafeTooltipUrl } from './components/tooltip'
export type { BalloonTooltipField, BalloonTooltipFormatter } from './components/tooltip'
export { computeTooltipPosition } from './components/tooltipPosition'
export type { TooltipAnchor, TooltipPosition } from './components/tooltipPosition'

export { defaultExpandedContentFormatter } from './components/expandedContent'
export type { BalloonExpandedContent, BalloonExpandedContentFormatter } from './components/expandedContent'
export {
  calculateExpandedGeometry,
  calculateMaxExpandedRadius,
  computeExpandedPresentationPosition,
} from './components/expandedGeometry'
export type { ExpandedGeometry, ExpandedGeometryOptions } from './components/expandedGeometry'
export { getContrastingTextColor } from './components/colorContrast'
export { ExpandedBalloonContent } from './components/ExpandedBalloonContent'
export type { ExpandedBalloonContentProps } from './components/ExpandedBalloonContent'
export { calculateInternalLabelFit } from './components/calculateInternalLabel'
export type { InternalLabelInput, InternalLabelFit } from './components/calculateInternalLabel'
