import Keycloak from 'keycloak-js';

const keycloakConfig = {
  url: 'http://localhost:8080',
  realm: 'pcrs-realm',
  clientId: 'pcrs-frontend-client',
};

const keycloak = new Keycloak(keycloakConfig);
export default keycloak;