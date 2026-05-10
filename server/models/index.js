const createLookupModel = require('./lookup.factory');

const MasterUser       = require('./MasterUser');
const Organization     = require('./Organization');
const Event            = require('./Event');
const PageConfig       = require('./PageConfig');
const EmailTemplate    = require('./EmailTemplate');
const Registrant       = require('./Registrant');
const BadgeConfig      = require('./BadgeConfig');
const VipRegistrant    = require('./VipRegistrant');
const VipPageConfig    = require('./VipPageConfig');
const VipEmailTemplate = require('./VipEmailTemplate');

// Lookup models (shared schema, distinct collections)
const Title            = createLookupModel('Title');
const Country          = createLookupModel('Country');
const SponsorType      = createLookupModel('SponsorType');
const HearAbout        = createLookupModel('HearAbout');
const RegisterInterest = createLookupModel('RegisterInterest');

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
  Title,
  Country,
  SponsorType,
  HearAbout,
  RegisterInterest,
};
