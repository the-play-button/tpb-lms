import type { VaultPort, BastionConfig } from './VaultPort.js';
import type { StorageConnectionsPort } from './StorageConnectionsPort.js';

export type BastionDependencies = VaultPort & StorageConnectionsPort;
