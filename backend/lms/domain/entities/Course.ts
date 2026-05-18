// Real Course aggregate — replaces Placeholder.ts (Plan 04b).
// Doctrine : pipelined-ddd § 2.5 rich domain entities with toSnapshot().

export interface CourseSnapshot {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  createdAt: string;
}

export class Course {
  private constructor(
    private readonly id: string,
    private readonly title: string,
    private readonly description: string,
    private readonly enabled: boolean,
    private readonly createdAt: Date,
  ) {}

  static reconstitute(snap: CourseSnapshot): Course {
    return new Course(
      snap.id,
      snap.title,
      snap.description,
      snap.enabled,
      snap.createdAt ? new Date(snap.createdAt) : new Date(),
    );
  }

  toSnapshot(): CourseSnapshot {
    return {
    id: this.id,
    title: this.title,
    description: this.description,
    enabled: this.enabled,
    createdAt: this.createdAt.toISOString(),
    };
  }
}
