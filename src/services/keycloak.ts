import Keycloak from 'keycloak-js';

const keycloakConfig = {
  url: 'http://localhost:8080',
  realm: 'pcrs-realm',
  clientId: 'pcrs-frontend-client', 
};

// Create the instance ONLY. Do not call .init() here.
const keycloak = new Keycloak(keycloakConfig);

export default keycloak;