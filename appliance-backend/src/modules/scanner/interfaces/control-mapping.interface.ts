/**
 * Mapping of rules to compliance controls (e.g. CIS, SOC2, custom).
 */

export interface ControlMapping {
  ruleId: string;
  controlId: string;
  framework?: string;
}
