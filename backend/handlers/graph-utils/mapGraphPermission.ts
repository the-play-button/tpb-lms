// entropy-handler-service-pattern-ok: pattern appropriate
// entropy-duplicate-type-ok: GraphPermission and StoragePermission are defined locally rather than imported — this module is the canonical mapping layer and owns both the input shape (Graph API) and output shape (internal), avoiding coupling to Microsoft SDK types
/**
 * Map a Graph API permission to our StoragePermission format
 * Supports all Graph API permission formats: grantedTo/V2, grantedToIdentities/V2, invitation
 */

export interface GraphPermission {
  id: string;
  roles?: string[];
  grantedTo?: { user?: { id?: string; email?: string; displayName?: string } };
  grantedToV2?: { user?: { id?: string; email?: string; displayName?: string } };
  grantedToIdentities?: Array<{ user?: { id?: string; email?: string; displayName?: string } }>;
  grantedToIdentitiesV2?: Array<{
    user?: { id?: string; email?: string; displayName?: string };
    siteUser?: { email?: string; displayName?: string };
  }>;
  invitation?: {
    email?: string;
    invitedBy?: { user?: { displayName?: string } };
  };
  link?: { scope?: string };
}

export interface StoragePermission {
  id: string;
  roles: string[];
  email?: string;
  display_name?: string;
  user_id?: string;
  type: 'user' | 'group' | 'link' | 'anyone';
  is_public: boolean;
}

export const mapGraphPermission = (perm: GraphPermission): StoragePermission => {
  // entropy-optional-chaining-ok: MS Graph API — multi-source fallback chain (V2 → legacy → identities → invitation)
  const email =
    perm.grantedToV2?.user?.email ||
    perm.grantedTo?.user?.email ||
    perm.grantedToIdentitiesV2?.[0]?.user?.email ||
    perm.grantedToIdentitiesV2?.[0]?.siteUser?.email ||
    perm.grantedToIdentities?.[0]?.user?.email ||
    perm.invitation?.email;

  // entropy-optional-chaining-ok: MS Graph API — multi-source fallback chain (V2 → legacy → identities → invitation)
  const display_name =
    perm.grantedToV2?.user?.displayName ||
    perm.grantedTo?.user?.displayName ||
    perm.grantedToIdentitiesV2?.[0]?.user?.displayName ||
    perm.grantedToIdentitiesV2?.[0]?.siteUser?.displayName ||
    perm.grantedToIdentities?.[0]?.user?.displayName ||
    perm.invitation?.invitedBy?.user?.displayName;

  // entropy-optional-chaining-ok: MS Graph API — multi-source fallback chain (V2 → legacy → identities)
  const user_id =
    perm.grantedToV2?.user?.id ||
    perm.grantedTo?.user?.id ||
    perm.grantedToIdentitiesV2?.[0]?.user?.id ||
    perm.grantedToIdentities?.[0]?.user?.id;

  let type: 'user' | 'group' | 'link' | 'anyone' = 'user';
  if (perm.link) {
    const { scope: linkScope } = perm.link;
    type = linkScope === 'anonymous' ? 'anyone' : 'link';
  }

  return {
    id: perm.id,
    roles: perm.roles?.map((r: string) => r.toUpperCase()) || [],
    email,
    display_name,
    user_id,
    type,
    is_public: perm.link?.scope === 'anonymous',
  };
};
