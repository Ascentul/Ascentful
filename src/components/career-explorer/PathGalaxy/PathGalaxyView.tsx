'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import type { PathGraph, PathNode as PathNodeType } from '@/lib/career-explorer/types';

import { PathControls } from './PathControls';
import { EdgeMarkers, PathEdge } from './PathEdge';
import { PathNode } from './PathNode';

interface PathGalaxyViewProps {
  graph: PathGraph;
  selectedNodeId?: string;
  onNodeSelect?: (nodeId: string) => void;
  onNodeSave?: (nodeId: string) => void;
  isLoading?: boolean;
}

const BRIDGE_NODE_WIDTH = 160;
const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;
const HORIZONTAL_GAP = 100;
const VERTICAL_GAP = 80;

const getNodeWidth = (nodeId: string, nodes: PathNodeType[]) => {
  const node = nodes.find((n) => n.id === nodeId);
  return node?.type === 'bridge' ? BRIDGE_NODE_WIDTH : NODE_WIDTH;
};

function calculateNodePositions(nodes: PathNodeType[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Group nodes by type for layered layout
  const currentNodes = nodes.filter((n) => n.type === 'current');
  const roleNodes = nodes.filter((n) => n.type === 'role');
  const targetNodes = nodes.filter((n) => n.type === 'target');
  const bridgeNodes = nodes.filter((n) => n.type === 'bridge');

  // Simple horizontal layout: current -> roles -> target
  let currentX = 60;
  const centerY = 300;

  // Position current nodes
  currentNodes.forEach((node, idx) => {
    positions.set(node.id, { x: currentX, y: centerY + idx * (NODE_HEIGHT + 20) });
  });
  currentX += NODE_WIDTH + HORIZONTAL_GAP;

  // Position role nodes in columns
  const rolesPerColumn = 3;
  roleNodes.forEach((node, idx) => {
    const col = Math.floor(idx / rolesPerColumn);
    const row = idx % rolesPerColumn;
    const y =
      centerY -
      ((rolesPerColumn - 1) / 2) * (NODE_HEIGHT + VERTICAL_GAP) +
      row * (NODE_HEIGHT + VERTICAL_GAP);
    positions.set(node.id, {
      x: currentX + col * (NODE_WIDTH + HORIZONTAL_GAP * 0.5),
      y,
    });
  });

  // Position bridge nodes (smaller, between roles)
  bridgeNodes.forEach((node, idx) => {
    positions.set(node.id, {
      x: currentX + (NODE_WIDTH + HORIZONTAL_GAP * 0.5) * 0.5,
      y: centerY + 180 + idx * 60,
    });
  });

  const roleColumns = Math.ceil(roleNodes.length / rolesPerColumn);
  currentX += (roleColumns + 0.5) * (NODE_WIDTH + HORIZONTAL_GAP * 0.5);

  // Position target nodes
  targetNodes.forEach((node, idx) => {
    positions.set(node.id, { x: currentX, y: centerY + idx * (NODE_HEIGHT + 20) });
  });

  return positions;
}

export function PathGalaxyView({
  graph,
  selectedNodeId,
  onNodeSelect,
  onNodeSave,
  isLoading,
}: PathGalaxyViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [filterMode, setFilterMode] = useState<'all' | 'main_path' | 'saved'>('all');
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'radial'>('horizontal');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Calculate node positions
  const nodePositions = calculateNodePositions(graph.nodes);

  // Filter nodes based on mode
  const filteredNodes = graph.nodes.filter((node) => {
    if (filterMode === 'all') return true;
    if (filterMode === 'main_path')
      return node.is_main_path || node.type === 'current' || node.type === 'target';
    if (filterMode === 'saved') return node.is_saved || node.type === 'current';
    return true;
  });

  const filteredEdges = graph.edges.filter((edge) => {
    const sourceVisible = filteredNodes.some((n) => n.id === edge.source);
    const targetVisible = filteredNodes.some((n) => n.id === edge.target);
    return sourceVisible && targetVisible;
  });

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
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

  // Reset and fit view
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitView = () => {
    if (!containerRef.current) return;
    if (nodePositions.size === 0) return;
    const { width, height } = containerRef.current.getBoundingClientRect();

    // Find bounding box of all nodes
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    nodePositions.forEach(({ x, y }) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + NODE_WIDTH);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + NODE_HEIGHT);
    });

    const graphWidth = maxX - minX + 100;
    const graphHeight = maxY - minY + 100;

    const scaleX = width / graphWidth;
    const scaleY = height / graphHeight;
    const newZoom = Math.min(scaleX, scaleY, 1.5);

    setZoom(newZoom);
    setPan({
      x: (width - graphWidth * newZoom) / 2 - minX * newZoom + 50,
      y: (height - graphHeight * newZoom) / 2 - minY * newZoom + 50,
    });
  };

  // Fit view on initial load
  useEffect(() => {
    if (graph.nodes.length > 0) {
      handleFitView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.nodes.length]);

  if (isLoading) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-neutral-500">Loading career paths...</p>
        </div>
      </Card>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-neutral-500">No paths to display</p>
          <p className="text-sm text-neutral-400">
            Take the quiz or search for a role to get started
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PathControls
        zoom={zoom}
        onZoomChange={setZoom}
        onResetView={handleResetView}
        onFitView={handleFitView}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
        layoutMode={layoutMode}
        onLayoutChange={setLayoutMode}
      />

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative h-[600px] overflow-hidden cursor-grab active:cursor-grabbing bg-neutral-50"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Grid Background */}
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Transformable container */}
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {/* Edges (SVG) */}
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: '3000px', height: '2000px' }}
              >
                <EdgeMarkers />
                {filteredEdges.map((edge) => {
                  const sourcePos = nodePositions.get(edge.source);
                  const targetPos = nodePositions.get(edge.target);
                  if (!sourcePos || !targetPos) return null;

                  const sourceWidth = getNodeWidth(edge.source, graph.nodes);
                  const targetWidth = getNodeWidth(edge.target, graph.nodes);

                  return (
                    <PathEdge
                      key={edge.id}
                      sourceX={sourcePos.x + sourceWidth / 2}
                      sourceY={sourcePos.y + NODE_HEIGHT / 2}
                      targetX={targetPos.x + targetWidth / 2}
                      targetY={targetPos.y + NODE_HEIGHT / 2}
                      label={edge.label}
                      isMainPath={edge.is_main_path}
                      isHighlighted={
                        edge.source === selectedNodeId || edge.target === selectedNodeId
                      }
                    />
                  );
                })}
              </svg>

              {/* Nodes */}
              {filteredNodes.map((node) => {
                const pos = nodePositions.get(node.id);
                if (!pos) return null;

                return (
                  <div
                    key={node.id}
                    className="absolute"
                    style={{
                      left: pos.x,
                      top: pos.y,
                    }}
                  >
                    <PathNode
                      node={node}
                      isSelected={selectedNodeId === node.id}
                      onClick={() => onNodeSelect?.(node.id)}
                      onSave={onNodeSave ? () => onNodeSave(node.id) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
