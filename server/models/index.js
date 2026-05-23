const createLookupModel = require('./lookup.factory');

const MasterUser       = require('./MasterUser');
const Visitor          = require('./Visitor');
const Organization     = require('./Organization');
const Event            = require('./Event');
const PageConfig       = require('./PageConfig');
const EmailTemplate    = require('./EmailTemplate');
const Registrant       = require('./Registrant');
const BadgeConfig      = require('./BadgeConfig');
const VipRegistrant          = require('./VipRegistrant');
const VipPageConfig          = require('./VipPageConfig');
const VipEmailTemplate       = require('./VipEmailTemplate');
const WaitlistRegistrant     = require('./WaitlistRegistrant');
const VipWaitlistRegistrant  = require('./VipWaitlistRegistrant');

// Lookup models (shared schema, distinct collections)
const Title            = createLookupModel('Title');
const Country          = createLookupModel('Country');
const HearAbout        = createLookupModel('HearAbout');
module.exports = {
  MasterUser,
  Organization,
  Event,
  PageConfig,
  EmailTemplate,
  Registrant,
  BadgeConfig,
  VipRegistrant,
  VipPageConfig,
  VipEmailTemplate,
  WaitlistRegistrant,
  VipWaitlistRegistrant,
  Title,
  Country,
  HearAbout,
  Visitor,
};
