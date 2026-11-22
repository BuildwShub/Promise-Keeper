/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * The SAME pure modules the Apps Script add-on runs (../shared), so the extraction behaviour proven in
 * Phase 2 carries over unchanged. They end with `if (typeof module !== 'undefined') module.exports = ...`.
 */
export const Clean = require('../../shared/clean.js');
export const Dates = require('../../shared/dates.js');
export const Dedup = require('../../shared/dedup.js');
export const Prompt = require('../../shared/prompt.js');
export const Schema = require('../../shared/schema.js');
export const Validate = require('../../shared/validate.js');
export const Score = require('../../shared/score.js');
export const OutputsFmt = require('../../shared/outputsfmt.js');
export const DigestFmt = require('../../shared/digestfmt.js');
export const NudgeFmt = require('../../shared/nudgefmt.js');
export const MetricsFmt = require('../../shared/metricsfmt.js');
