/**
 * Infrastructure Provider Abstraction
 * 
 * Decouples vault-api business logic from infrastructure specifics.
 * Currently implements Cloudflare Access, but designed to be swappable.
 * 
 * OAuth-style model:
 * - Applications declare "audiences" (business identifiers)
 * - Provider resolves audiences to infrastructure resources
 * - Provider manages access policies and group membership
 */

import { getCfAccessController } from './cfAccess.js';

/**
 * Abstract Infrastructure Provider interface
 */
class InfraProvider {
  /**
   * Provision an audience for an application namespace
   * @param {string} audience - Business identifier (e.g., "lms-viewer")
   * @param {string} namespace - Application namespace (e.g., "tpblms")
   * @returns {Promise<{resourceId: string, resourceType: string}>}
   */
  async provisionAudience(audience, namespace) {
    throw new Error('Not implemented');
  }

  /**
   * Deprovision an audience (remove all associated resources)
   * @param {string} audience
   */
  async deprovisionAudience(audience) {
    throw new Error('Not implemented');
  }

  /**
   * Sync members for an audience (set exact membership)
   * @param {string} audience
   * @param {string[]} emails - Complete list of emails that should have access
   */
  async syncMembers(audience, emails) {
    throw new Error('Not implemented');
  }

  /**
   * Add a single member to an audience
   * @param {string} audience
   * @param {string} email
   */
  async addMember(audience, email) {
    throw new Error('Not implemented');
  }

  /**
   * Remove a single member from an audience
   * @param {string} audience
   * @param {string} email
   */
  async removeMember(audience, email) {
    throw new Error('Not implemented');
  }

  /**
   * List orphan resources (infra resources not tracked by vault)
   * @returns {Promise<Array<{type: string, id: string, name: string}>>}
   */
  async listOrphanResources() {
    throw new Error('Not implemented');
  }

  /**
   * Get current state of an audience's infrastructure
   * @param {string} audience
   * @returns {Promise<{exists: boolean, resourceId?: string, members?: string[]}>}
   */
  async getAudienceState(audience) {
    throw new Error('Not implemented');
  }
}

/**
 * Cloudflare Access Provider
 * 
 * Resolves audiences to CF Access apps, manages Access Groups for membership.
 * 
 * Strategy:
 * - One CF Access Group per namespace: "vault-{namespace}"
 * - Group is added as policy to each audience (CF Access app)
 * - Members are managed via the group
 */
export class CloudflareAccessProvider extends InfraProvider {
  constructor(env, db) {
    super();
    this.env = env;
    this.db = db;
    this.cf = getCfAccessController(env);
  }

  /**
   * Get or create the Access Group for a namespace
   * @private
   */
  async _getOrCreateNamespaceGroup(namespace) {
    const groupName = `vault-${namespace}`;
    
    // Check if we already have it in infra_state
    const existingState = await this.db.prepare(`
      SELECT provider_resource_id FROM sys_infra_state 
      WHERE namespace = ? AND provider_resource_type = 'access_group'
      LIMIT 1
    `).bind(namespace).first();
    
    if (existingState?.provider_resource_id) {
      return { groupId: existingState.provider_resource_id, groupName, created: false };
    }
    
    // Check if group exists in CF
    const groups = await this.cf.listAccessGroups();
    const existing = groups.find(g => g.name === groupName);
    
    if (existing) {
      return { groupId: existing.id, groupName, created: false };
    }
    
    // Create new group
    const newGroup = await this.cf.createAccessGroup(groupName, []);
    return { groupId: newGroup.id, groupName, created: true };
  }

  /**
   * Provision an audience - create group policy on CF Access app
   */
  async provisionAudience(audience, namespace) {
    // 1. Get or create the namespace's Access Group
    const { groupId, groupName, created: groupCreated } = await this._getOrCreateNamespaceGroup(namespace);
    
    // 2. Find CF Access app matching audience name
    const app = await this.cf.getAppByName(audience);
    if (!app) {
      throw new Error(`CF Access app "${audience}" not found. Create it first in CF dashboard.`);
    }
    
    // 3. Check if policy already exists
    const existingPolicy = await this.cf.findGroupPolicy(app.id, groupId);
    if (!existingPolicy) {
      // Add policy allowing the group
      await this.cf.addGroupPolicy(app.id, groupId, `vault-${namespace}`);
    }
    
    // 4. Update infra state
    await this.db.prepare(`
      INSERT INTO sys_infra_state (audience, namespace, provider, provider_resource_id, provider_resource_type, sync_status, last_sync_at, updated_at)
      VALUES (?, ?, 'cloudflare_access', ?, 'access_group', 'synced', datetime('now'), datetime('now'))
      ON CONFLICT(audience) DO UPDATE SET
        provider_resource_id = excluded.provider_resource_id,
        sync_status = 'synced',
        last_sync_at = datetime('now'),
        updated_at = datetime('now')
    `).bind(audience, namespace, groupId).run();
    
    return {
      resourceId: groupId,
      resourceType: 'access_group',
      groupCreated,
      appId: app.id
    };
  }

  /**
   * Deprovision an audience - remove policy from CF Access app
   * Note: Does NOT delete the group (other audiences may use it)
   */
  async deprovisionAudience(audience) {
    // Get state
    const state = await this.db.prepare(`
      SELECT namespace, provider_resource_id FROM sys_infra_state WHERE audience = ?
    `).bind(audience).first();
    
    if (!state) {
      return { found: false };
    }
    
    // Find and remove policy from the app
    const app = await this.cf.getAppByName(audience);
    if (app) {
      const policy = await this.cf.findGroupPolicy(app.id, state.provider_resource_id);
      if (policy) {
        await this.cf.removePolicy(app.id, policy.id);
      }
    }
    
    // Remove from infra state
    await this.db.prepare(`
      DELETE FROM sys_infra_state WHERE audience = ?
    `).bind(audience).run();
    
    // Check if any other audiences use this namespace's group
    const otherAudiences = await this.db.prepare(`
      SELECT COUNT(*) as count FROM sys_infra_state WHERE namespace = ?
    `).bind(state.namespace).first();
    
    // If no other audiences, delete the group
    if (otherAudiences.count === 0) {
      try {
        await this.cf.deleteAccessGroup(state.provider_resource_id);
      } catch (err) {
        console.warn('Failed to delete orphan group:', err.message);
      }
    }
    
    return { found: true, removed: true };
  }

  /**
   * Sync members - set exact membership for a namespace group
   */
  async syncMembers(audience, emails) {
    // Get the group ID for this audience's namespace
    const state = await this.db.prepare(`
      SELECT provider_resource_id, namespace FROM sys_infra_state WHERE audience = ?
    `).bind(audience).first();
    
    if (!state) {
      throw new Error(`Audience "${audience}" not provisioned. Call provisionAudience first.`);
    }
    
    // Build include array for CF Access Group
    const include = emails.map(email => ({ email: { email } }));
    
    // Update the group
    await this.cf.updateAccessGroup(state.provider_resource_id, include);
    
    // Update sync timestamp
    await this.db.prepare(`
      UPDATE sys_infra_state 
      SET sync_status = 'synced', last_sync_at = datetime('now'), updated_at = datetime('now')
      WHERE audience = ?
    `).bind(audience).run();
    
    return { synced: emails.length };
  }

  /**
   * Add a single member to the namespace group
   */
  async addMember(audience, email) {
    const state = await this.db.prepare(`
      SELECT provider_resource_id FROM sys_infra_state WHERE audience = ?
    `).bind(audience).first();
    
    if (!state) {
      throw new Error(`Audience "${audience}" not provisioned`);
    }
    
    await this.cf.addEmailToGroup(state.provider_resource_id, email);
    
    return { added: true };
  }

  /**
   * Remove a single member from the namespace group
   */
  async removeMember(audience, email) {
    const state = await this.db.prepare(`
      SELECT provider_resource_id FROM sys_infra_state WHERE audience = ?
    `).bind(audience).first();
    
    if (!state) {
      throw new Error(`Audience "${audience}" not provisioned`);
    }
    
    await this.cf.removeEmailFromGroup(state.provider_resource_id, email);
    
    return { removed: true };
  }

  /**
   * List orphan resources - CF Access Groups prefixed "vault-" not tracked in DB
   */
  async listOrphanResources() {
    const orphans = [];
    
    // Get all CF Access Groups
    const cfGroups = await this.cf.listAccessGroups();
    const vaultGroups = cfGroups.filter(g => g.name.startsWith('vault-'));
    
    // Get tracked group IDs from DB
    const { results: tracked } = await this.db.prepare(`
      SELECT DISTINCT provider_resource_id FROM sys_infra_state 
      WHERE provider = 'cloudflare_access' AND provider_resource_type = 'access_group'
    `).all();
    const trackedIds = new Set(tracked.map(r => r.provider_resource_id));
    
    // Find untracked
    for (const group of vaultGroups) {
      if (!trackedIds.has(group.id)) {
        orphans.push({
          type: 'access_group',
          id: group.id,
          name: group.name
        });
      }
    }
    
    return orphans;
  }

  /**
   * Get current state of an audience
   */
  async getAudienceState(audience) {
    const state = await this.db.prepare(`
      SELECT * FROM sys_infra_state WHERE audience = ?
    `).bind(audience).first();
    
    if (!state) {
      return { exists: false };
    }
    
    // Get current members from CF
    let members = [];
    try {
      const group = await this.cf.getAccessGroup(state.provider_resource_id);
      if (group?.include) {
        members = group.include
          .filter(inc => inc.email?.email)
          .map(inc => inc.email.email);
      }
    } catch (err) {
      console.warn('Failed to get group members:', err.message);
    }
    
    return {
      exists: true,
      resourceId: state.provider_resource_id,
      namespace: state.namespace,
      syncStatus: state.sync_status,
      lastSyncAt: state.last_sync_at,
      members
    };
  }
}

/**
 * Factory function - returns the appropriate provider based on env
 */
export function getInfraProvider(env) {
  // For now, only Cloudflare Access is supported
  // In future, could check env.INFRA_PROVIDER to switch
  return new CloudflareAccessProvider(env, env.DB);
}

