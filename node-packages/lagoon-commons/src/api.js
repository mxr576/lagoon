// @flow

import type { SiteGroup } from './types';

const { Lokka } = require('lokka');
const { Transport } = require('lokka-transport-http');
const { createJWTWithoutSshKey } = require('./jwt');
const { logger } = require('./local-logging');

const {
  AMAZEEIO_API_HOST = 'http://api:3000',
  JWTSECRET,
  JWTAUDIENCE,
} = process.env;

if (JWTSECRET == null) {
  logger.warn(
    'No JWTSECRET env variable set... this will cause api requests to fail'
  );
}

if (JWTAUDIENCE == null) {
  logger.warn(
    'No JWTAUDIENCE env variable set... this *might* cause api requests to fail'
  );
}

const apiAdminToken = createJWTWithoutSshKey({
  payload: {
    role: 'admin',
    iss: 'lagoon-commons',
    aud: JWTAUDIENCE || 'api.amazee.io'
  },
  jwtSecret: JWTSECRET || '',
});

const options = {
  headers: {
    Authorization: `Bearer ${apiAdminToken}`,
  },
};

const transport = new Transport(`${AMAZEEIO_API_HOST}/graphql`, options);

const graphqlapi = new Lokka({ transport });

class SiteGroupNotFound extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SiteGroupNotFound';
  }
}

class NoActiveSystemsDefined extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoActiveSystemsDefined';
  }
}

async function siteGroupByGitUrl(gitUrl: string): SiteGroup {
  const result = await graphqlapi.query(`
    {
      siteGroup:siteGroupByGitUrl(gitUrl: "${gitUrl}"){
        siteGroupName
        slack {
          webhook
          channel
        }
        openshift
      }
    }
  `);

  if (!result || !result.siteGroup) {
    throw new SiteGroupNotFound(
      `Cannot find site information for git repo ${gitUrl}`
    );
  }

  return result.siteGroup;
}

async function getSiteGroupsByGitUrl(gitUrl: string): SiteGroup[] {
  const result = await graphqlapi.query(`
    {
      allSiteGroups(gitUrl: "${gitUrl}") {
        siteGroupName
        slack {
          webhook
          channel
        }
        openshift
      }
    }
  `);

  if (!result || !result.allSiteGroups || !result.allSiteGroups.length) {
    throw new SiteGroupNotFound(
      `Cannot find site information for git repo ${gitUrl}`
    );
  }

  return result.allSiteGroups;
}

async function getSlackinfoForSiteGroup(siteGroup: string): SiteGroup {
  const result = await graphqlapi.query(`
    {
      siteGroup:siteGroupByName(name: "${siteGroup}"){
        slack {
          webhook
          channel
        }
      }
    }
  `);

  if (!result || !result.siteGroup || !result.siteGroup.slack) {
    throw new SiteGroupNotFound(
      `Cannot find site information for siteGroup ${siteGroup}`
    );
  }

  return result.siteGroup;
}

async function getActiveSystemsForSiteGroup(
  siteGroup: string,
  task: string
): Promise<String> {
  const result = await graphqlapi.query(`
    {
      siteGroup:siteGroupByName(name: "${siteGroup}"){
        activeSystems
      }
    }
  `);

  if (!result || !result.siteGroup) {
    throw new SiteGroupNotFound(
      `Cannot find site information for siteGroup ${siteGroup}`
    );
  }

  if (!result.siteGroup.activeSystems) {
    throw new NoActiveSystemsDefined(
      `Cannot find active systems for siteGroup ${siteGroup}`
    );
  }

  return result.siteGroup.activeSystems;
}

const getOpenShiftInfoForSiteGroup = (siteGroupName: string): Promise<Object> =>
  graphqlapi.query(`
    {
      siteGroup:siteGroupByName(name: "${siteGroupName}"){
        openshift
        client {
          deployPrivateKey
        }
        gitUrl
      }
    }
`);

module.exports = {
  siteGroupByGitUrl,
  getSiteGroupsByGitUrl,
  getSlackinfoForSiteGroup,
  getActiveSystemsForSiteGroup,
  getOpenShiftInfoForSiteGroup
};
