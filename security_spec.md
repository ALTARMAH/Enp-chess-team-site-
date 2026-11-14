# Security Specification — ENP Chess Club Multi-Tenant Platform

## 1. Data Invariants
1. **Default Deny Catch-All**: Any path not explicitly matched is strictly denied (`allow read, write: if false;`).
2. **Path Variable Hardening**: Every document ID (`clubId`, `memberId`, `gameId`, `postId`, `tournamentId`) must satisfy `isValidId(id)` (`id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
3. **Owner vs. Admin Privilege Separation**:
   - `isOwner()`: Bootstrapped Owner (`fethallah2411@gmail.com` with `email_verified == true`) or verified entry in `/admins/{uid}` with `role == 'owner'`.
   - `isAdmin()`: `isOwner()` or verified entry in `/admins/{uid}`.
   - Only `isAdmin()` can create clubs (`/clubs/{clubId}`), create tournaments, or publish home screen posts.
   - Only `isOwner()` can delete a club (`allow delete: if isOwner();`).
4. **Relational Sync (Master Gate)**: Subcollections under `/clubs/{clubId}/...` verify `exists(/databases/$(database)/documents/clubs/$(clubId))` on creation.
5. **Strict Key & Size Blueprints**: Every entity write validates required keys (`hasAll`), allowed keys (`hasOnly`), string length bounds, and enum values.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection on Club**: `{ "clubId": "enp", "clubName": "ENP", "isSuperHack": true }` -> Rejected by `hasOnly()`.
2. **Unverified Admin Email Spoof**: Token with `email == 'fethallah2411@gmail.com'` but `email_verified == false` -> Rejected by `isOwner()`.
3. **Unauthorized Club Deletion by Regular Admin**: Admin (not Owner) calls `delete` on `/clubs/enp-alger` -> Rejected by `allow delete: if isValidId(clubId) && isOwner();`.
4. **Oversized PGN Denial-of-Wallet**: Game payload with 50,000-char `pgn` -> Rejected by `data.pgn.size() <= 10000`.
5. **Self-Privilege Escalation on Member Create**: Regular user creates member with `role: 'owner'` -> Rejected by `isAdmin()` gate and role check.
6. **Invalid Time Control Enum**: Game created with `timeControl: 'bullet_hack'` -> Rejected by enum check `['rapid', 'blitz', 'classical']`.
7. **Orphaned Subcollection Write**: Creating a game under nonexistent `/clubs/ghost-club/games/g1` -> Rejected by `exists(/databases/$(database)/documents/clubs/$(clubId))`.
8. **ID Poisoning**: Document ID with spaces/slashes or >128 chars -> Rejected by `isValidId()`.
9. **Member Approving Own Pending Game**: Non-admin member attempts to set `status: 'approved'` -> Rejected because only `isAdmin()` can set `status == 'approved'`.
10. **Invalid Elo Type**: Setting `eloRapid: "1800"` (string instead of int/number) -> Rejected by `data.eloRapid is int`.
11. **Anonymous Write**: Unauthenticated client attempts to post announcement -> Rejected by `isSignedIn() && isAdmin()`.
12. **Cross-Club Mismatch**: Writing document to `/clubs/enp-alger/posts/p1` with `data.clubId == 'usthb'` -> Rejected by `incoming().clubId == clubId`.
