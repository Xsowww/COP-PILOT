export type AppView = 'dashboard' | 'drive' | 'calendar' | 'notes';

// ── Drive ───────────────────────────────────────────────────────────────────
export type FileType = 'folder' | 'pdf' | 'image' | 'video' | 'doc' | 'other';

export interface DriveFile {
  id: string;
  name: string;
  type: FileType;
  size?: number;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  url?: string;
  linkedNoteIds?: string[];
  linkedEventIds?: string[];
}

// ── Calendar ────────────────────────────────────────────────────────────────
export type EventPriority = 'low' | 'medium' | 'high' | 'exam';

export const PRIORITY_COLORS: Record<EventPriority, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  exam: '#a855f7',
};

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;       // ISO date YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;
  priority: EventPriority;
  done: boolean;
  linkedFileIds?: string[];
  linkedNoteIds?: string[];
}

// ── Notes ───────────────────────────────────────────────────────────────────
export interface Note {
  id: string;
  title: string;
  content: string; // HTML from tiptap
  createdAt: string;
  updatedAt: string;
  linkedFileIds?: string[];
  linkedEventIds?: string[];
}

// ── COP Chat ─────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'cop' | 'user';
  text: string;
  timestamp: Date;
}

// ── COP Bot ─────────────────────────────────────────────────────────────────
export interface CopSuggestion {
  id: string;
  message: string;
  actions: CopAction[];
  relatedEntityId?: string;
  relatedEntityType?: 'file' | 'event' | 'note';
}

export interface CopAction {
  label: string;
  handler: () => void;
}

// ── Search ───────────────────────────────────────────────────────────────────
export interface SearchResult {
  id: string;
  type: 'file' | 'event' | 'note';
  title: string;
  subtitle?: string;
  icon: string;
}
