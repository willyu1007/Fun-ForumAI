import { describe, it, expect } from 'vitest'
import request from 'supertest'
import {
  app,
  config,
  servicePost,
  adminToken,
  userToken,
  setupFeatureFlagGuard,
  createTestCommunity,
} from './e2e-helpers.js'
import { DEFAULT_STAGE_SPEC_V1 } from '../../stage/index.js'

setupFeatureFlagGuard()

describe('E2E: Role Assignment Control Plane', () => {
  it('Role assignment control-plane endpoints create and update assignments', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalRoleAssignment = featureFlags.roleAssignmentV1
    const originalMemberships = featureFlags.membershipsV1
    featureFlags.roleAssignmentV1 = true
    featureFlags.membershipsV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Role Assignment Community',
        slug: `role-assignment-${Date.now()}`,
      })
      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Role Agent' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(membershipRes.status).toBe(200)

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agentId,
        run_id: `run-role-${Date.now()}`,
        community_id: community.id,
        title: 'Role assignment post',
        body: 'role assignment content',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const createRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'POST',
          scope_id: postId,
          role: 'core',
          agent_id: agentId,
        })
      expect(createRes.status).toBe(201)
      const assignmentId = createRes.body.data.id as string

      const patchRes = await request(app)
        .patch(`/v1/communities/${community.id}/role-assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'REVOKED',
          reason: 'rotation end',
        })
      expect(patchRes.status).toBe(200)
      expect(patchRes.body.data.status).toBe('REVOKED')
    } finally {
      featureFlags.roleAssignmentV1 = originalRoleAssignment
      featureFlags.membershipsV1 = originalMemberships
    }
  })

  it('Role assignment rejects role keys that are not defined in stage_spec', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalRoleAssignment = featureFlags.roleAssignmentV1
    const originalMemberships = featureFlags.membershipsV1
    featureFlags.roleAssignmentV1 = true
    featureFlags.membershipsV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Role Assignment Stage Role Guard',
        slug: `role-assignment-stage-role-${Date.now()}`,
        rules_json: {
          stage_spec_v1: DEFAULT_STAGE_SPEC_V1,
        },
      })
      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Role Agent Stage Role Guard' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(membershipRes.status).toBe(200)

      const invalidCreateRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'COMMUNITY',
          scope_id: community.id,
          role: 'aside-seat',
          agent_id: agentId,
        })
      expect(invalidCreateRes.status).toBe(400)
      expect(invalidCreateRes.body.error.code).toBe('VALIDATION_ERROR')

      const validCreateRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'COMMUNITY',
          scope_id: community.id,
          role: 'core',
          agent_id: agentId,
        })
      expect(validCreateRes.status).toBe(201)
      const assignmentId = validCreateRes.body.data.id as string

      const invalidPatchRes = await request(app)
        .patch(`/v1/communities/${community.id}/role-assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'aside-seat',
          reason: 'invalid role should be rejected',
        })
      expect(invalidPatchRes.status).toBe(400)
      expect(invalidPatchRes.body.error.code).toBe('VALIDATION_ERROR')
    } finally {
      featureFlags.roleAssignmentV1 = originalRoleAssignment
      featureFlags.membershipsV1 = originalMemberships
    }
  })

  it('Role assignment control-plane endpoints reject non-admin caller with 403', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalRoleAssignment = featureFlags.roleAssignmentV1
    const originalMemberships = featureFlags.membershipsV1
    featureFlags.roleAssignmentV1 = true
    featureFlags.membershipsV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Role Assignment Permission Guard',
        slug: `role-assignment-perm-${Date.now()}`,
      })
      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Role Agent Permission Guard' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(membershipRes.status).toBe(200)

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agentId,
        run_id: `run-role-perm-${Date.now()}`,
        community_id: community.id,
        title: 'Role assignment permission target',
        body: 'role assignment permission content',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const forbiddenCreateRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          scope: 'POST',
          scope_id: postId,
          role: 'core',
          agent_id: agentId,
        })
      expect(forbiddenCreateRes.status).toBe(403)

      const createRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'POST',
          scope_id: postId,
          role: 'core',
          agent_id: agentId,
        })
      expect(createRes.status).toBe(201)
      const assignmentId = createRes.body.data.id as string

      const forbiddenPatchRes = await request(app)
        .patch(`/v1/communities/${community.id}/role-assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'REVOKED', reason: 'non-admin should fail' })
      expect(forbiddenPatchRes.status).toBe(403)
    } finally {
      featureFlags.roleAssignmentV1 = originalRoleAssignment
      featureFlags.membershipsV1 = originalMemberships
    }
  })

  it('Role assignment patch returns 404 when assignment does not belong to path community', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalRoleAssignment = featureFlags.roleAssignmentV1
    const originalMemberships = featureFlags.membershipsV1
    featureFlags.roleAssignmentV1 = true
    featureFlags.membershipsV1 = true

    try {
      const communityA = await createTestCommunity({
        name: 'Role Assignment A',
        slug: `role-assignment-a-${Date.now()}`,
      })
      const communityB = await createTestCommunity({
        name: 'Role Assignment B',
        slug: `role-assignment-b-${Date.now()}`,
      })
      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Role Agent Cross Community' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [communityA.id], remove: [] })
      expect(membershipRes.status).toBe(200)

      const postRes = await servicePost('/v1/posts', {
        actor_agent_id: agentId,
        run_id: `run-role-cross-${Date.now()}`,
        community_id: communityA.id,
        title: 'Role assignment post cross community',
        body: 'role assignment content cross community',
      })
      expect(postRes.status).toBe(201)
      const postId = postRes.body.data.id as string

      const createRes = await request(app)
        .post(`/v1/communities/${communityA.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'POST',
          scope_id: postId,
          role: 'core',
          agent_id: agentId,
        })
      expect(createRes.status).toBe(201)
      const assignmentId = createRes.body.data.id as string

      const patchRes = await request(app)
        .patch(`/v1/communities/${communityB.id}/role-assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'REVOKED',
          reason: 'cross community should fail',
        })
      expect(patchRes.status).toBe(404)
      expect(patchRes.body.error.code).toBe('NOT_FOUND')
    } finally {
      featureFlags.roleAssignmentV1 = originalRoleAssignment
      featureFlags.membershipsV1 = originalMemberships
    }
  })

  it('Role assignment creation rejects COMMUNITY scope with mismatched scope_id', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalRoleAssignment = featureFlags.roleAssignmentV1
    const originalMemberships = featureFlags.membershipsV1
    featureFlags.roleAssignmentV1 = true
    featureFlags.membershipsV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Role Assignment Scope Validation',
        slug: `role-assignment-scope-${Date.now()}`,
      })
      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Role Agent Scope Validation' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(membershipRes.status).toBe(200)

      const createRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'COMMUNITY',
          scope_id: `mismatched-${community.id}`,
          role: 'core',
          agent_id: agentId,
        })
      expect(createRes.status).toBe(400)
      expect(createRes.body.error.code).toBe('VALIDATION_ERROR')
    } finally {
      featureFlags.roleAssignmentV1 = originalRoleAssignment
      featureFlags.membershipsV1 = originalMemberships
    }
  })

  it('Role assignment creation rejects MUTED membership with 409', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalRoleAssignment = featureFlags.roleAssignmentV1
    const originalMemberships = featureFlags.membershipsV1
    const originalMembershipStatus = featureFlags.membershipStatusV1
    featureFlags.roleAssignmentV1 = true
    featureFlags.membershipsV1 = true
    featureFlags.membershipStatusV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Role Assignment Membership Muted',
        slug: `role-assignment-muted-${Date.now()}`,
      })
      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Role Agent Membership Muted' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(membershipRes.status).toBe(200)

      const mutedRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships/${community.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'MUTED', reason: 'cooldown' })
      expect(mutedRes.status).toBe(200)

      const createRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'COMMUNITY',
          scope_id: community.id,
          role: 'core',
          agent_id: agentId,
        })
      expect(createRes.status).toBe(409)
      expect(createRes.body.error.code).toBe('CONFLICT')
      expect(String(createRes.body.error.message)).toContain('MUTED')
    } finally {
      featureFlags.roleAssignmentV1 = originalRoleAssignment
      featureFlags.membershipsV1 = originalMemberships
      featureFlags.membershipStatusV1 = originalMembershipStatus
    }
  })

  it('Role assignment creation rejects LEFT membership with 409', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalRoleAssignment = featureFlags.roleAssignmentV1
    const originalMemberships = featureFlags.membershipsV1
    featureFlags.roleAssignmentV1 = true
    featureFlags.membershipsV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Role Assignment Membership Left',
        slug: `role-assignment-left-${Date.now()}`,
      })
      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Role Agent Membership Left' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(membershipRes.status).toBe(200)

      const leaveRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [], remove: [community.id] })
      expect(leaveRes.status).toBe(200)

      const createRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'COMMUNITY',
          scope_id: community.id,
          role: 'core',
          agent_id: agentId,
        })
      expect(createRes.status).toBe(409)
      expect(createRes.body.error.code).toBe('CONFLICT')
      expect(String(createRes.body.error.message)).toContain('ACTIVE membership')
    } finally {
      featureFlags.roleAssignmentV1 = originalRoleAssignment
      featureFlags.membershipsV1 = originalMemberships
    }
  })

  it('Role assignment creation rejects missing membership with 409', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalRoleAssignment = featureFlags.roleAssignmentV1
    const originalMemberships = featureFlags.membershipsV1
    featureFlags.roleAssignmentV1 = true
    featureFlags.membershipsV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Role Assignment Membership Missing',
        slug: `role-assignment-missing-${Date.now()}`,
      })
      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Role Agent Membership Missing' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const createRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'COMMUNITY',
          scope_id: community.id,
          role: 'core',
          agent_id: agentId,
        })
      expect(createRes.status).toBe(409)
      expect(createRes.body.error.code).toBe('CONFLICT')
      expect(String(createRes.body.error.message)).toContain('ACTIVE membership')
    } finally {
      featureFlags.roleAssignmentV1 = originalRoleAssignment
      featureFlags.membershipsV1 = originalMemberships
    }
  })

  it('Role assignment creation rejects BANNED membership with 409', async () => {
    const featureFlags = config.launch.capabilities as unknown as Record<string, boolean>
    const originalRoleAssignment = featureFlags.roleAssignmentV1
    const originalMemberships = featureFlags.membershipsV1
    const originalMembershipStatus = featureFlags.membershipStatusV1
    featureFlags.roleAssignmentV1 = true
    featureFlags.membershipsV1 = true
    featureFlags.membershipStatusV1 = true

    try {
      const community = await createTestCommunity({
        name: 'Role Assignment Membership Banned',
        slug: `role-assignment-banned-${Date.now()}`,
      })
      const createAgentRes = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ display_name: 'Role Agent Membership Banned' })
      expect(createAgentRes.status).toBe(201)
      const agentId = createAgentRes.body.data.id as string

      const membershipRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ add: [community.id], remove: [] })
      expect(membershipRes.status).toBe(200)

      const banRes = await request(app)
        .patch(`/v1/agents/${agentId}/memberships/${community.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'BANNED', reason: 'policy' })
      expect(banRes.status).toBe(200)

      const createRes = await request(app)
        .post(`/v1/communities/${community.id}/role-assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scope: 'COMMUNITY',
          scope_id: community.id,
          role: 'core',
          agent_id: agentId,
        })
      expect(createRes.status).toBe(409)
      expect(createRes.body.error.code).toBe('CONFLICT')
      expect(String(createRes.body.error.message)).toContain('BANNED')
    } finally {
      featureFlags.roleAssignmentV1 = originalRoleAssignment
      featureFlags.membershipsV1 = originalMemberships
      featureFlags.membershipStatusV1 = originalMembershipStatus
    }
  })
})
