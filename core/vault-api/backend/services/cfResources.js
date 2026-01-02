/**
 * Cloudflare Resources Service
 * 
 * Aggregates data from Cloudflare API (Access, Workers, Pages)
 * Filtered by organization's cf_account_id for multi-tenant support
 */

import { getCfAccessController } from './cfAccess.js';

export class CloudflareResourcesService {
  constructor(env) {
    this.env = env;
    this.accountId = env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = env.CLOUDFLARE_API_TOKEN;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}`;
    this.accessController = getCfAccessController(env);
  }

  async _request(method, endpoint, data = null) {
    const url = `${this.baseUrl}/${endpoint}`;
    
    const resp = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    const result = await resp.json();
    
    if (!result.success) {
      const msg = result.errors?.[0]?.message || `Cloudflare API error: ${endpoint}`;
      console.error('CF API error:', endpoint, result.errors);
      throw new Error(msg);
    }
    
    return result.result;
  }

  // =========================================
  // Access Applications (via existing service)
  // =========================================
  
  async listAccessApps() {
    try {
      const apps = await this.accessController.listApps();
      return apps.map(app => ({
        id: app.id,
        name: app.name,
        domain: app.domain,
        aud: app.aud,
        created_at: app.created_at,
        updated_at: app.updated_at
      }));
    } catch (err) {
      console.error('Failed to list Access apps:', err);
      return [];
    }
  }

  async getAccessAppDetails(appId) {
    try {
      const [app, policies] = await Promise.all([
        this.accessController.getAppById(appId),
        this.accessController.listPolicies(appId)
      ]);

      // Count policies by type
      let emailPolicies = 0;
      let tokenPolicies = 0;
      
      policies.forEach(policy => {
        policy.include?.forEach(include => {
          if (include.email) emailPolicies++;
          if (include.service_token) tokenPolicies++;
        });
      });

      return {
        app: {
          id: app.id,
          name: app.name,
          domain: app.domain,
          aud: app.aud,
          created_at: app.created_at
        },
        policies: policies.map(policy => ({
          id: policy.id,
          name: policy.name,
          decision: policy.decision,
          precedence: policy.precedence,
          includes: policy.include?.map(inc => {
            if (inc.email) return { type: 'email', email: inc.email.email };
            if (inc.service_token) return { type: 'service_token', token_id: inc.service_token.token_id };
            return { type: 'other', data: inc };
          }) || []
        })),
        stats: {
          total_policies: policies.length,
          email_policies: emailPolicies,
          token_policies: tokenPolicies
        }
      };
    } catch (err) {
      console.error(`Failed to get Access app details for ${appId}:`, err);
      throw err;
    }
  }

  // =========================================
  // Workers
  // =========================================
  
  async listWorkers() {
    try {
      const workers = await this._request('GET', 'workers/scripts');
      
      return workers.map(worker => ({
        id: worker.id,
        name: worker.id, // Worker ID is the name
        url: `https://${worker.id}.${this.accountId.substring(0, 8)}.workers.dev`,
        created_at: worker.created_on,
        modified_at: worker.modified_on,
        // Basic info only, details fetched separately
        bindings_count: 0, // Will be populated in getWorkerDetails
        routes_count: 0
      }));
    } catch (err) {
      console.error('Failed to list Workers:', err);
      return [];
    }
  }

  async getWorkerDetails(workerName) {
    try {
      const [script, bindings, routes] = await Promise.all([
        this._request('GET', `workers/scripts/${workerName}`).catch(() => null),
        this._request('GET', `workers/scripts/${workerName}/bindings`).catch(() => []),
        this._request('GET', `workers/scripts/${workerName}/routes`).catch(() => [])
      ]);

      // Process bindings to hide secret values
      const processedBindings = bindings.map(binding => {
        const processed = {
          name: binding.name,
          type: binding.type
        };

        switch (binding.type) {
          case 'd1_database':
            processed.database_id = binding.id;
            processed.database_name = binding.name;
            break;
          case 'kv_namespace':
            processed.namespace_id = binding.namespace_id;
            break;
          case 'r2_bucket':
            processed.bucket_name = binding.bucket_name;
            break;
          case 'queue':
            processed.queue_name = binding.queue_name;
            break;
          case 'secret_text':
            // Never expose secret values
            processed.name = binding.name;
            break;
          case 'plain_text':
            processed.text = binding.text;
            break;
          default:
            processed.data = binding;
        }

        return processed;
      });

      return {
        script: {
          id: script?.id || workerName,
          name: workerName,
          url: `https://${workerName}.${this.accountId.substring(0, 8)}.workers.dev`,
          created_at: script?.created_on,
          modified_at: script?.modified_on,
          size: script?.size,
          etag: script?.etag
        },
        bindings: processedBindings,
        routes: routes.map(route => ({
          id: route.id,
          pattern: route.pattern,
          zone_id: route.zone_id,
          zone_name: route.zone_name
        })),
        stats: {
          bindings_count: bindings.length,
          routes_count: routes.length,
          secrets_count: bindings.filter(b => b.type === 'secret_text').length,
          d1_count: bindings.filter(b => b.type === 'd1_database').length,
          kv_count: bindings.filter(b => b.type === 'kv_namespace').length
        }
      };
    } catch (err) {
      console.error(`Failed to get Worker details for ${workerName}:`, err);
      throw err;
    }
  }

  // =========================================
  // Pages
  // =========================================
  
  async listPagesProjects() {
    try {
      const projects = await this._request('GET', 'pages/projects');
      
      return projects.map(project => ({
        id: project.id,
        name: project.name,
        url: `https://${project.name}.pages.dev`,
        subdomain: project.subdomain,
        production_branch: project.production_branch,
        created_at: project.created_on,
        // Basic deployment info
        latest_deployment: project.latest_deployment ? {
          id: project.latest_deployment.id,
          status: project.latest_deployment.latest_stage?.status || 'unknown',
          created_at: project.latest_deployment.created_on,
          url: project.latest_deployment.url
        } : null
      }));
    } catch (err) {
      console.error('Failed to list Pages projects:', err);
      return [];
    }
  }

  async getPagesProjectDetails(projectName) {
    try {
      const [project, deployments] = await Promise.all([
        this._request('GET', `pages/projects/${projectName}`),
        this._request('GET', `pages/projects/${projectName}/deployments`).catch(() => [])
      ]);

      // Get recent deployments (last 10)
      const recentDeployments = deployments.slice(0, 10).map(deployment => ({
        id: deployment.id,
        status: deployment.latest_stage?.status || 'unknown',
        environment: deployment.environment,
        created_at: deployment.created_on,
        url: deployment.url,
        commit_hash: deployment.deployment_trigger?.metadata?.commit_hash,
        commit_message: deployment.deployment_trigger?.metadata?.commit_message,
        branch: deployment.deployment_trigger?.metadata?.branch
      }));

      // Count deployments by status
      const deploymentStats = deployments.reduce((acc, dep) => {
        const status = dep.latest_stage?.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      return {
        project: {
          id: project.id,
          name: project.name,
          url: `https://${project.name}.pages.dev`,
          subdomain: project.subdomain,
          production_branch: project.production_branch,
          created_at: project.created_on,
          build_config: project.build_config,
          source: project.source
        },
        deployments: recentDeployments,
        stats: {
          total_deployments: deployments.length,
          ...deploymentStats,
          success_rate: deployments.length > 0 
            ? Math.round(((deploymentStats.success || 0) / deployments.length) * 100)
            : 0
        }
      };
    } catch (err) {
      console.error(`Failed to get Pages project details for ${projectName}:`, err);
      throw err;
    }
  }

  // =========================================
  // Aggregated Data
  // =========================================
  
  async getResourcesSummary() {
    try {
      const [accessApps, workers, pagesProjects] = await Promise.all([
        this.listAccessApps(),
        this.listWorkers(),
        this.listPagesProjects()
      ]);

      // Calculate recent activity (deployments in last 24h)
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      let recentDeployments = 0;
      
      // Count recent Pages deployments
      for (const project of pagesProjects) {
        if (project.latest_deployment && 
            new Date(project.latest_deployment.created_at) > yesterday) {
          recentDeployments++;
        }
      }

      // Count recent Workers deployments (modified in last 24h)
      for (const worker of workers) {
        if (worker.modified_at && 
            new Date(worker.modified_at) > yesterday) {
          recentDeployments++;
        }
      }

      return {
        access_apps: accessApps.length,
        workers: workers.length,
        pages: pagesProjects.length,
        total_deployments_today: recentDeployments
      };
    } catch (err) {
      console.error('Failed to get resources summary:', err);
      return {
        access_apps: 0,
        workers: 0,
        pages: 0,
        total_deployments_today: 0
      };
    }
  }

  async getRecentActivity(limit = 10) {
    try {
      const activities = [];
      
      // Get recent Workers modifications
      const workers = await this.listWorkers();
      workers.forEach(worker => {
        if (worker.modified_at) {
          activities.push({
            type: 'worker',
            action: 'deploy',
            resource_name: worker.name,
            resource_url: worker.url,
            timestamp: worker.modified_at,
            details: `Worker ${worker.name} deployed`
          });
        }
      });

      // Get recent Pages deployments
      const pagesProjects = await this.listPagesProjects();
      pagesProjects.forEach(project => {
        if (project.latest_deployment) {
          activities.push({
            type: 'pages',
            action: 'deploy',
            resource_name: project.name,
            resource_url: project.url,
            timestamp: project.latest_deployment.created_at,
            details: `Pages project ${project.name} deployed`,
            status: project.latest_deployment.status
          });
        }
      });

      // Sort by timestamp (most recent first) and limit
      return activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (err) {
      console.error('Failed to get recent activity:', err);
      return [];
    }
  }

  // =========================================
  // Service Tokens (via cfAccess controller)
  // =========================================

  async listServiceTokens() {
    try {
      return await this.accessController.listServiceTokens();
    } catch (err) {
      console.error('Failed to list Service Tokens:', err);
      return [];
    }
  }

  // =========================================
  // Main aggregation method
  // =========================================
  
  async getAllResources() {
    try {
      const [accessApps, workers, pagesProjects, serviceTokens, summary] = await Promise.all([
        this.listAccessApps(),
        this.listWorkers(),
        this.listPagesProjects(),
        this.listServiceTokens(),
        this.getResourcesSummary()
      ]);

      return {
        summary,
        resources: {
          access: accessApps,
          workers,
          pages: pagesProjects,
          service_tokens: serviceTokens
        }
      };
    } catch (err) {
      console.error('Failed to get all resources:', err);
      throw err;
    }
  }
}

/**
 * Factory function to get service instance
 */
export function getCfResourcesService(env) {
  if (!env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID not configured');
  }
  if (!env.CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN not configured');
  }
  return new CloudflareResourcesService(env);
}
