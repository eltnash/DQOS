import { Injectable, signal } from '@angular/core';

const ACCOUNT_RAIL_KEY = 'dqos.shell.accountRailCollapsed';
const SECTION_SIDEBAR_KEY = 'dqos.shell.sectionSidebarCollapsed';

@Injectable({ providedIn: 'root' })
export class ShellLayoutService {
  readonly accountRailCollapsed = signal(this.readBool(ACCOUNT_RAIL_KEY));
  readonly sectionSidebarCollapsed = signal(this.readBool(SECTION_SIDEBAR_KEY));

  toggleAccountRail(): void {
    this.accountRailCollapsed.update((v) => {
      const next = !v;
      this.writeBool(ACCOUNT_RAIL_KEY, next);
      return next;
    });
  }

  toggleSectionSidebar(): void {
    this.sectionSidebarCollapsed.update((v) => {
      const next = !v;
      this.writeBool(SECTION_SIDEBAR_KEY, next);
      return next;
    });
  }

  collapseAll(): void {
    this.accountRailCollapsed.set(true);
    this.sectionSidebarCollapsed.set(true);
    this.writeBool(ACCOUNT_RAIL_KEY, true);
    this.writeBool(SECTION_SIDEBAR_KEY, true);
  }

  expandAll(): void {
    this.accountRailCollapsed.set(false);
    this.sectionSidebarCollapsed.set(false);
    this.writeBool(ACCOUNT_RAIL_KEY, false);
    this.writeBool(SECTION_SIDEBAR_KEY, false);
  }

  private readBool(key: string): boolean {
    try {
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  }

  private writeBool(key: string, value: boolean): void {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* ignore */
    }
  }
}
