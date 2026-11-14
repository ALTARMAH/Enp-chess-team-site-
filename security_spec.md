# Security Specification — ENP Chess Club Platform

## 1. Data Invariants
1. **Default Deny Catch-All**: Any path not explicitly matched is strictly denied (`allow read, write: if false;`).
2. **PII & Credential Isolation**: Public member profiles under `/clubs/{clubId}/members/{memberId}` NEVER store `email` addresses or `passwordCode` secrets. Authentication relies strictly on verified Firebase Auth (`request.auth.token.email_verified == true`).
3. **Path Variable Hardening**: Every document ID (`clubId`, `memberId`, `gameId`, `postId`, `tournamentId`, `messageId`, `recordId`) must satisfy `isValidId(id)` (`1..128` chars matching `^[a-zA-Z0-9_\\-]+$`).
4. **Owner vs. Admin Privilege Separation**:
   - `isOwner()`: Bootstrapped Owner (`fethallah2411@gmail.com` with `email_verified == true`) or verified entry in `/admins/{uid}` with `role == 'owner'`.
   - `isAdmin()`: `isOwner()` or verified entry in `/admins/{uid}`.
   - Only `isOwner()` can delete clubs or grant/revoke `/admins/{uid}` entries.
5. **Relational Sync (Master Gate)**: Subcollections verify `exists(/databases/$(database)/documents/clubs/$(clubId))` on creation.
6. **Strict Key, Type & Image Size Guards**: Every entity write validates `hasAll`, `hasOnly`, string bounds, bounded arrays, and compressed cover/avatar limits (< 220 KB) to prevent 1 MB Firestore overflow or Denial-of-Wallet attacks.
7. **Terminal State Locking**: Once a submitted game reaches `status == 'approved'`, only `isAdmin()` can modify or delete it.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection on Member**: `{ "id": "m1", "clubId": "enp-alger", "passwordCode": "1234", "email": "x@y.com" }` -> Rejected by `hasOnly()`.
2. **Unverified Admin Email Spoof**: Token with `email == 'fethallah2411@gmail.com'` and `email_verified == false` -> Rejected by `isOwner()`.
3. **Self-Privilege Escalation on Member Create**: Non-admin creates `/clubs/enp-alger/members/{uid}` with `role: 'owner'` -> Rejected by `role == 'member'` guard.
4. **Unauthorized Club Deletion by Regular Admin**: Admin (not Owner) deletes `/clubs/enp-alger` -> Rejected by `isOwner()`.
5. **Oversized PGN Denial-of-Wallet**: Game payload with 50,000-char `pgn` -> Rejected by `data.pgn.size() <= 10000`.
6. **Oversized Raw Cover Image**: Member update with 1.2 MB `coverPhotoUrl` -> Rejected by `data.coverPhotoUrl.size() <= 220000`.
7. **Orphaned Subcollection Write**: Creating tournament under nonexistent `/clubs/ghost-club/tournaments/t1` -> Rejected by `clubExists(clubId)`.
8. **ID Poisoning**: Document ID containing spaces or > 128 chars -> Rejected by `isValidId()`.
9. **Member Approving Own Pending Game**: Non-admin submits game with `status: 'approved'` -> Rejected because non-admins may only create `status == 'pending'`.
10. **Private DM Snooping**: Non-participant reads/lists `channelType == 'dm'` message where `senderAuthUid` and `recipientId` do not match caller -> Rejected by DM read gate.
11. **Anonymous Write**: Unauthenticated client posts announcement or edits member -> Rejected by `isSignedIn()`.
12. **Cross-Club Mismatch**: Writing document to `/clubs/enp-alger/posts/p1` with `data.clubId == 'other'` -> Rejected by `incoming().clubId == clubId`.
