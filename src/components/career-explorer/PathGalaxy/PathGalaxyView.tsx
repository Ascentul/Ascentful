'use client';

import { motion, useReducedMotion } from 'framer-motion';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import type {
  AnchorNode,
  PathGraph,
  PathNode as PathNodeType,
  PlacedStep,
} from '@/lib/career-explorer/types';

// Motion constants for consistent animations
const MOTION = {
  hover: { duration: 0.15 },
  focus: { type: 'spring' as const, stiffness: 300, damping: 25 },
  pathDraw: { duration: 0.4, ease: 'easeOut' as const },
  fadeUnrelated: { duration: 0.3 },
  nodeEnter: { type: 'spring' as const, stiffness: 200, damping: 20 },
};

interface PathGalaxyViewProps {
  graph: PathGraph;
  selectedNodeId?: string;
  focusedNodeId?: string;
  onNodeSelect?: (nodeId: string) => void;
  onNodeSave?: (nodeId: string) => void;
  onNodeFocus?: (nodeId: string | null) => void;
  onNodeHover?: (nodeId: string | null, position: { x: number; y: number } | null) => void;
  onPlaceInPlan?: (nodeId: string) => void;
  isLoading?: boolean;
  maxNodes?: number;
  nextCareerPaths?: PathNodeType[];
  // V3 Timeline props
  anchorNode?: AnchorNode | null;
  focusMode?: boolean;
  placedPlanSteps?: PlacedStep[];
}

// Anchor node constants
const ANCHOR_RADIUS = 14;
const NODE_RADIUS = 7;
const SELECTED_NODE_RADIUS = 10;
const COLUMN_PADDING = 80;

// Calculate timeline positions with left-to-right flow
function calculateTimelinePositions(
  nodes: PathNodeType[],
  anchorNode: AnchorNode | null,
  selectedNodeId: string | null,
  focusMode: boolean,
  nextCareerPaths: PathNodeType[],
  containerWidth: number,
  containerHeight: number,
): Map<string, { x: number; y: number; column: number; opacity: number }> {
  const positions = new Map<string, { x: number; y: number; column: number; opacity: number }>();

  if (nodes.length === 0) return positions;

  // Filter out 'current' type nodes
  const roleNodes = nodes.filter((n) => n.type !== 'current');
  if (roleNodes.length === 0) return positions;

  // Column positions (left-to-right):
  // Column 0: Anchor "You are here" - fixed at ~12% of width
  // Column 1: Recommended roles (default) OR Selected role (focus mode) - ~40% of width
  // Column 2: Future options (nextCareerPaths in focus mode) - ~70% of width
  const anchorX = containerWidth * 0.12;
  const column1X = containerWidth * 0.4;
  const column2X = containerWidth * 0.7;
  const centerY = containerHeight / 2;

  if (focusMode && selectedNodeId && nextCareerPaths.length > 0) {
    // FOCUS MODE: Selected node in column 1, next roles in column 2
    const selectedNode = roleNodes.find((n) => n.id === selectedNodeId);

    // Position selected node in column 1 (center)
    if (selectedNode) {
      positions.set(selectedNode.id, {
        x: column1X,
        y: centerY,
        column: 1,
        opacity: 1,
      });
    }

    // Position next career paths in column 2 (arc arrangement)
    const nextCount = nextCareerPaths.length;
    const maxSpread = Math.min(containerHeight * 0.7, nextCount * 100);
    const startY = centerY - maxSpread / 2;
    const spacing = nextCount > 1 ? maxSpread / (nextCount - 1) : 0;

    nextCareerPaths.forEach((node, i) => {
      // Create a gentle arc
      const normalizedPos = nextCount > 1 ? i / (nextCount - 1) : 0.5;
      const arcOffset = Math.sin(normalizedPos * Math.PI) * 40; // Slight arc curve

      positions.set(node.id, {
        x: column2X + arcOffset,
        y: nextCount === 1 ? centerY : startY + i * spacing,
        column: 2,
        opacity: 1,
      });
    });

    // Fade unrelated nodes (not selected and not in next paths)
    const nextPathIds = new Set(nextCareerPaths.map((n) => n.id));
    roleNodes.forEach((node) => {
      if (node.id !== selectedNodeId && !nextPathIds.has(node.id) && !positions.has(node.id)) {
        // Position faded nodes in a loose cluster in column 1 area
        const fadeIndex = roleNodes
          .filter((n) => n.id !== selectedNodeId && !nextPathIds.has(n.id))
          .indexOf(node);
        const fadeCount = roleNodes.filter(
          (n) => n.id !== selectedNodeId && !nextPathIds.has(n.id),
        ).length;

        const arcAngle = (fadeIndex / Math.max(fadeCount - 1, 1)) * Math.PI * 0.8 - Math.PI * 0.4;
        const fadeRadius = 180;

        positions.set(node.id, {
          x: column1X + Math.cos(arcAngle) * fadeRadius,
          y: centerY + Math.sin(arcAngle) * fadeRadius,
          column: 1,
          opacity: 0.25,
        });
      }
    });
  } else {
    // DEFAULT MODE: All recommended roles arranged in an arc to the right of anchor
    // Sort by fit score (higher scores closer to center/anchor)
    const sortedNodes = [...roleNodes].sort((a, b) => {
      const aScore = a.fit_score ?? 50;
      const bScore = b.fit_score ?? 50;
      return bScore - aScore;
    });

    // Calculate arc positions
    const nodeCount = sortedNodes.length;
    const maxArcAngle = Math.PI * 0.7; // 126 degrees total spread
    const startAngle = -maxArcAngle / 2; // Start above center

    // Distribute in arc with best fits closer to horizontal
    sortedNodes.forEach((node, i) => {
      const angle = startAngle + (i / Math.max(nodeCount - 1, 1)) * maxArcAngle;

      // Distance varies: top fit scores closer, lower scores further
      const baseRadius = 200;
      const radiusVariation = 80;
      const fitNormalized = (node.fit_score ?? 50) / 100;
      const radius = baseRadius + (1 - fitNormalized) * radiusVariation;

      // Arc radiates from anchor position
      const x = anchorX + ANCHOR_RADIUS + COLUMN_PADDING + Math.cos(angle) * radius + radius;
      const y = centerY + Math.sin(angle) * radius * 0.8; // Compress vertically

      positions.set(node.id, {
        x: Math.min(x, containerWidth - 100), // Keep within bounds
        y,
        column: 1,
        opacity: 1,
      });
    });
  }

  return positions;
}

// Get color based on fit score
function getDotColor(node: PathNodeType): string {
  if (node.type === 'target') return '#10B981';
  if (node.type === 'bridge') return '#F59E0B';
  if (node.fit_score !== undefined) {
    if (node.fit_score >= 80) return '#10B981';
    if (node.fit_score >= 60) return '#3B82F6';
    if (node.fit_score >= 40) return '#6366F1';
  }
  return '#6B7280';
}

// Get text position based on column
function getTimelineTextPosition(
  column: number,
  nodeCount: number,
): { textAnchor: 'start' | 'middle' | 'end'; dx: number; dy: number } {
  // In timeline layout, text always goes to the right of nodes
  return { textAnchor: 'start', dx: 14, dy: 5 };
}

// Truncate title to prevent overlap
function truncateTitle(title: string, maxLength: number = 22): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 2) + '...';
}

export function PathGalaxyView({
  graph,
  selectedNodeId,
  focusedNodeId,
  onNodeSelect,
  onNodeSave,
  onNodeFocus,
  onNodeHover,
  onPlaceInPlan,
  isLoading,
  maxNodes = 10,
  nextCareerPaths = [],
  anchorNode,
  focusMode = false,
  placedPlanSteps = [],
}: PathGalaxyViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [internalFocusedId, setInternalFocusedId] = useState<string | null>(null);
  const [announceMessage, setAnnounceMessage] = useState('');
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 });

  // Reduced motion support
  const prefersReducedMotion = useReducedMotion();
  const getTransition = (type: keyof typeof MOTION) =>
    prefersReducedMotion ? { duration: 0 } : MOTION[type];

  // Use external focus or internal focus
  const currentFocusedId = focusedNodeId ?? internalFocusedId;

  // Find the selected node from the original graph
  const selectedNode = selectedNodeId ? graph.nodes.find((n) => n.id === selectedNodeId) : null;

  // Update dimensions on mount, resize, and container size changes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width || 1200, height: rect.height || 700 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, []);

  // Anchor position (left side)
  const anchorX = dimensions.width * 0.12;
  const anchorY = dimensions.height / 2;

  // Filter primary nodes (exclude current type, limit to maxNodes)
  const primaryNodes = useMemo(() => {
    return graph.nodes.filter((node) => node.type !== 'current').slice(0, maxNodes);
  }, [graph.nodes, maxNodes]);

  // Determine which nodes to show
  const displayNodes = useMemo(() => {
    if (selectedNodeId && nextCareerPaths.length > 0) {
      // In focus mode, show selected node + next career paths
      const selected = primaryNodes.find((n) => n.id === selectedNodeId);
      return selected ? [selected, ...nextCareerPaths] : nextCareerPaths;
    }
    return primaryNodes;
  }, [selectedNodeId, nextCareerPaths, primaryNodes]);

  // Calculate positions using timeline layout
  const nodePositions = useMemo(() => {
    return calculateTimelinePositions(
      displayNodes,
      anchorNode || null,
      selectedNodeId || null,
      focusMode && selectedNodeId !== undefined,
      nextCareerPaths,
      dimensions.width,
      dimensions.height,
    );
  }, [displayNodes, anchorNode, selectedNodeId, focusMode, nextCareerPaths, dimensions]);

  // Sorted nodes for keyboard navigation (by x position, then y)
  const sortedNodes = useMemo(() => {
    return [...displayNodes]
      .filter((n) => n.type !== 'current')
      .sort((a, b) => {
        const posA = nodePositions.get(a.id);
        const posB = nodePositions.get(b.id);
        if (!posA || !posB) return 0;
        if (Math.abs(posA.x - posB.x) > 50) return posA.x - posB.x;
        return posA.y - posB.y;
      });
  }, [displayNodes, nodePositions]);

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0 && e.target === e.currentTarget) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (sortedNodes.length === 0) return;

      const currentIndex = currentFocusedId
        ? sortedNodes.findIndex((n) => n.id === currentFocusedId)
        : -1;

      let newIndex = currentIndex;
      let handled = false;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          newIndex = currentIndex < sortedNodes.length - 1 ? currentIndex + 1 : 0;
          handled = true;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          newIndex = currentIndex > 0 ? currentIndex - 1 : sortedNodes.length - 1;
          handled = true;
          break;
        case 'Enter':
        case ' ':
          if (currentFocusedId) {
            onNodeSelect?.(currentFocusedId);
            setAnnounceMessage(`Selected ${sortedNodes[currentIndex]?.title || 'node'}`);
          }
          handled = true;
          break;
        case 'Escape':
          setInternalFocusedId(null);
          onNodeFocus?.(null);
          setAnnounceMessage('Focus cleared');
          handled = true;
          break;
        case 's':
        case 'S':
          if (currentFocusedId && onNodeSave) {
            onNodeSave(currentFocusedId);
            const node = sortedNodes.find((n) => n.id === currentFocusedId);
            setAnnounceMessage(`${node?.is_saved ? 'Unsaved' : 'Saved'} ${node?.title || 'node'}`);
          }
          handled = true;
          break;
        case 'p':
        case 'P':
          // Place in plan shortcut
          if (currentFocusedId && onPlaceInPlan) {
            onPlaceInPlan(currentFocusedId);
            const node = sortedNodes.find((n) => n.id === currentFocusedId);
            setAnnounceMessage(`Added ${node?.title || 'role'} to plan`);
          }
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (newIndex !== currentIndex && newIndex >= 0) {
        const newNode = sortedNodes[newIndex];
        setInternalFocusedId(newNode.id);
        onNodeFocus?.(newNode.id);
        setAnnounceMessage(
          `${newNode.title}, ${newNode.fit_score ? `${newNode.fit_score}% fit` : ''}`,
        );
      }
    },
    [sortedNodes, currentFocusedId, onNodeSelect, onNodeSave, onNodeFocus, onPlaceInPlan],
  );

  if (isLoading) {
    return (
      <Card className="h-[700px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-neutral-500">Loading career paths...</p>
        </div>
      </Card>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <Card className="h-[700px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-neutral-500">No paths to display</p>
          <p className="text-sm text-neutral-400">
            Take the quiz or search for a role to get started
          </p>
        </div>
      </Card>
    );
  }

  // Check if we're in focus mode (showing next career paths)
  const isInFocusMode = focusMode && selectedNodeId && nextCareerPaths.length > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Live region for screen reader announcements */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announceMessage}
        </div>

        <div
          ref={containerRef}
          role="grid"
          aria-roledescription="Career path timeline"
          aria-label={`Career path timeline with ${displayNodes.length} roles. Use arrow keys to navigate, Enter to select, S to save, P to place in plan.`}
          tabIndex={0}
          className="relative h-[700px] overflow-hidden cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset bg-white"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onKeyDown={handleKeyDown}
        >
          <svg
            className="absolute inset-0 w-full h-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px)`,
            }}
          >
            {/* Definitions for gradients and filters */}
            <defs>
              <radialGradient id="anchorGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#5371FF" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#5371FF" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="selectedGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#5371FF" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#5371FF" stopOpacity="0" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="anchorGlowFilter">
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Connecting lines from anchor to nodes */}
            {displayNodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos || node.type === 'current') return null;

              const isHighlighted = currentFocusedId === node.id || node.id === selectedNodeId;
              const isSelected = node.id === selectedNodeId;

              return (
                <motion.line
                  key={`line-${node.id}`}
                  x1={anchorX}
                  y1={anchorY}
                  x2={pos.x}
                  y2={pos.y}
                  stroke={isHighlighted ? '#5371FF' : '#E2E8F0'}
                  strokeWidth={isSelected ? 2.5 : isHighlighted ? 2 : 1}
                  strokeDasharray={isInFocusMode && !isSelected ? 'none' : '6 4'}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: pos.opacity,
                  }}
                  transition={getTransition('pathDraw')}
                />
              );
            })}

            {/* Lines from selected node to next career paths in focus mode */}
            {isInFocusMode &&
              nextCareerPaths.map((node) => {
                const selectedPos = nodePositions.get(selectedNodeId!);
                const nextPos = nodePositions.get(node.id);
                if (!selectedPos || !nextPos) return null;

                const isHighlighted = currentFocusedId === node.id;

                return (
                  <motion.line
                    key={`next-line-${node.id}`}
                    x1={selectedPos.x}
                    y1={selectedPos.y}
                    x2={nextPos.x}
                    y2={nextPos.y}
                    stroke={isHighlighted ? '#5371FF' : '#94A3B8'}
                    strokeWidth={isHighlighted ? 2 : 1.5}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ ...getTransition('pathDraw'), delay: 0.2 }}
                  />
                );
              })}

            {/* Anchor Node - "You are here" */}
            <g aria-label="Your current position">
              {/* Pulsing ring */}
              <motion.circle
                cx={anchorX}
                cy={anchorY}
                r={ANCHOR_RADIUS + 8}
                fill="none"
                stroke="#5371FF"
                strokeWidth={2}
                strokeOpacity={0.3}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.1, 0.3],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Anchor glow */}
              <circle cx={anchorX} cy={anchorY} r={ANCHOR_RADIUS + 20} fill="url(#anchorGlow)" />

              {/* Anchor circle */}
              <motion.circle
                cx={anchorX}
                cy={anchorY}
                r={ANCHOR_RADIUS}
                fill="#5371FF"
                filter="url(#anchorGlowFilter)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={getTransition('nodeEnter')}
              />

              {/* Inner dot */}
              <circle cx={anchorX} cy={anchorY} r={4} fill="white" />

              {/* "You are here" label */}
              <text
                x={anchorX}
                y={anchorY + ANCHOR_RADIUS + 20}
                textAnchor="middle"
                className="select-none pointer-events-none"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  fill: '#5371FF',
                }}
              >
                You are here
              </text>

              {/* Anchor subtitle (if provided) */}
              {anchorNode?.subtitle && (
                <text
                  x={anchorX}
                  y={anchorY + ANCHOR_RADIUS + 34}
                  textAnchor="middle"
                  className="select-none pointer-events-none"
                  style={{
                    fontSize: '11px',
                    fill: '#64748B',
                  }}
                >
                  {anchorNode.subtitle}
                </text>
              )}
            </g>

            {/* Role nodes */}
            {displayNodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos || node.type === 'current') return null;

              const isFocused = currentFocusedId === node.id;
              const isSelected = node.id === selectedNodeId;
              const dotColor = getDotColor(node);
              const textPos = getTimelineTextPosition(pos.column, displayNodes.length);
              const nodeRadius = isSelected ? SELECTED_NODE_RADIUS : NODE_RADIUS;

              return (
                <motion.g
                  key={node.id}
                  className="cursor-pointer"
                  onClick={() => onNodeSelect?.(node.id)}
                  onMouseEnter={(e) => {
                    onNodeHover?.(node.id, { x: e.clientX, y: e.clientY });
                  }}
                  onMouseLeave={() => {
                    onNodeHover?.(null, null);
                  }}
                  style={{ pointerEvents: 'all' }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{
                    opacity: pos.opacity,
                    scale: 1,
                    x: pos.x,
                    y: pos.y,
                  }}
                  transition={getTransition('focus')}
                >
                  {/* Selected glow */}
                  {isSelected && (
                    <motion.circle
                      cx={0}
                      cy={0}
                      r={nodeRadius + 16}
                      fill="url(#selectedGlow)"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={getTransition('focus')}
                    />
                  )}

                  {/* Focus ring */}
                  {isFocused && !isSelected && (
                    <motion.circle
                      cx={0}
                      cy={0}
                      r={nodeRadius + 5}
                      fill="none"
                      stroke="#93C5FD"
                      strokeWidth={2}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}

                  {/* Colored dot */}
                  <motion.circle
                    cx={0}
                    cy={0}
                    r={nodeRadius}
                    fill={dotColor}
                    filter={isFocused || isSelected ? 'url(#glow)' : undefined}
                    animate={{ r: nodeRadius }}
                    transition={getTransition('focus')}
                  />

                  {/* Label text */}
                  <text
                    x={textPos.dx}
                    y={textPos.dy}
                    textAnchor={textPos.textAnchor}
                    className="select-none pointer-events-none"
                    style={{
                      fontSize: '13px',
                      fontWeight: isFocused || isSelected ? 600 : 400,
                      fill: isFocused || isSelected ? '#1E293B' : '#475569',
                      opacity: pos.opacity,
                    }}
                  >
                    {truncateTitle(node.title)}
                  </text>

                  {/* Fit score - shown for all nodes */}
                  {node.fit_score !== undefined && (
                    <text
                      x={textPos.dx}
                      y={textPos.dy + 14}
                      textAnchor={textPos.textAnchor}
                      className="select-none pointer-events-none"
                      style={{
                        fontSize: '11px',
                        fill: '#94A3B8',
                        opacity: pos.opacity,
                      }}
                    >
                      {node.fit_score}% fit
                    </text>
                  )}

                  {/* "Saved" indicator */}
                  {node.is_saved && (
                    <circle cx={nodeRadius + 2} cy={-nodeRadius - 2} r={4} fill="#10B981" />
                  )}
                </motion.g>
              );
            })}
          </svg>

          {/* Keyboard shortcuts hint */}
          <div className="absolute bottom-3 left-3 text-xs text-neutral-400 bg-white/80 px-2 py-1 rounded">
            <span className="font-medium">↑↓←→</span> Navigate
            <span className="mx-2">•</span>
            <span className="font-medium">Enter</span> Select
            <span className="mx-2">•</span>
            <span className="font-medium">P</span> Place in plan
            <span className="mx-2">•</span>
            <span className="font-medium">S</span> Save
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
