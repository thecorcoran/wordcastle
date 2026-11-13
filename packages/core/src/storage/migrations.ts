export interface VersionedState {
  schemaVersion: number;
}

export type MigrationFn<T extends VersionedState = VersionedState> = (
  state: Record<string, unknown>,
) => T & Record<string, unknown>;

export function runMigrations<T extends VersionedState>(
  raw: Record<string, unknown>,
  migrations: Record<number, MigrationFn>,
  targetVersion: number,
): T {
  let current: Record<string, unknown> = { ...raw };
  let version = typeof current.schemaVersion === 'number' ? current.schemaVersion : 1;

  while (version < targetVersion) {
    const nextVersion = version + 1;
    const migrate = migrations[nextVersion];
    if (!migrate) {
      throw new Error(`Missing migration from schemaVersion ${version} to ${nextVersion}`);
    }
    current = migrate(current);
    current.schemaVersion = nextVersion;
    version = nextVersion;
  }

  return current as unknown as T;
}
