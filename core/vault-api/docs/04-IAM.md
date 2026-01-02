# IAM (Identity and Access Management)

## Overview

vault-api provides a complete IAM system:

- **Users**: Email-based identities
- **Groups**: Team/role grouping
- **Roles**: Permission bundles
- **Permissions**: Atomic actions on resources
- **Applications**: Registered TPB apps with namespaced scopes

## Users

### List Users

```http
GET /iam/users
```

### Create User

```http
POST /iam/users
```

```json
{
  "email": "john@example.com",
  "display_name": "John Doe",
  "status": "active"
}
```

### Get User Roles

```http
GET /iam/users/:identifier/roles
```

Returns roles assigned to user (via group membership):

```json
{
  "identifier": "john@example.com",
  "roles": [
    {"id": "role_tpblms_admin", "name": "tpblms_admin", "description": "LMS Admin"}
  ]
}
```

### Grant/Revoke CF Access

```http
POST /iam/users/:id/grant-access
POST /iam/users/:id/revoke-access
```

## Groups

Groups contain users and are assigned roles.

### Create Group

```http
POST /iam/groups
```

```json
{
  "name": "tpblms_admins",
  "description": "LMS Administrators"
}
```

### Add Member

```http
POST /iam/groups/:groupId/members
```

```json
{
  "user_id": "usr_xxx"
}
```

### Assign Role

```http
POST /iam/groups/:groupId/roles
```

```json
{
  "role_id": "role_tpblms_admin"
}
```

## Roles

### Create Role

```http
POST /iam/roles
```

```json
{
  "name": "tpblms_instructor",
  "description": "Can manage courses"
}
```

**Note**: Applications can only create roles prefixed with their namespace.

### Add Permission

```http
POST /iam/roles/:roleId/permissions
```

```json
{
  "permission_id": "perm_course_manage"
}
```

## Permissions

Atomic permissions follow `action:resource` pattern.

### List Permissions

```http
GET /iam/permissions
```

### Create Permission

```http
POST /iam/permissions
```

```json
{
  "action": "manage",
  "resource": "course",
  "description": "Manage courses"
}
```

## Applications

Register TPB applications to manage their own IAM.

### Register Application

```http
POST /iam/applications
```

```json
{
  "name": "tpblms",
  "display_name": "Learning Management System",
  "scopes": [
    "tpblms:role:*",
    "tpblms:group:*",
    "tpblms:user:*"
  ]
}
```

Response includes credentials:

```json
{
  "credentials": {
    "client_id": "xxx.access",
    "client_secret": "yyy"
  },
  "namespace": "tpblms"
}
```

### Namespace Isolation

Applications can only manage resources prefixed with their namespace:

- `tpblms_admin` role ✅
- `tpbcrm_admin` role ❌ (wrong namespace)

## Authorization Check

```http
POST /iam/can
```

```json
{
  "action": "read",
  "resource": "secret",
  "user_id": "usr_xxx"
}
```

Response:

```json
{
  "allowed": true,
  "reason": "manage:*"
}
```

## Model Diagram

```
User ──┬──▶ Group ──▶ Role ──▶ Permission
       │
       └──▶ Application (scopes)
```


