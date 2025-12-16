import type { ApplicationStatus } from '@/components/applications/kanban/types';

interface KanbanMoveParams {
  applicationId: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
}

interface KanbanDropParams extends KanbanMoveParams {
  success: boolean;
  method: 'drag' | 'menu';
}

/**
 * Analytics event tracking for Kanban board interactions.
 * Tracks drag, drop, menu moves, and undo actions.
 */
export const KanbanAnalytics = {
  /**
   * Track when a card drag is initiated
   */
  trackCardDragged: (params: KanbanMoveParams) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'kanban_card_dragged', {
        application_id: params.applicationId,
        from_status: params.fromStatus,
        to_status: params.toStatus,
        timestamp: Date.now(),
      });
    }
    // Console log for development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] kanban_card_dragged', params);
    }
  },

  /**
   * Track when a card is dropped (successfully or cancelled)
   */
  trackCardDropped: (params: KanbanDropParams) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'kanban_card_dropped', {
        application_id: params.applicationId,
        from_status: params.fromStatus,
        to_status: params.toStatus,
        success: params.success,
        method: params.method,
        timestamp: Date.now(),
      });
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] kanban_card_dropped', params);
    }
  },

  /**
   * Track when the "Move to" menu is used instead of drag
   */
  trackMoveMenuUsed: (params: KanbanMoveParams) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'kanban_move_menu_used', {
        application_id: params.applicationId,
        from_status: params.fromStatus,
        to_status: params.toStatus,
        method: 'menu',
        timestamp: Date.now(),
      });
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] kanban_move_menu_used', params);
    }
  },

  /**
   * Track when a move is undone
   */
  trackMoveUndone: (params: KanbanMoveParams) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'kanban_move_undone', {
        application_id: params.applicationId,
        from_status: params.fromStatus,
        to_status: params.toStatus,
        timestamp: Date.now(),
      });
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] kanban_move_undone', params);
    }
  },
};
