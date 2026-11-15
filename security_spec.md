# Flaresim Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Ownership**: Every document in `/projects/{projectId}` MUST have `ownerId == request.auth.uid`, and only the verified owner (`request.auth.token.email_verified == true`) may `get`, `list`, `create`, `update`, or `delete` it.
2. **ID & Boundary Integrity**: Every `{projectId}` and `data.id` MUST match `^[a-zA-Z0-9_\-]+$` with length `1..128`. All strings enforce `.size()` limits, and `receptors` is bounded to `<= 50` entries.
3. **Immutable Audit Fields & Server Timestamps**: `ownerId`, `id`, and `createdAt` are immutable after creation; `createdAt` and `updatedAt` MUST equal `request.time`.
4. **Terminal State Locking**: Once `status == 'completed'`, the project document is locked against further updates (users may clone it into a new project document if revisions are needed).
5. **No Blanket List**: `allow list` explicitly checks `resource.data.ownerId == request.auth.uid`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. Unauthenticated `create` (`request.auth == null`) -> `PERMISSION_DENIED`.
2. Unverified email `create` (`email_verified: false`) -> `PERMISSION_DENIED`.
3. Spoofed `ownerId` (`ownerId: 'victim_uid'`) -> `PERMISSION_DENIED`.
4. Path/body ID mismatch (`projectId != data.id`) -> `PERMISSION_DENIED`.
5. Oversized ID poisoning (`1.5KB` string in `projectId`) -> `PERMISSION_DENIED`.
6. Client-forged `createdAt` / `updatedAt` (not equal to `request.time`) -> `PERMISSION_DENIED`.
7. Shadow/Ghost field injection (`{ ..., isAdmin: true }`) -> `PERMISSION_DENIED`.
8. Unbounded array abuse (`receptors.length > 50`) -> `PERMISSION_DENIED`.
9. Cross-user `get` or `list` without `ownerId == uid` filter -> `PERMISSION_DENIED`.
10. Updating `ownerId` or `createdAt` on existing draft -> `PERMISSION_DENIED`.
11. Mutating a `status: 'completed'` document via `update` -> `PERMISSION_DENIED`.
12. Deleting another user's project -> `PERMISSION_DENIED`.
