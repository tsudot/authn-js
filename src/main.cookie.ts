import { SessionManager } from "./session_manager";
import { CookieSessionStore } from "./cookie_store";
import { signup as signupAPI, login as loginAPI, logout as logoutAPI } from "./api";

const unconfigured: string = "AuthN must be configured with setSession()";

let store: SessionStore|undefined;
let manager: SessionManager;

export function setSessionName(cookieName: string): void {
  store = new CookieSessionStore(cookieName);
  manager = new SessionManager(store);
  manager.maintain();
}

export function signup(credentials: Credentials): Promise<string> {
  return signupAPI(credentials)
    .then(updateAndReturn);
}

export function login(credentials: Credentials): Promise<string> {
  return loginAPI(credentials)
    .then(updateAndReturn);
}

export function logout(): Promise<void> {
  return logoutAPI()
    .then(() => {
      if (!store) { throw unconfigured };
      store.delete();
    });
}

export function session(): Session|undefined {
  return (store) ? store.session : undefined;
}

// export remaining API methods unmodified
export * from "./api";

function updateAndReturn(token: string) {
  if (!manager) { throw unconfigured };
  manager.updateAndMaintain(token);
  return token;
}
