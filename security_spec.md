# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Ownership**: Every document under `/users/{userId}` and its subcollections (`/companySettings/{settingId}`, `/savedAnalyses/{analysisId}`) belongs exclusively to `{userId}` where `request.auth.uid == userId`.
2. **PII Isolation**: User profile data (`email`, `phone`, `displayName`) and company settings are strictly unreadable and unmodifiable by any user other than the owner (`isOwner(userId)`). No blanket `isSignedIn()` reads or `allow list` without owner verification.
3. **Strict Schema & Key Whitelisting**: Shadow/ghost fields (e.g., `role`, `isAdmin`, `isVerified`) are rejected on both `create` (`hasAll` + `hasOnly`) and `update` (`affectedKeys().hasOnly(...)`).
4. **Path Variable Hardening**: Every document ID (`userId`, `settingId`, `analysisId`) must satisfy `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, length `<= 128`).
5. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on `create` and remain immutable on `update`; `updatedAt` must equal `request.time` on both `create` and `update`; `uid` / `ownerId` are immutable after creation.
6. **Bounded Strings & Numbers**: Every string property enforces strict `.size()` caps matching `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: `request.auth == null` attempting `get /users/u1` or `create /users/u1`.
2. **Cross-Tenant Read**: `uid: "attacker"` attempting `get /users/victim`.
3. **Cross-Tenant Subcollection List**: `uid: "attacker"` attempting `list /users/victim/savedAnalyses`.
4. **Identity Spoofing on Create**: `uid: "attacker"` attempting `create /users/attacker/savedAnalyses/a1` with `ownerId: "victim"`.
5. **Shadow / Privilege Escalation Field on Create**: `uid: "u1"` creating `/users/u1` with `{ ..., "isAdmin": true }`.
6. **Shadow Field on Update**: `uid: "u1"` updating `/users/u1/companySettings/profile` with `{ "role": "superadmin", "companyName": "X", "updatedAt": request.time }`.
7. **ID Poisoning**: `uid: "u1"` creating `/users/u1/savedAnalyses/bad$id..with/junk` or 1.5KB string ID.
8. **Type Poisoning**: `uid: "u1"` setting `rowCount: "100"` (string instead of number) or `companyName: 12345`.
9. **Oversized Payload / Denial of Wallet**: `uid: "u1"` sending `summaryText` > 2000 chars or `logoDataUrl` > 262144 chars.
10. **Fake Client Timestamp**: `uid: "u1"` setting `createdAt` or `updatedAt` to a client-supplied past/future timestamp instead of `request.time`.
11. **Immutable Field Tampering**: `uid: "u1"` attempting to mutate `createdAt` or `ownerId` during an `update`.
12. **Invalid Enum Injection**: `uid: "u1"` creating `SavedAnalysis` with `chartType: "InvalidChart"` or `pageType: "hacked"`.
