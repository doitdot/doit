# Authentication Strategy

This document defines the authentication architecture for the `doit` project, utilizing **Keycloak** as the Identity Provider (IdP), **NestJS** as the backend API, and **Expo (React Native)** as the mobile client.

## 1. Auth Method: OIDC Authorization Code Flow with PKCE

We will use the **OpenID Connect (OIDC)** standard, specifically the **Authorization Code Flow with PKCE** (Proof Key for Code Exchange).

### Why this choice?
*   **Security standard:** PKCE is the recommended flow for public clients (mobile apps) that cannot safely store a client secret.
*   **User Experience:** Allows leveraging Keycloak's login pages (supporting MFA, social login, etc.) without implementing them natively in the app.

### Workflow
1.  **Mobile App:** Initiates login by opening a system browser to Keycloak.
2.  **User:** Authenticates on Keycloak.
3.  **Keycloak:** Redirects back to the app (via deep link `doit://`) with an authorization code.
4.  **Mobile App:** Exchanges this code (plus the PKCE verifier) for Access & Refresh Tokens directly with Keycloak.
5.  **API:** Validates Access Tokens using Keycloak's public keys (JWKS).

## 2. Tokens & Refresh Strategy

### Access Token (JWT)
*   **Lifespan:** **5 minutes**.
*   **Usage:** Sent in the `Authorization: Bearer <token>` header for every API request.
*   **Validation:** Stateless validation on the API side via `passport-jwt` and Keycloak's public key (retrieved from JWKS endpoint).

### Refresh Token
*   **Lifespan:** **30 days** (Subject to "Offline Access" scope in Keycloak).
*   **Usage:** Used by the mobile app to request a new Access Token when the current one expires (401 error interception or proactive refresh).
*   **Rotation:** Enabled in Keycloak (Refresh Token Rotation) to prevent replay attacks. A new refresh token is issued every time the old one is used.

### Storage on Mobile
*   **Android/iOS:** Must use encrypted storage (`expo-secure-store`). **NEVER** store tokens in `AsyncStorage` (unencrypted) or simple state.

## 3. Device Sessions

We will rely on **Keycloak's Session Management** functionality.

*   **Tracking:** Keycloak naturally tracks sessions per user.
*   **Constraint:** We will configure Keycloak to limit the number of active sessions per user (e.g., max 5 devices) to prevent abuse.
*   **Future Feature:** We can query the Keycloak Admin API (later) to show the user "Currently logged in devices" inside the app settings.

## 4. Logout Strategy

We implement a **Hard Logout** (Revocation).

### Workflow
1.  **User:** Taps "Logout" in the app.
2.  **Mobile App:**
    *   Calls the Keycloak **Revocation Endpoint** to invalidate the current Refresh Token. (**Critical** for security).
    *   Clears tokens from `expo-secure-store`.
    *   (Optional) Opens the Keycloak Logout URL to clear the browser session cookie, ensuring the next login doesn't auto-log them back in.
3.  **API:** Continues to accept the *short-lived* Access Token until it naturally expires (max 5 min), but the Refresh Token is dead immediately.

## 5. Implementation Plan

### Phase 1: Keycloak Configuration (Infra)
*   Create Realm `doit`.
*   Create Client `doit-mobile` (Public, PKCE enabled, Redirect URI: `doit://*`).
*   Configure Token Lifespans.

### Phase 2: Mobile Implementation
*   Install `expo-auth-session` and `expo-secure-store`.
*   Implement `AuthContext` to handle the token lifecycle (Login -> Store -> Refresh -> Logout).

### Phase 3: API Implementation
*   Install `@nestjs/passport` and `passport-jwt`.
*   Create `AuthGuard` to validate JWTs against Keycloak's Issuer URL.
