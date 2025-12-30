/**
 * Manual Selector
 *
 * Allows users to manually select job fields on a page
 * when automatic scraping fails or is incomplete.
 */

import type { ScrapedJobData } from '~/types';

export interface SelectedField {
  fieldName: keyof ScrapedJobData;
  selector: string;
  value: string;
}

export interface ManualSelectorState {
  isActive: boolean;
  currentField: keyof ScrapedJobData | null;
  selections: SelectedField[];
  highlightedElement: HTMLElement | null;
}

type FieldName = keyof Pick<ScrapedJobData, 'company' | 'jobTitle' | 'location' | 'salary'>;

const FIELD_LABELS: Record<FieldName, string> = {
  company: 'Company Name',
  jobTitle: 'Job Title',
  location: 'Location',
  salary: 'Salary',
};

const FIELD_ORDER: FieldName[] = ['company', 'jobTitle', 'location', 'salary'];

/**
 * Manual field selector for user-assisted scraping
 */
export class ManualSelector {
  private state: ManualSelectorState = {
    isActive: false,
    currentField: null,
    selections: [],
    highlightedElement: null,
  };

  private overlay: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private boundMouseOver: (e: MouseEvent) => void;
  private boundClick: (e: MouseEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private onComplete: ((data: Partial<ScrapedJobData>) => void) | null = null;
  private onCancel: (() => void) | null = null;

  constructor() {
    this.boundMouseOver = this.handleMouseOver.bind(this);
    this.boundClick = this.handleClick.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Start manual selection mode
   */
  start(
    onComplete: (data: Partial<ScrapedJobData>) => void,
    onCancel: () => void
  ): void {
    if (this.state.isActive) return;

    this.state = {
      isActive: true,
      currentField: FIELD_ORDER[0],
      selections: [],
      highlightedElement: null,
    };

    this.onComplete = onComplete;
    this.onCancel = onCancel;

    // Create overlay
    this.createOverlay();

    // Add event listeners
    document.addEventListener('mouseover', this.boundMouseOver, true);
    document.addEventListener('click', this.boundClick, true);
    document.addEventListener('keydown', this.boundKeyDown, true);

    // Show instructions
    this.showTooltip();
  }

  /**
   * Stop manual selection mode
   */
  stop(): void {
    if (!this.state.isActive) return;

    this.state.isActive = false;

    // Remove event listeners
    document.removeEventListener('mouseover', this.boundMouseOver, true);
    document.removeEventListener('click', this.boundClick, true);
    document.removeEventListener('keydown', this.boundKeyDown, true);

    // Remove overlay and tooltip
    this.removeOverlay();
    this.removeTooltip();

    // Clear highlight
    if (this.state.highlightedElement) {
      this.state.highlightedElement.style.outline = '';
    }
  }

  /**
   * Handle mouse over for highlighting
   */
  private handleMouseOver(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Ignore our own elements
    if (target.closest('#ascentul-manual-selector')) return;

    // Clear previous highlight
    if (this.state.highlightedElement) {
      this.state.highlightedElement.style.outline = '';
    }

    // Highlight new element
    target.style.outline = '2px solid #5371FF';
    target.style.outlineOffset = '2px';
    this.state.highlightedElement = target;
  }

  /**
   * Handle click for selection
   */
  private handleClick(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;

    // Ignore our own elements
    if (target.closest('#ascentul-manual-selector')) return;

    if (!this.state.currentField) return;

    const value = target.textContent?.trim() || '';
    if (!value) return;

    // Generate a selector for this element
    const selector = this.generateSelector(target);

    // Store selection
    this.state.selections.push({
      fieldName: this.state.currentField,
      selector,
      value,
    });

    // Move to next field
    const currentIndex = FIELD_ORDER.indexOf(this.state.currentField as FieldName);
    if (currentIndex < FIELD_ORDER.length - 1) {
      this.state.currentField = FIELD_ORDER[currentIndex + 1];
      this.showTooltip();
    } else {
      // All fields collected
      this.complete();
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel();
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Skip current field
      e.preventDefault();
      const currentIndex = FIELD_ORDER.indexOf(this.state.currentField as FieldName);
      if (currentIndex < FIELD_ORDER.length - 1) {
        this.state.currentField = FIELD_ORDER[currentIndex + 1];
        this.showTooltip();
      } else {
        this.complete();
      }
    }
  }

  /**
   * Complete selection and return data
   */
  private complete(): void {
    const data: Partial<ScrapedJobData> = {
      url: window.location.href,
      source: 'manual',
      confidence: 0.95,
    };

    for (const selection of this.state.selections) {
      (data as Record<string, unknown>)[selection.fieldName] = selection.value;
    }

    this.stop();
    this.onComplete?.(data);
  }

  /**
   * Cancel selection
   */
  private cancel(): void {
    this.stop();
    this.onCancel?.();
  }

  /**
   * Create overlay element
   */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'ascentul-manual-selector';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.1);
      z-index: 999998;
      pointer-events: none;
    `;
    document.body.appendChild(this.overlay);
  }

  /**
   * Remove overlay
   */
  private removeOverlay(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  /**
   * Show instruction tooltip
   */
  private showTooltip(): void {
    this.removeTooltip();

    const fieldLabel = FIELD_LABELS[this.state.currentField as FieldName] || 'Field';
    const currentIndex = FIELD_ORDER.indexOf(this.state.currentField as FieldName);
    const progress = `${currentIndex + 1}/${FIELD_ORDER.length}`;

    this.tooltip = document.createElement('div');
    this.tooltip.id = 'ascentul-manual-selector-tooltip';
    this.tooltip.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #5371FF;
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    this.tooltip.innerHTML = `
      <span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 6px; font-size: 12px;">
        ${progress}
      </span>
      <span>Click on the <strong>${fieldLabel}</strong></span>
      <span style="opacity: 0.7; font-size: 12px;">Shift+Enter to skip • Esc to cancel</span>
    `;

    document.body.appendChild(this.tooltip);
  }

  /**
   * Remove tooltip
   */
  private removeTooltip(): void {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  /**
   * Generate a CSS selector for an element
   */
  private generateSelector(element: HTMLElement): string {
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }

    // Try unique class combination
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(/\s+/).filter((c) => c.length > 0);
      if (classes.length > 0) {
        const selector = `.${classes.join('.')}`;
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }
    }

    // Build path-based selector
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }

      // Add class if it helps narrow down
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.split(/\s+/).filter((c) => c.length > 0);
        if (classes.length > 0) {
          selector += `.${classes.slice(0, 2).join('.')}`;
        }
      }

      // Add nth-child if needed
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (el) => el.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }
}

export default ManualSelector;
