// Placeholder entity stub — Plan 04 + Plan 28 follow-up.
// Documents the canonical rich-aggregate pattern for this app.
// Replace with real domain entities + toSnapshot() projections.

export interface PlaceholderSnapshot {{
  id: string;
  createdAt: string;
}}

export class Placeholder {{
  private constructor(
    private readonly id: string,
    private readonly createdAt: Date,
  ) {{}}

  static create(id: string): Placeholder {{
    return new Placeholder(id, new Date());
  }}

  static reconstitute(snapshot: PlaceholderSnapshot): Placeholder {{
    return new Placeholder(snapshot.id, new Date(snapshot.createdAt));
  }}

  toSnapshot(): PlaceholderSnapshot {{
    return {{
      id: this.id,
      createdAt: this.createdAt.toISOString(),
    }};
  }}
}}
