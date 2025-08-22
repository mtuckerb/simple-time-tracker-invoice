
export interface TimeEntry {
  name: string;
  startTime: string | null;
  endTime: string | null;
  subEntries?: TimeEntry[];
  duration?: number; // in hours
  level?: number; // for indentation
}

export class TimeTrackerParser {
  parse(jsonData: string): TimeEntry[] {
    try {
      const data = JSON.parse(jsonData);
      const entries = data.entries || [];
      return this.processEntries(entries, 0);
    } catch (error) {
      throw new Error('Invalid JSON data in time tracker block');
    }
  }

  private processEntries(entries: any[], level: number = 0): TimeEntry[] {
    const processedEntries: TimeEntry[] = [];

    for (const entry of entries) {
      const processedEntry: TimeEntry = {
        name: entry.name,
        startTime: entry.startTime,
        endTime: entry.endTime,
        level: level,
        duration: this.calculateDuration(entry.startTime, entry.endTime)
      };

      processedEntries.push(processedEntry);

      // Process sub-entries recursively
      if (entry.subEntries && entry.subEntries.length > 0) {
        const subEntries = this.processEntries(entry.subEntries, level + 1);
        processedEntries.push(...subEntries);
      }
    }

    return processedEntries;
  }

  private calculateDuration(startTime: string | null, endTime: string | null): number {
    if (!startTime || !endTime) return 0;

    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60); // Convert to hours
  }

  getTotalHours(entries: TimeEntry[]): number {
    return entries.reduce((total, entry) => total + (entry.duration || 0), 0);
  }
}
